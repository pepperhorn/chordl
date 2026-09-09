# Board Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A display-only board component with a play mode, where a cursor walks the chords and each one sounds in its own instrument patch.

**Architecture:** A new `BoardPlayer` component in `chordl-board` renders the existing grid by reusing `BoardCardContent` and a layout module lifted out of `ChordBoard`. Audio goes through `chordl-react`'s existing `startPlayback`, which already returns a controller with `cancel()` and `onActiveChange()` — the cursor cancels the previous chord on every move, and the active indices drive note highlighting through the `activePlaybackIndices` prop the renderers already accept.

**Tech Stack:** React 19, TypeScript, Vitest + @testing-library/react, smplr (via the existing `chordl-react` playback module).

**Spec:** `docs/superpowers/specs/2026-09-10-board-player-and-chord-refs-design.md` (section A)

## Global Constraints

- `chordl-board` is published MIT (`publishConfig.access: public`). No paywall check, no vendor endpoint, no knowledge of ph-apps in this package.
- Contextual semantic class names alongside utility classes on every element (`board-player`, `board-player-cursor`, …).
- Poppins is the UI font.
- Comments explain *why*, matching the density of the surrounding code.
- `pnpm build` must run before `pnpm test:run` / `pnpm lint` — packages resolve each other from `dist`.
- Baseline before this plan: 1303 tests green, lint clean across 6 packages.
- Instrument ids are exactly `"acoustic_grand_piano" | "electric_guitar_clean" | "ukulele"` (`PlaybackInstrument` in `chordl-core/src/types.ts:13`).
- Cursor never lands on a text card (`isTextCard(item)`).
- Cursor stops at both ends; it does not wrap.

---

### Task 1: Preload seam for instrument patches

`ensureInstrument` is module-private in `packages/chordl-react/src/audio/playback.ts:49`. Play mode needs to warm the board's distinct instruments up front, so this exposes a narrow entry point rather than the whole function.

**Files:**
- Modify: `packages/chordl-react/src/audio/playback.ts`
- Modify: `packages/chordl-react/src/index.ts`
- Test: `packages/chordl-react/test/playback-preload.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `preloadInstruments(instruments: readonly PlaybackInstrument[]): Promise<void>` — resolves when every requested patch is loaded or has failed. Never rejects. Duplicate ids load once.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const started = vi.fn();
const created: string[] = [];

vi.mock("smplr", () => ({
  Soundfont: class {
    constructor(_ctx: unknown, opts: { instrument: string }) { created.push(opts.instrument); }
    load = Promise.resolve(this);
    start = started;
  },
}));

describe("preloadInstruments", () => {
  beforeEach(() => { created.length = 0; });

  it("loads each distinct instrument once", async () => {
    const { preloadInstruments } = await import("../src/audio/playback");
    await preloadInstruments(["acoustic_grand_piano", "electric_guitar_clean", "acoustic_grand_piano"]);
    expect(created.filter((i) => i === "acoustic_grand_piano")).toHaveLength(1);
    expect(created).toContain("electric_guitar_clean");
  });

  it("resolves even when a patch fails to load", async () => {
    const { preloadInstruments } = await import("../src/audio/playback");
    await expect(preloadInstruments(["ukulele"])).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/shaun/chordl && pnpm --filter @pepperhorn/chordl-react exec vitest run test/playback-preload.test.ts`
Expected: FAIL — `preloadInstruments is not a function`.

- [ ] **Step 3: Write minimal implementation**

In `playback.ts`, below `ensureInstrument`:

```ts
/**
 * Warm a set of patches before they are needed.
 *
 * `ensureInstrument` already de-duplicates in flight, so this is only a public
 * door onto it. It never rejects: a preload is an optimisation, and a failed
 * one must not take down the caller that asked for it — the real
 * `startPlayback` will surface the failure if the patch is actually used.
 */
export async function preloadInstruments(
  instruments: readonly PlaybackInstrument[],
): Promise<void> {
  await Promise.all(
    [...new Set(instruments)].map((instrument) =>
      ensureInstrument(instrument).catch(() => undefined),
    ),
  );
}
```

Add `preloadInstruments` to the value export list in `packages/chordl-react/src/index.ts:35`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/shaun/chordl && pnpm --filter @pepperhorn/chordl-react exec vitest run test/playback-preload.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-react/src/audio/playback.ts packages/chordl-react/src/index.ts packages/chordl-react/test/playback-preload.test.ts
git commit -m "feat: expose preloadInstruments so a board can warm its patches"
```

---

### Task 2: Lift the board layout maths into its own module

`ChordBoard.tsx` is ~1400 lines and holds the row-packing logic inline (`GRID_TRACKS` at :430, `trackWidth` at :852, the packing loop at :862-874, `sizeFits` at :884). `BoardPlayer` needs the same layout. Duplicating it guarantees the two drift.

This task is a pure refactor: behaviour must not change, and the existing board tests are the proof.

**Files:**
- Create: `packages/chordl-board/src/layout.ts`
- Modify: `packages/chordl-board/src/ChordBoard.tsx` (delete the lifted code, import instead)
- Modify: `packages/chordl-board/src/index.ts`
- Test: `packages/chordl-board/test/layout.test.ts`

**Interfaces:**
- Consumes: `BoardItem`, `BOARD_CARD_SIZE_FACTORS` from `./types.js`.
- Produces:
  - `GRID_TRACKS: 480`
  - `trackWidth(item: BoardItem, columns: number): number`
  - `computeRowSpans(items: BoardItem[], columns: number): { spans: number[]; rowOthers: number[] }`
  - `sizeFits(rowOthers: number[], index: number, factor: number, columns: number): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { GRID_TRACKS, trackWidth, computeRowSpans, sizeFits } from "../src/layout";
import type { BoardItem } from "../src/types";

const card = (size: BoardItem["size"], breakAfter = false): BoardItem =>
  ({ id: Math.random().toString(36).slice(2), kind: "chord", nl: "C", size, breakAfter });

describe("board layout", () => {
  it("gives a regular card one column's worth of tracks", () => {
    expect(trackWidth(card("rg"), 4)).toBe(GRID_TRACKS / 4);
  });

  it("halves that for sm and triples it for 2xl", () => {
    expect(trackWidth(card("sm"), 4)).toBe(GRID_TRACKS / 8);
    expect(trackWidth(card("2xl"), 4)).toBe((GRID_TRACKS * 3) / 4);
  });

  it("packs four regular cards onto one row at four columns", () => {
    const { rowOthers } = computeRowSpans([card("rg"), card("rg"), card("rg"), card("rg")], 4);
    // Every card shares a row with three others of the same width.
    expect(rowOthers[0]).toBe((GRID_TRACKS / 4) * 3);
  });

  it("starts a new row after a card with breakAfter", () => {
    const { rowOthers } = computeRowSpans([card("rg", true), card("rg")], 4);
    expect(rowOthers[0]).toBe(0);
    expect(rowOthers[1]).toBe(0);
  });

  it("refuses a size that would overflow the row it is on", () => {
    const items = [card("rg"), card("rg"), card("rg"), card("rg")];
    const { rowOthers } = computeRowSpans(items, 4);
    expect(sizeFits(rowOthers, 0, 1, 4)).toBe(true);
    expect(sizeFits(rowOthers, 0, 2, 4)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/shaun/chordl && pnpm --filter @pepperhorn/chordl-board exec vitest run test/layout.test.ts`
Expected: FAIL — cannot resolve `../src/layout`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/chordl-board/src/layout.ts` by **moving** (not rewriting) the existing logic from `ChordBoard.tsx`: the `GRID_TRACKS` constant, `trackWidth`, the row-packing loop that produces `spans` and `rowOthers`, and `sizeFits`. Keep every comment that travels with it — the eighths-and-quarters note on `GRID_TRACKS` explains why the number is 480 and must not be lost.

Change `sizeFits` to take `rowOthers` and `columns` as parameters rather than closing over them, so it is a pure function. Then in `ChordBoard.tsx`, import from `./layout.js` and delete the moved code, adapting the call site to pass `rowOthers` and `columns`.

Export the four names from `packages/chordl-board/src/index.ts`.

- [ ] **Step 4: Run tests to verify the refactor changed nothing**

Run: `cd /home/shaun/chordl && pnpm build && pnpm --filter @pepperhorn/chordl-board test:run`
Expected: PASS — the new layout tests, plus `row-layout.test.tsx`, `card-size.test.tsx` and every other board test unchanged. Any failure here means the move altered behaviour; fix the move, do not adjust the test.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/layout.ts packages/chordl-board/src/ChordBoard.tsx packages/chordl-board/src/index.ts packages/chordl-board/test/layout.test.ts
git commit -m "refactor: lift the board row-packing maths into layout.ts"
```

---

### Task 3: Pass playback highlighting through the card renderer

`PianoKeyboard`, `StaffNotation` and `GuitarChord` all already accept `activePlaybackIndices`. `BoardCardContent` does not forward it, so a board card cannot show which note is sounding.

**Files:**
- Modify: `packages/chordl-board/src/ChordBoard.tsx` (`BoardCardContent`, :102)
- Test: `packages/chordl-board/test/card-playback-highlight.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `BoardCardContent` gains `activePlaybackIndices?: number[]`, forwarded to the chord renderer. Text cards ignore it.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

const seen: Array<number[] | undefined> = [];
vi.mock("@pepperhorn/chordl-react", async (orig) => {
  const actual = await orig<typeof import("@pepperhorn/chordl-react")>();
  return {
    ...actual,
    PianoChord: (props: { activePlaybackIndices?: number[] }) => {
      seen.push(props.activePlaybackIndices);
      return <div data-testid="chord" />;
    },
  };
});

import { ChordBoard } from "../src/ChordBoard";

describe("BoardCardContent highlighting", () => {
  it("forwards activePlaybackIndices to the chord renderer", () => {
    seen.length = 0;
    render(
      <ChordBoard
        state={{ items: [{ id: "a", kind: "chord", nl: "Cmaj7", display: "keyboard" }], meta: {} }}
        activePlaybackIndices={{ a: [1, 2] }}
      />,
    );
    expect(seen).toContainEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/shaun/chordl && pnpm --filter @pepperhorn/chordl-board exec vitest run test/card-playback-highlight.test.tsx`
Expected: FAIL — `seen` holds `undefined`, not `[1, 2]`.

- [ ] **Step 3: Write minimal implementation**

Add `activePlaybackIndices?: number[]` to `BoardCardContent`'s props and spread it onto the chord renderer. Add `activePlaybackIndices?: Record<string, number[]>` to `ChordBoardProps`, keyed by item id, and pass `activePlaybackIndices?.[item.id]` at the `BoardCardContent` call site (~:1313).

Keyed by id rather than index because a board reorders, and an index-keyed map would light the wrong card after a move.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/shaun/chordl && pnpm --filter @pepperhorn/chordl-board exec vitest run test/card-playback-highlight.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/ChordBoard.tsx packages/chordl-board/test/card-playback-highlight.test.tsx
git commit -m "feat: forward activePlaybackIndices through board cards"
```

---

### Task 4: Reserve `bundleId` on the card schema

Per the spec: validated, round-tripped, read by nothing. This follows the precedent `level` set in the same file — boards are exported to JSON files users keep, and a field added later forces a migration on files already on disk.

**Files:**
- Modify: `packages/chordl-board/src/types.ts`
- Modify: `packages/chordl-board/src/io.ts`
- Test: `packages/chordl-board/test/io.test.ts` (extend)

**Interfaces:**
- Consumes: nothing.
- Produces: `BoardItem.bundleId?: string`, surviving an export/import round trip. Rejected (dropped) if it is not a URL-safe token of 1–64 characters matching `/^[A-Za-z0-9._~-]+$/`.

- [ ] **Step 1: Write the failing test**

Append to `packages/chordl-board/test/io.test.ts`:

```ts
describe("bundleId", () => {
  it("survives an export/import round trip", () => {
    const state = { items: [{ id: "a", kind: "chord" as const, nl: "C", bundleId: "cdl-a1b2c3" }], meta: {} };
    const back = importBoardJson(exportBoardJson(state));
    expect(back.items[0].bundleId).toBe("cdl-a1b2c3");
  });

  it("drops a value that is not a URL-safe token", () => {
    const raw = JSON.stringify({
      schema: BOARD_SCHEMA,
      items: [{ id: "a", kind: "chord", nl: "C", bundleId: "not a token/../etc" }],
      meta: {},
    });
    expect(importBoardJson(raw).items[0].bundleId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/shaun/chordl && pnpm --filter @pepperhorn/chordl-board exec vitest run test/io.test.ts -t bundleId`
Expected: FAIL — `bundleId` is `undefined` on the round trip.

- [ ] **Step 3: Write minimal implementation**

In `types.ts`, beside `level`:

```ts
/**
 * Opaque id of a hosted chord bundle for this card.
 *
 * Reserved, not used: nothing reads it today. Stored now for the same reason
 * `level` was — a board is exported to a JSON file the user keeps, so a field
 * added after those files exist forces a migration on them. What a bundle
 * contains is deliberately not decided here.
 */
bundleId?: string;
```

In `io.ts`, add a `parseBundleId` alongside `parseLevel` (~:205-212) applying the `/^[A-Za-z0-9._~-]{1,64}$/` rule, and wire it into the item parser beside `playbackHighlightColor` (~:240). Add `bundleId` to the exported item shape so `exportBoardJson` writes it.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/shaun/chordl && pnpm --filter @pepperhorn/chordl-board exec vitest run test/io.test.ts`
Expected: PASS, whole file.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/types.ts packages/chordl-board/src/io.ts packages/chordl-board/test/io.test.ts
git commit -m "feat: reserve bundleId on board cards"
```

---

### Task 5: Resolve a card's playable pitches

Cards saved before playback fields existed carry no `playbackNotes`. They must still sound — **through the same resolution the card renders through**, or the card draws one voicing and sounds another with nothing on screen to contradict it. That is the failure mode PRs #63 and #64 existed to remove, and here it is silent.

`buildMei(notes, opts).playbackNotes` is that single resolution (added in #64): the pitches the staff engraves, in playback order.

**Files:**
- Create: `packages/chordl-board/src/cardPlayback.ts`
- Test: `packages/chordl-board/test/card-playback.test.ts`

**Interfaces:**
- Consumes: `BoardItem`; `parseChordDescription`, `resolveChord`, `buildMei` from `@pepperhorn/chordl-core`; `noteToMidi` from `@pepperhorn/chordl-react`.
- Produces: `resolveCardPlayback(item: BoardItem): { midi: number[]; instrument: PlaybackInstrument } | null` — `null` for a text card, a chord card with no `nl`, or one whose text will not parse.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { resolveCardPlayback } from "../src/cardPlayback";
import type { BoardItem } from "../src/types";

const chord = (extra: Partial<BoardItem>): BoardItem =>
  ({ id: "a", kind: "chord", nl: "Cmaj7", display: "keyboard", ...extra });

describe("resolveCardPlayback", () => {
  it("prefers the stored pitches verbatim", () => {
    const out = resolveCardPlayback(chord({ playbackNotes: [60, 64, 67, 71], playbackInstrument: "electric_guitar_clean" }));
    expect(out).toEqual({ midi: [60, 64, 67, 71], instrument: "electric_guitar_clean" });
  });

  it("resolves a legacy card from its chord text", () => {
    // Cmaj7 at the staff's own octaves — the same pitches buildMei engraves.
    expect(resolveCardPlayback(chord({})).midi).toEqual([60, 64, 67, 71]);
  });

  it("keeps a rotation the chord text asks for", () => {
    const out = resolveCardPlayback(chord({ nl: "Cmaj7 starting on E" }));
    expect(out!.midi[0] % 12).toBe(4); // E in the bass, not C
  });

  it("picks the guitar patch for a guitar card", () => {
    expect(resolveCardPlayback(chord({ display: "guitar" }))!.instrument).toBe("electric_guitar_clean");
  });

  it("picks ukulele when the card names that instrument", () => {
    expect(resolveCardPlayback(chord({ display: "guitar", instrument: "ukulele" }))!.instrument).toBe("ukulele");
  });

  it("returns null for a text card", () => {
    expect(resolveCardPlayback({ id: "t", kind: "text", title: "Verse" })).toBeNull();
  });

  it("returns null rather than throwing on unparseable text", () => {
    expect(resolveCardPlayback(chord({ nl: "zzzz" }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/shaun/chordl && pnpm --filter @pepperhorn/chordl-board exec vitest run test/card-playback.test.ts`
Expected: FAIL — cannot resolve `../src/cardPlayback`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { parseChordDescription, resolveChord, buildMei } from "@pepperhorn/chordl-core";
import { noteToMidi } from "@pepperhorn/chordl-react";
import type { PlaybackInstrument } from "@pepperhorn/chordl-core";
import { isTextCard } from "./types.js";
import type { BoardItem } from "./types.js";

export interface CardPlayback {
  midi: number[];
  instrument: PlaybackInstrument;
}

/** The patch a card sounds in when it does not name one. */
function fallbackInstrument(item: BoardItem): PlaybackInstrument {
  if (item.display !== "guitar") return "acoustic_grand_piano";
  return item.instrument === "ukulele" ? "ukulele" : "electric_guitar_clean";
}

/**
 * What a card should sound.
 *
 * Stored `playbackNotes` win outright — they are the exact voicing the editor
 * captured. Everything else is a card saved before those existed, and is
 * resolved through `buildMei().playbackNotes`: the single resolution the staff
 * engraves from, so the card cannot sound a voicing it is not drawing. A
 * second resolve path here would be inaudible-until-wrong.
 */
export function resolveCardPlayback(item: BoardItem): CardPlayback | null {
  if (isTextCard(item)) return null;
  const instrument = (item.playbackInstrument as PlaybackInstrument | undefined)
    ?? fallbackInstrument(item);
  if (item.playbackNotes?.length) return { midi: item.playbackNotes, instrument };
  if (!item.nl) return null;
  try {
    const parsed = parseChordDescription(item.nl);
    const resolved = resolveChord(parsed.chordName ?? item.nl);
    let notes = resolved.notes;
    if (parsed.startingNote) {
      const idx = notes.indexOf(parsed.startingNote);
      if (idx > 0) notes = [...notes.slice(idx), ...notes.slice(0, idx)];
    }
    const midi = buildMei(notes).playbackNotes.map((n) => noteToMidi(n));
    return midi.length ? { midi, instrument } : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/shaun/chordl && pnpm build && pnpm --filter @pepperhorn/chordl-board exec vitest run test/card-playback.test.ts`
Expected: PASS (7 tests). If the rotation case fails, the rotation rule here has drifted from `PianoChord`'s — fix by matching `PianoChord`, not by relaxing the test.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/cardPlayback.ts packages/chordl-board/test/card-playback.test.ts
git commit -m "feat: resolve a board card's playable pitches"
```

---

### Task 6: The `BoardPlayer` component

**Files:**
- Create: `packages/chordl-board/src/BoardPlayer.tsx`
- Modify: `packages/chordl-board/src/index.ts`
- Test: `packages/chordl-board/test/board-player.test.tsx`

**Interfaces:**
- Consumes: `computeRowSpans`, `GRID_TRACKS` (Task 2); `BoardCardContent` with `activePlaybackIndices` (Task 3); `resolveCardPlayback` (Task 5); `preloadInstruments`, `startPlayback` (Task 1 / existing).
- Produces:

```ts
export interface BoardPlayerProps {
  state: BoardState;
  scale?: number;
  uiTheme?: UIThemeMode;
  /** Play mode is the host's state, so a page can put the toggle where it likes. */
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  /** Draw the "more" affordance. The host owns entitlement; this package must not. */
  canShowMore?: boolean;
  onShowMore?: (item: BoardItem) => void;
}
```

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

const cancel = vi.fn();
const startPlayback = vi.fn(async () => ({ events: [], completion: Promise.resolve(), cancel }));
const preloadInstruments = vi.fn(async () => {});
vi.mock("@pepperhorn/chordl-react", async (orig) => ({
  ...(await orig<typeof import("@pepperhorn/chordl-react")>()),
  startPlayback,
  preloadInstruments,
}));

import { BoardPlayer } from "../src/BoardPlayer";

const state = {
  items: [
    { id: "a", kind: "chord" as const, nl: "C", display: "keyboard" as const, playbackNotes: [60, 64, 67] },
    { id: "t", kind: "text" as const, title: "Verse" },
    { id: "b", kind: "chord" as const, nl: "G", display: "guitar" as const, playbackNotes: [55, 59, 62] },
  ],
  meta: {},
};

const player = () => document.querySelector(".board-player") as HTMLElement;

describe("BoardPlayer", () => {
  beforeEach(() => { startPlayback.mockClear(); cancel.mockClear(); preloadInstruments.mockClear(); });

  it("sounds nothing until play mode is on", () => {
    render(<BoardPlayer state={state} playing={false} onPlayingChange={() => {}} />);
    fireEvent.keyDown(player(), { key: "ArrowRight" });
    expect(startPlayback).not.toHaveBeenCalled();
  });

  it("preloads the board's distinct instruments when play mode starts", async () => {
    render(<BoardPlayer state={state} playing onPlayingChange={() => {}} />);
    await waitFor(() => expect(preloadInstruments).toHaveBeenCalled());
    expect([...preloadInstruments.mock.calls[0][0]].sort())
      .toEqual(["acoustic_grand_piano", "electric_guitar_clean"]);
  });

  it("steps to the next chord and sounds it", async () => {
    render(<BoardPlayer state={state} playing onPlayingChange={() => {}} />);
    fireEvent.keyDown(player(), { key: "ArrowRight" });
    await waitFor(() => expect(startPlayback).toHaveBeenCalled());
    expect(startPlayback.mock.calls.at(-1)![0]).toEqual([55, 59, 62]); // skipped the text card
  });

  it("cuts the previous chord on every move", async () => {
    render(<BoardPlayer state={state} playing onPlayingChange={() => {}} />);
    fireEvent.keyDown(player(), { key: "ArrowRight" });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(player(), { key: "ArrowLeft" });
    await waitFor(() => expect(cancel).toHaveBeenCalled());
  });

  it("replays the current chord on Space and ArrowDown without moving", async () => {
    render(<BoardPlayer state={state} playing onPlayingChange={() => {}} />);
    fireEvent.keyDown(player(), { key: " " });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(player(), { key: "ArrowDown" });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(2));
    expect(startPlayback.mock.calls[0][0]).toEqual(startPlayback.mock.calls[1][0]);
  });

  it("stops at the ends rather than wrapping", async () => {
    render(<BoardPlayer state={state} playing onPlayingChange={() => {}} />);
    fireEvent.keyDown(player(), { key: "ArrowLeft" });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(1));
    expect(startPlayback.mock.calls[0][0]).toEqual([60, 64, 67]); // still the first chord
  });

  it("toggles play mode with p", () => {
    const onPlayingChange = vi.fn();
    render(<BoardPlayer state={state} playing={false} onPlayingChange={onPlayingChange} />);
    fireEvent.keyDown(player(), { key: "p" });
    expect(onPlayingChange).toHaveBeenCalledWith(true);
  });

  it("draws the more affordance only when the host allows it", () => {
    const onShowMore = vi.fn();
    const { rerender } = render(<BoardPlayer state={state} playing onPlayingChange={() => {}} />);
    expect(document.querySelector(".board-player-more")).toBeNull();
    rerender(<BoardPlayer state={state} playing onPlayingChange={() => {}} canShowMore onShowMore={onShowMore} />);
    fireEvent.click(document.querySelector(".board-player-more")!);
    expect(onShowMore).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/shaun/chordl && pnpm --filter @pepperhorn/chordl-board exec vitest run test/board-player.test.tsx`
Expected: FAIL — cannot resolve `../src/BoardPlayer`.

- [ ] **Step 3: Write the implementation**

Build `BoardPlayer.tsx` to satisfy the tests. Required behaviour, all of it covered above except where noted:

- Grid rendered with `computeRowSpans` and `GRID_TRACKS`, cards via `BoardCardContent`.
- `cursor` state — an index into `state.items`, skipping text cards in both directions.
- A `keydown` handler on the root: `ArrowRight`/`ArrowLeft` step and sound; `ArrowDown`/`" "` replay; `p` toggles via `onPlayingChange`. **`preventDefault` on Space**, or the page scrolls under the board. Arrows are handled *only* while `playing`, so outside play mode they belong to the page.
- Touch handlers translating a horizontal swipe past a threshold into the same step. Reading order, no row gesture.
- `playCurrent()` calls `resolveCardPlayback`, cancels the previous controller, then `startPlayback(midi, { mode: "block", instrument, onActiveChange })`, storing the controller in a ref. Cancel on unmount and when `playing` goes false.
- `onActiveChange` feeds `activePlaybackIndices` for the current card only.
- On `playing` becoming true, `preloadInstruments` with the distinct set from every card's `resolveCardPlayback`.
- Cursor drawn with the `:focus-visible` treatment used by card selection, class `board-player-cursor`.
- The `more` affordance renders per card only when `canShowMore`, class `board-player-more`, calling `onShowMore(item)`.
- Root gets `tabIndex={0}` and `className="board-player"` so it can receive keys.

Export `BoardPlayer` and `BoardPlayerProps` from `packages/chordl-board/src/index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/shaun/chordl && pnpm build && pnpm --filter @pepperhorn/chordl-board test:run`
Expected: PASS — the 8 new tests plus every existing board test.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/BoardPlayer.tsx packages/chordl-board/src/index.ts packages/chordl-board/test/board-player.test.tsx
git commit -m "feat: BoardPlayer — display-only board with play mode"
```

---

### Task 7: Wire it into the dev app and verify in a browser

jsdom cannot show whether this is usable. This task puts `BoardPlayer` on a real page and checks it by hand.

**Files:**
- Modify: `packages/chordl-react/dev/App.tsx`

**Interfaces:**
- Consumes: `BoardPlayer` from `@pepperhorn/chordl-board`.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Add the toggle and the component**

In `InteractiveInput`, add `const [boardPlaying, setBoardPlaying] = useState(false)` and render `BoardPlayer` in place of `ChordBoard` while `boardPlaying` is true, with a "Play" button next to the board toolbar bound to `setBoardPlaying`. Pass `canShowMore={false}` — the overlay is sub-project C, and there is nothing to open yet.

- [ ] **Step 2: Verify in a browser**

```bash
cd /home/shaun/chordl && pnpm dev -- --host 0.0.0.0
```

Read the log for the port. Then with the browse binary at `~/.claude/skills/gstack/browse/dist/browse`, seed a board via `localStorage["chordl-board"]` holding a mix of keyboard and guitar cards, `goto` the page (not `reload` — a reload races the write), and confirm by hand:

- `p` enters play mode; arrows step and sound; ↓ and Space replay; tapping a card jumps to it
- the cursor is visible and skips text cards
- notes highlight on the sounding card
- arrows scroll the page normally when play mode is off
- Space does not scroll the page when it is on

- [ ] **Step 3: Commit**

```bash
git add packages/chordl-react/dev/App.tsx
git commit -m "feat: play mode toggle for the board in the dev app"
```

---

## Self-Review

**Spec coverage.** Interaction table → Task 6. Component shape and the lifted layout module → Tasks 2 and 6. Audio, per-card patch and preloading → Tasks 1, 5, 6. Highlighting → Tasks 3 and 6. Legacy cards → Task 5. The `more` seam → Task 6. Reserved `bundleId` → Task 4. Out-of-scope items (play-all, B, C, D) have no task, correctly.

**Placeholders.** None: every code step carries real code, every test step a real command and expected result.

**Type consistency.** `resolveCardPlayback` returns `{ midi, instrument }` in Task 5 and is consumed under those names in Task 6. `preloadInstruments` takes `readonly PlaybackInstrument[]` in Task 1 and is called with an array of the board's distinct instruments in Task 6. `sizeFits` gains `rowOthers` and `columns` parameters in Task 2 and `ChordBoard`'s call site is updated in the same task.

**Known risk carried forward.** Task 5's rotation handling duplicates a rule that lives in `PianoChord`. The test pins the behaviour, but if `PianoChord`'s rotation changes, this can drift — the same class of problem the spec calls out. If Task 5 proves awkward, the better fix is to export the rotation from `chordl-core` and have both call it, rather than keeping two copies.
