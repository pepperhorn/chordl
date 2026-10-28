# Board card `ref` and lazy export deps (chordl-board 0.2.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@pepperhorn/chordl-board@0.2.1`. Cards gain an optional provenance `ref` that a host can attach through `BoardEditorHandle.setChord`. `BoardPlayer` stops pulling `html2canvas` and `jspdf` into a read-only bundle. `importBoardJson` drops non-string text fields and non-raster images. `BoardPlayer` gets on-screen Play/Stop, Prev, Replay and Next controls for touch and mouse readers.

**Architecture:** `ref` is one more optional `BoardItem` field. `importBoardJson` validates it with a `parseRef` in the style of `parseBundleId`, and `exportBoardJson` already writes it through its `...it` spread. It stays out of `renderConfig`, so it never reaches `computeCacheKey`. In `BoardEditor`, a single `pendingRef` state feeds `chordCardFields.ref`. `setChord(chord, { ref })` and opening a card for editing set it. Any write to the chord box through `handleChordInputChange`, Add and Done clear it. Because the live-edit mirror effect writes `chordCardFields` with an explicit `ref` key, a card's ref survives annotation and voicing changes and is cleared only when its chord text is retyped. The PNG and PDF handlers in `ChordBoard.tsx` get their libraries through `await import()`. The import path gets string guards on every text field it passes through. `BoardPlayer` already routes its keys through shared `step` / `replay` callbacks. On-screen buttons and a `forwardRef` handle call those same callbacks plus a new `setPlaying`.

**Tech Stack:** React 19, TypeScript 5.7 (`moduleResolution: "bundler"`), Vitest 4 with jsdom and @testing-library/react, pnpm 10 workspaces, GitHub Actions trusted publishing (`.github/workflows/release.yml`).

**Spec:** the host request recorded in this plan's Global Constraints. crf-staff (staff message composer) embeds `BoardEditor` and adds chords from a Directus `chords` collection. becreative (family-facing) renders saved boards read-only with `BoardPlayer`. This `ref` is a different field from the reserved `bundleId` in `docs/superpowers/specs/2026-09-10-board-player-and-chord-refs-design.md` §D. `bundleId` points at a hosted chordl bundle; `ref` records the host record a card came from.

## Global Constraints

- Package: `packages/chordl-board`, npm `@pepperhorn/chordl-board`, version `0.2.0` → `0.2.1`. `chordl-core` (0.5.2) and `chordl-react` (0.5.0) are not bumped or republished. Neither changes, and the published 0.2.0 already resolves its deps to exactly `@pepperhorn/chordl-core: 0.5.2` and `@pepperhorn/chordl-react: 0.5.0`.
- Hosts pin exact versions (`"@pepperhorn/chordl-board": "0.2.1"`, no caret).
- Type: `export interface BoardItemRef { source: string; id: string }`, `BoardItem.ref?: BoardItemRef`.
- Validation: keep `ref` only if it is a non-null, non-array object whose `source` and `id` both match `/^(?!\.+$)[A-Za-z0-9_.:-]{1,64}$/`. That is 1–64 chars from `A-Z a-z 0-9 _ . : -`, and not made entirely of dots, the same guard `parseBundleId` uses. Anything else is dropped silently. The result is a fresh `{ source, id }`, and any other keys are discarded. Directus UUIDs (`3f2a…-…`) and integer ids (`"42"`, string form) pass. Hosts must stringify integer ids. A number `42` is dropped.
- Schema stays `chordl.board/v3` (`BOARD_SCHEMA` unchanged, `READABLE_BOARD_SCHEMAS` unchanged). `ref` is optional and additive. 0.2.0 importers rebuild items field by field and drop it harmlessly. A v4 bump would instead make every 0.2.0 host (becreative is pinned to it) throw "needs a newer chordl" on every board staff save.
- `ref` is not part of `renderConfig` and therefore not of `computeCacheKey`, because it changes nothing about the image.
- `addItem`, `updateItem`, `copyItem`, `cutItem`, `pasteItem` and `duplicateItem` keep `ref`, because a duplicate is still that chord. They already spread the item, so no code changes there, only pinning tests.
- `ref` is stored regardless of `kind` (like `bundleId`). The editor never sets or clears it on a text card (`textCardFields` has no `ref` key).
- `html2canvas` and `jspdf` are loaded only through `await import(...)` inside `captureBoard` and `handleDownloadPdf` in `src/ChordBoard.tsx`. Static value imports of either are banned from all of `src/`. `import type` stays allowed. Use `(await import("html2canvas")).default` and `const { jsPDF } = await import("jspdf")`; jspdf's ESM build exports the named class. Export options stay byte-identical: `{ backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false }` and `{ orientation, unit: "px", format: [w, h], compress: true }`.
- `html2canvas` and `jspdf` stay in `dependencies` (same ranges `^1.4.1` and `^4.2.1`) because the dynamic import still needs them installed.
- Import sanitising: an item's `title`, `subheading` and `footerText`, and meta's `title`, `subtitle` and `footer`, are kept only if `typeof === "string"`; otherwise they become `undefined`, silently. A meta that is not a plain object (`null`, string, array, number) becomes `{}`. Unknown meta keys keep passing through, as today. `image` is kept only if it matches `/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/`, which rejects `data:image/svg+xml` and everything else. This is a deliberate narrowing: an old export whose text card holds an SVG data URI loads without that picture.
- Already type-checked on import, so no change: `nl` (`typeof === "string"`, required for chord cards), `icon` (string with a known prefix), `instrument` (non-empty string), `playbackInstrument` (allow-list), `playbackHighlightColor` (hex regex), `id`, `kind`, `display`, `size`, `level`, `bundleId`, `position`, `playbackNotes`, `arpeggioBpm`, `breakAfter`.
- Player controls: `BoardPlayerProps.showControls?: boolean`, default `true`. Container `div.chordl-player-controls` (`role="toolbar"`, `aria-label="Playback"`). Buttons have these classes and aria-labels: `chordl-player-play` ("Play board" / "Stop playing", `aria-pressed={playing}`), `chordl-player-prev` ("Previous chord"), `chordl-player-replay` ("Replay chord"), `chordl-player-next` ("Next chord"). Prev, Replay and Next render only while `playing`, and are `disabled` when the board has no playable card. Every button is at least `44px × 44px`, with a white or light background (no dark fills), Poppins, and visible text labels "Play"/"Stop", "Prev", "Replay", "Next".
- `BoardPlayer` becomes `forwardRef<BoardPlayerHandle, BoardPlayerProps>` with `export interface BoardPlayerHandle { play(): void; stop(): void; next(): void; prev(): void; replay(): void }`. It is cheap because `step` and `replay` already exist as callbacks. `next`, `prev` and `replay` do nothing while not playing, the same as the keys.
- Comments explain *why*, matching the surrounding density. Relative imports keep explicit `.js` extensions (`test/esm-specifiers.test.ts`).
- Order: `pnpm build` before `pnpm lint` / `pnpm test:run` (packages resolve each other from `dist`).
- Local baseline: `pnpm --filter @pepperhorn/chordl-board test:run` shows 261 passed, 3 failed under Node 25. The failures are `storage.test.ts` "writes the board through on the happy path", "warns with the byte size when no onError is supplied", and `board-editor.test.tsx` "loads the host's board, saves edits back once…". Node 25's native `localStorage` shadows jsdom's, so these pass on Node 22 (CI). Run under Node 22 to get a clean signal, or treat exactly those 3 as pre-existing.
- Work on branch `feat/board-ref-lazy-export` off `main`. Release goes through PR → merge → tag (Task 6).

## Review Focus

1. **Opening a card that has a `ref` for editing.** The live-edit mirror effect (`BoardEditor.tsx:1069-1075`) writes `cardFields` the moment `editingItemId` is set. If `chordCardFields.ref` were `undefined` there, merely opening a card would strip its ref. Expected: the ref survives. Test in Task 2: "keeps a card's ref while it is open for editing and only annotations change".
2. **Annotation and voicing toggles change `nl` but are not a different chord.** `nl` is `input + octave + detailsModifiers` or `pianoVariantNl` (`BoardEditor.tsx:822`), so a note-names toggle rewrites `nl`. Expected: the ref is kept. Only a chord-box edit (typing, or the quality picker, both through `handleChordInputChange`) clears it. Covered by the same Task 2 test plus "clears a card's ref when its chord text is retyped".
3. **Arrow keys right after tapping or clicking the on-screen Play.** Focus is then on the Play button. `handleKeyDown` ignores events whose target is not the root (`BoardPlayer.tsx:282`), and the focus-grab effect (`:269-274`) stands down because focus is already inside. So a keyboard user who clicked Play would find the arrows dead. Expected: arrows work immediately. The play toggle focuses the root after turning play mode on. Test in Task 5: "arrow keys work right after the on-screen Play".
4. **Imported meta that is not an object** (`"meta": "x"`, `[]`, `null`, `5`). Today `parseMeta` spreads it and could return a string where `BoardMeta` is expected. Expected: `{}` and no throw. Test in Task 4: "replaces a meta that is not an object with an empty one".
5. **First PDF/PNG click after the lazy split.** The `exporting` guard must already be set before the `await import`, so a double-click cannot start two exports. The existing card-toolbar test "is gone while an export is running" must still pass. If the extra module-load tick makes its 40 ms wait flaky, change the wait to `waitFor(() => expect(settleCapture).toBeTruthy())`. Don't change the component to fit. Test in Task 3: "loads html2canvas only on the first PNG export".

---

### Task 1: `BoardItem.ref` type, import validation, export and cache key

**Files:**
- Modify: `packages/chordl-board/src/types.ts:76-170` (add `BoardItemRef` above `BoardItem`; add `ref?` after `bundleId` at :138 with a doc comment: host provenance, opaque, validated on import, not in the cache key, distinct from `bundleId`)
- Modify: `packages/chordl-board/src/io.ts:166` (add `parseRef` after `parseBundleId`), `:268` (add `ref: parseRef(raw.ref)` to the rebuilt item), and the `exportBoardJson` comment block near `level` (one line saying `ref` is deliberately absent from `renderConfig`)
- Modify: `packages/chordl-board/src/index.ts` (add `BoardItemRef` to the `export type { … } from "./types.js"` list)
- Test: `packages/chordl-board/test/io.test.ts` (new `describe("ref", …)` after `describe("bundleId", …)`)
- Test: `packages/chordl-board/test/useChordBoard.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `export interface BoardItemRef { source: string; id: string }` (exported from the package root), `BoardItem.ref?: BoardItemRef`, and private `function parseRef(value: unknown): BoardItemRef | undefined` in `io.ts`.

- [ ] **Step 1: Write the failing tests** in `test/io.test.ts`, using the file's existing `board()` / `BOARD_SCHEMA` helpers:

```ts
describe("ref", () => {
  const uuid = "3f2a9c1e-7b4d-4e8a-9f00-1c2d3e4f5a6b";
  const withRef = (ref: unknown) => JSON.stringify({
    schema: BOARD_SCHEMA, meta: {}, items: [{ id: "a", nl: "C", ref }],
  });

  it("survives an export/import round trip", async () => {
    const state = board([{ id: "a", nl: "Dm7", ref: { source: "chords", id: uuid } }]);
    const json = JSON.parse(await exportBoardJson(state));
    expect(json.schema).toBe("chordl.board/v3");
    expect(json.items[0].ref).toEqual({ source: "chords", id: uuid });
    expect(importBoardJson(JSON.stringify(json)).items[0].ref).toEqual({ source: "chords", id: uuid });
  });

  it("accepts a stringified integer id and a namespaced source", () => {
    expect(importBoardJson(withRef({ source: "directus:chords", id: "42" })).items[0].ref)
      .toEqual({ source: "directus:chords", id: "42" });
  });

  it("keeps only source and id", () => {
    const ref = importBoardJson(withRef({ source: "chords", id: "42", extra: "x", __proto__: { polluted: 1 } })).items[0].ref;
    expect(ref).toEqual({ source: "chords", id: "42" });
    expect(Object.keys(ref!)).toEqual(["source", "id"]);
  });

  it("drops a malformed ref without throwing", () => {
    for (const bad of [
      null, "chords:42", ["chords", "42"], { source: "chords" }, { id: "42" },
      { source: "chords", id: 42 }, { source: "", id: "42" }, { source: "chords", id: "" },
      { source: "chords", id: "a".repeat(65) }, { source: "chords/../x", id: "42" },
      { source: "chords", id: ".." }, { source: "chords", id: "a b" },
    ]) expect(importBoardJson(withRef(bad)).items[0].ref).toBeUndefined();
    expect(importBoardJson(withRef({ source: "chords", id: "a".repeat(64) })).items[0].ref?.id).toBe("a".repeat(64));
  });

  it("stays out of the render cache key", async () => {
    const plain = JSON.parse(await exportBoardJson(board([{ id: "a", nl: "C" }])));
    const reffed = JSON.parse(await exportBoardJson(board([{ id: "a", nl: "C", ref: { source: "chords", id: "42" } }])));
    expect(reffed.items[0].cacheKey).toBe(plain.items[0].cacheKey);
    expect(reffed.items[0].renderConfig).not.toHaveProperty("ref");
  });

  it("is kept on a text card", () => {
    const raw = JSON.stringify({ schema: BOARD_SCHEMA, meta: {}, items: [{ id: "t", kind: "text", title: "Intro", ref: { source: "lessons", id: "7" } }] });
    expect(importBoardJson(raw).items[0].ref).toEqual({ source: "lessons", id: "7" });
  });
});
```

The `__proto__` key in an object literal sets the prototype instead of creating an own key. Write that case so the JSON really carries an own `"__proto__"` key, by building the string by hand: `'{"source":"chords","id":"42","__proto__":{"polluted":1}}'` spliced into the item.

In `test/useChordBoard.test.tsx`, add `ref: { source: "chords", id: "42" }` to the card literal in the existing tests "carries every card field through addItem", "keeps every field through copy and paste" and "keeps every field through duplicateItem, inserted after the source". Their `toMatchObject(card)` assertions then pin `ref` through each path. If one of them builds its card separately, add the field there.

- [ ] **Step 2: Run to verify the failures**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/io.test.ts test/useChordBoard.test.tsx`
Expected: FAIL in "survives an export/import round trip", "accepts a stringified integer id…", "keeps only source and id" and "is kept on a text card", because `importBoardJson` drops `ref`. Vitest does not typecheck, so the missing `ref` field shows up only at `lint`. The useChordBoard cases already pass (the hooks spread the item). That is expected; they are pins.

- [ ] **Step 3: Implement** `BoardItemRef`, `BoardItem.ref`, `parseRef(value: unknown): BoardItemRef | undefined` (regex from Global Constraints as a module `const REF_TOKEN`, returns `{ source, id }` built fresh), the `ref: parseRef(raw.ref)` line, the `exportBoardJson` comment, and the `index.ts` type export.

- [ ] **Step 4: Run tests and lint**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/io.test.ts test/useChordBoard.test.tsx && pnpm --filter @pepperhorn/chordl-board lint`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/types.ts packages/chordl-board/src/io.ts packages/chordl-board/src/index.ts packages/chordl-board/test/io.test.ts packages/chordl-board/test/useChordBoard.test.tsx
git commit -m "feat(board): optional provenance ref on cards, validated on import"
```

---

### Task 2: `setChord(chord, { ref })` and ref lifetime in `BoardEditor`

The only place a card's `nl` changes after creation is `BoardEditor`'s live-edit mirror effect (`src/BoardEditor.tsx:1069-1075`). It writes `chordCardFields` (`:806-845`) through `board.updateItem`. `ChordBoard.tsx` has no `nl` writer of its own; `useChordBoard.updateItem` is a generic merge. So ref lifetime is decided entirely by what `chordCardFields.ref` holds.

**Files:**
- Modify: `packages/chordl-board/src/BoardEditor.tsx`
  - `:36-39` `BoardEditorHandle`: `setChord: (chord: string, opts?: { ref?: BoardItemRef }) => void`. Doc: the ref attaches to the card created by the next "+ Add to board". It is dropped if the chord box is edited first, on "Done", or by a later `setChord` without one.
  - near `:592`: `const [pendingRef, setPendingRef] = useState<BoardItemRef | null>(null);` with a comment on the lifetime rule.
  - `:806-845` `chordCardFields`: add `ref: pendingRef ?? undefined` as an explicit key (so `updateItem`'s merge can clear it, as `icon` does in `textCardFields`), and add `pendingRef` to the deps.
  - `:874` `stopEditing`: `setPendingRef(null)`.
  - `:920` `handleChordInputChange`: `setPendingRef(null)`. This covers typing (`:1139`) and the quality picker (`:1222`).
  - `:928` `handleAddToBoard`: after `board.addItem(chordCardFields)`, call `setPendingRef(null)`. The ref is consumed by one Add.
  - `:1011` `handleEditBoardItem`: `setPendingRef(isTextCard(item) ? null : item.ref ?? null)`. `setChordInput` (`:1019`) is the raw writer and does not touch `pendingRef`, so this is the only place it is set when a card is opened.
  - `:1077-1082` `useImperativeHandle`: `setChord(chord, opts) { if (editingItemId) stopEditing(); handleChordInputChange(chord); setPendingRef(opts?.ref ?? null); }`. React batches the three writes, and the last `setPendingRef` wins.
- Modify: `README.md:687-689` (the host example comment: `setChord("Dm7", { ref: { source: "chords", id: chordId } })` and one sentence on when the ref is dropped)
- Modify: `scripts/verify-board-package.mjs` (the `App.tsx` template's `setChord("Dm7")` becomes `setChord("Dm7", { ref: { source: "chords", id: "42" } })`, so the packed `.d.ts` is typechecked)
- Test: `packages/chordl-board/test/board-editor.test.tsx`

**Interfaces:**
- Consumes: `BoardItemRef`, `BoardItem.ref` (Task 1).
- Produces: `BoardEditorHandle.setChord(chord: string, opts?: { ref?: BoardItemRef }): void`.

- [ ] **Step 1: Write the failing tests** in `test/board-editor.test.tsx`. Use the file's `Host`, `chordBox`, `.btn-add-to-board`, `.chordl-board-action-edit` and `save.mock.lastCall` patterns; `const REF = { source: "chords", id: "3f2a9c1e-7b4d-4e8a-9f00-1c2d3e4f5a6b" }`. The "Done" control is whatever `stopEditing` is bound to in the edit banner (find its class in the JSX; do not add one just for the test):

```ts
it("attaches a host ref to the next added card only", async () => {
  // setChord("Dm7", { ref: REF }) → Add → items[1].nl "Dm7", items[1].ref toEqual REF
  // Add again (box still "Dm7") → items[2].ref toBeUndefined()
});
it("drops the ref when the chord box is edited before adding", async () => {
  // setChord("Dm7", { ref: REF }); fireEvent.change(chordBox, { target: { value: "Dm9" } }); Add
  // → last item nl "Dm9", ref undefined
});
it("drops a pending ref when setChord is called again without one", async () => {
  // setChord("Dm7", { ref: REF }); setChord("G7"); Add → last item ref undefined
});
it("attaches the ref to the new card, not the card that was being edited", async () => {
  // open "saved" for edit; setChord("Dm7", { ref: REF }); Add
  // → items[0].ref undefined, items[0].title "Original"; items[1].ref toEqual REF
});
it("keeps a card's ref while it is open for editing and only annotations change", async () => {
  // Host initial item gets ref: REF (add an optional `initialState` prop to Host; default stays `initial`)
  // open it for edit; toggle the note-names control (it rewrites nl); wait for a save
  // → items[0].ref toEqual REF and items[0].nl !== "C"
});
it("clears a card's ref when its chord text is retyped", async () => {
  // same seeded card; open for edit; change chord box to "Am" → items[0].nl "Am", items[0].ref undefined
});
```

- [ ] **Step 2: Run to verify the failures**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/board-editor.test.tsx`
Expected: the first and fourth new tests fail (`ref` undefined on the added card). The "keeps … while editing" test may already pass, because `updateItem` merges and nothing writes `ref` yet. That is fine: it is a guard against Step 3 regressing it. The pre-existing Node 25 failure in this file is unrelated (Global Constraints).

- [ ] **Step 3: Implement** the `BoardEditor.tsx` changes listed under Files, then update `README.md` and `scripts/verify-board-package.mjs`.

- [ ] **Step 4: Run tests and lint**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/board-editor.test.tsx && pnpm --filter @pepperhorn/chordl-board lint`
Expected: PASS (apart from the documented Node 25 baseline case if not on Node 22).

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/BoardEditor.tsx packages/chordl-board/test/board-editor.test.tsx README.md scripts/verify-board-package.mjs
git commit -m "feat(board): setChord can attach a host ref to the next added card"
```

---

### Task 3: Load html2canvas and jspdf on demand

`BoardPlayer.tsx` imports `ChordBoard.js` for `BoardCardContent` and the chrome, and `ChordBoard.tsx:13-14` imports `html2canvas` and `jspdf` statically. So a read-only player bundle carries about 600 KB of export code it can never run.

**Files:**
- Modify: `packages/chordl-board/src/ChordBoard.tsx:13-14` (delete both imports), `:744-755` `captureBoard` (`const { default: html2canvas } = await import("html2canvas");` after the rAF wait), `:777-806` `handleDownloadPdf` (`const { jsPDF } = await import("jspdf");` after `captureBoard()` returns a canvas). Add a one-line comment at the old import site saying why both are dynamic: the player shares this module.
- Modify: `packages/chordl-board/tsconfig.json` comment (`:5-7`) only if it still reads as if the libs are imported statically. The `moduleResolution: "bundler"` reasoning still holds for the dynamic import types.
- Modify: `scripts/verify-board-package.mjs` (after the pack loop, add a dist check, see Step 3)
- Create: `packages/chordl-board/test/lazy-export.test.tsx`

**Interfaces:**
- Consumes: nothing from Tasks 1–2.
- Produces: no API change.

- [ ] **Step 1: Write the failing tests** in `test/lazy-export.test.tsx`:

```ts
const loaded = vi.hoisted(() => ({ html2canvas: 0, jspdf: 0, saved: [] as string[] }));
// vi.mock factories run on first import of the module, so the counters say
// whether anything actually pulled the library in, not just whether it was called.
vi.mock("html2canvas", () => { loaded.html2canvas++; return { default: vi.fn(async () => fakeCanvas()) }; });
vi.mock("jspdf", () => {
  loaded.jspdf++;
  class FakePdf { addImage() {} save(name: string) { loaded.saved.push(name); } }
  return { jsPDF: FakePdf, default: FakePdf };
});
// fakeCanvas(): { width: 200, height: 100, toDataURL: () => "data:image/png;base64,", toBlob: (cb) => cb(null) }

describe("export libraries load on demand", () => {
  it("BoardPlayer renders without loading html2canvas or jspdf", async () => {
    const { BoardPlayer } = await import("../src/BoardPlayer.js");
    render(<BoardPlayer items={[{ id: "c", nl: "C" }]} meta={{}} playing={false} onPlayingChange={() => {}} />);
    expect(loaded).toMatchObject({ html2canvas: 0, jspdf: 0 });
  });
  it("ChordBoard renders without loading them either", async () => { /* render ChordBoard items=[C]; same assertion */ });
  it("loads html2canvas only on the first PNG export", async () => {
    // click .chordl-board-export-png → waitFor(loaded.html2canvas === 1); expect(loaded.jspdf).toBe(0)
  });
  it("loads jspdf on PDF export and saves with the board's filename", async () => {
    // meta { title: "Lesson One" }; click .chordl-board-export-pdf → waitFor(loaded.saved).toEqual(["lesson-one.pdf"]); loaded.jspdf === 1
  });
});
```

Import `ChordBoard` dynamically inside its tests too (`await import("../src/ChordBoard.js")`), not at the top of the file, so the first test's counter reflects BoardPlayer's graph alone. Keep the tests in this order; the counters are module-level per file.

- [ ] **Step 2: Run to verify the failures**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/lazy-export.test.tsx`
Expected: FAIL in the first two tests with `html2canvas: 1, jspdf: 1` (the static imports run the factories).

- [ ] **Step 3: Implement** the two dynamic imports in `ChordBoard.tsx`. Then, in `scripts/verify-board-package.mjs`, assert on the built output (which CI runs after `pnpm build`). No file in `packages/chordl-board/dist/**/*.js` may match `/^\s*import\s+(?:[^;]*?\sfrom\s+)?["'](?:html2canvas|jspdf)["']/m`, and `dist/ChordBoard.js` must contain `import("html2canvas")` and `import("jspdf")`. The failure message names the file.

- [ ] **Step 4: Run tests, build and the packed check**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/lazy-export.test.tsx test/card-toolbar.test.tsx test/pdf-size.test.ts test/export-chrome.test.tsx && pnpm build && node scripts/verify-board-package.mjs`
Expected: PASS, and the script prints both "Packed editor/player SSR…" and "Packed consumer typecheck and Vite build pass". If "is gone while an export is running" flakes, apply the Review Focus 5 change to the test only.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/ChordBoard.tsx packages/chordl-board/test/lazy-export.test.tsx scripts/verify-board-package.mjs packages/chordl-board/tsconfig.json
git commit -m "perf(board): load html2canvas and jspdf only when exporting"
```

---

### Task 4: Drop non-string text and non-raster images on import

Verified today: `title: 5` on an item and `meta.title: { x: 1 }` both survive `importBoardJson`, and React throws "Objects are not valid as a React child" when the heading renders the object.

**Files:**
- Modify: `packages/chordl-board/src/io.ts`. Add `function parseText(value: unknown): string | undefined` (string or `undefined`). Use it for `title`, `subheading` and `footerText` in the item rebuild (`:255-257`). In `parseMeta` (`:225`), first replace a value that is not a plain object (`typeof !== "object"`, `null`, or `Array.isArray`) with `{}`, then override `title`, `subtitle` and `footer` with `parseText(...)` alongside the existing `columns` rule. Narrow `parseImage` (`:214`) to the regex in Global Constraints, and update its docblock to say SVG is refused on import as well.
- Modify: `packages/chordl-board/src/image.ts:203-204`. Rewrite the "asymmetry with io.ts's `parseImage`" comment: both paths now refuse SVG.
- Test: `packages/chordl-board/test/io.test.ts`

**Interfaces:**
- Consumes: nothing from Tasks 1–3 (touches `io.ts` lines near Task 1's, so do it after Task 1).
- Produces: no API change. Private `parseText`.

- [ ] **Step 1: Write the failing tests** in `test/io.test.ts`, using its `rawBoard` helper and the `describe("importBoardJson — board meta")` helper `board(meta)`:

```ts
describe("import text and image sanitising", () => {
  it("drops non-string card text", () => {
    const back = importBoardJson(rawBoard([
      { id: "a", nl: "C", title: 5, subheading: { x: 1 }, footerText: ["f"] },
      { id: "b", kind: "text", title: null, subheading: true, footerText: "kept" },
    ], BOARD_SCHEMA));
    expect(back.items[0]).toMatchObject({ title: undefined, subheading: undefined, footerText: undefined });
    expect(back.items[1]).toMatchObject({ title: undefined, subheading: undefined, footerText: "kept" });
  });
  it("keeps string card text, including the empty string", () => {
    const back = importBoardJson(rawBoard([{ id: "a", nl: "C", title: "", subheading: "Shell", footerText: "Let ring" }]));
    expect(back.items[0]).toMatchObject({ title: "", subheading: "Shell", footerText: "Let ring" });
  });
  it("drops non-string meta text and keeps the rest", () => {
    const meta = importBoardJson(board({ title: { x: 1 }, subtitle: 7, footer: "Practice daily", columns: 3, extra: "kept" })).meta;
    expect(meta).toMatchObject({ title: undefined, subtitle: undefined, footer: "Practice daily", columns: 3, extra: "kept" });
  });
  it("replaces a meta that is not an object with an empty one", () => {
    for (const bad of ["x", [], null, 5]) expect(importBoardJson(board(bad)).meta, String(bad)).toEqual({ columns: undefined });
  });
  it("keeps only base64 png, jpeg, webp and gif images", () => {
    const ok = ["png", "jpeg", "webp", "gif"].map((t) => `data:image/${t};base64,AAAA`);
    const bad = [
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
      "data:image/svg+xml,<svg onload=alert(1)>",
      "data:image/png,AAAA",                // not base64
      "data:image/png;base64,AA AA",        // illegal char
      "data:image/bmp;base64,AAAA",
      "DATA:image/png;base64,AAAA",
    ];
    const back = importBoardJson(rawBoard([...ok, ...bad].map((image, i) => ({ id: `t${i}`, kind: "text", image }))));
    expect(back.items.map((i) => i.image)).toEqual([...ok, ...bad.map(() => undefined)]);
  });
});
```

The `toEqual({ columns: undefined })` in the non-object meta test matches `parseMeta`'s existing habit of writing `columns: undefined`. If the implementation omits the key, assert `toEqual({})` instead, and pick one. The existing test "drops an image that is not an inline image data URI" must still pass unchanged.

- [ ] **Step 2: Run to verify the failures**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/io.test.ts`
Expected: FAIL on the four sanitising tests and the image test (`svg+xml`, non-base64 and bmp currently pass through). "keeps string card text" already passes.

- [ ] **Step 3: Implement** `parseText`, the `parseMeta` changes and the narrowed `parseImage`, and rewrite the `image.ts` comment.

- [ ] **Step 4: Run the import and card tests, then lint**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/io.test.ts test/text-cards.test.tsx test/image.test.ts && pnpm --filter @pepperhorn/chordl-board lint`
Expected: PASS. `text-cards.test.tsx`'s gif fixture (`data:image/gif;base64,R0lG…`) still matches.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/io.ts packages/chordl-board/src/image.ts packages/chordl-board/test/io.test.ts
git commit -m "fix(board): drop non-string text and non-raster images on import"
```

---

### Task 5: On-screen controls and an imperative handle for `BoardPlayer`

Play mode today has only `p`, the arrows, Space and swipes (`BoardPlayer.tsx:279-346`), and the host draws its own Play toggle. The key handler already delegates to shared callbacks: `step(direction)` (`:213`) and `replay()` (`:221`). Both skip text cards through `nextPlayable` (`:110`), and both stay put at either end, replaying the current chord. The buttons and the handle reuse exactly those. Only the play toggle is new, as one function.

**Files:**
- Modify: `packages/chordl-board/src/BoardPlayer.tsx`
  - `:71-98` `BoardPlayerProps`: add `showControls?: boolean` with a doc comment. Add `export interface BoardPlayerHandle` per Global Constraints.
  - `:133` `export function BoardPlayer(...)` becomes `export const BoardPlayer = forwardRef<BoardPlayerHandle, BoardPlayerProps>(function BoardPlayer({ …, showControls = true }, ref) { … })`.
  - New `const setPlaying = useCallback((next: boolean) => { if (!next) cancelCurrent(); onPlayingChange(next); }, [cancelCurrent, onPlayingChange])`. Stop cancels immediately rather than waiting for the host to re-render with `playing=false`. The `p` branch (`:284-294`) becomes `setPlaying(!playing)`, keeping its `preventDefault`/`stopPropagation`.
  - `useImperativeHandle(ref, () => ({ play: () => setPlaying(true), stop: () => setPlaying(false), next: () => { if (playing) step(1); }, prev: () => { if (playing) step(-1); }, replay: () => { if (playing) replay(); } }), [playing, setPlaying, step, replay])`.
  - Render the toolbar as the root's first child, before `.board-player-panel`, only when `showControls`. The play button's `onClick` is `setPlaying(!playing)` followed by `rootRef.current?.focus()` when turning on (Review Focus 3). Prev, Next and Replay call `step(-1)`, `step(1)` and `replay()`. Add the toolbar CSS (`.chordl-player-controls` flex row, centered, `gap: 8px`, `margin: 0 0 12px`; buttons `min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; margin: 0;`, white background, light border, `font-family: Poppins, sans-serif`) to `PLAYER_STYLES`.
- Modify: `packages/chordl-board/src/index.ts` (add `BoardPlayerHandle` to the `export type { BoardPlayerProps }` line)
- Modify: `README.md:694-700`. The `MessageBoardPlayer` example drops its own Play button, because the player draws one. Add one sentence on `showControls={false}` and the `BoardPlayerHandle` ref.
- Modify: `scripts/verify-board-package.mjs`. In the smoke SSR, assert `player.includes("chordl-player-play")`. In `App.tsx`, add a `useRef<BoardPlayerHandle>(null)` passed as `ref` so the packed types are checked.
- Test: `packages/chordl-board/test/board-player.test.tsx` (reuse its `startPlayback`/`cancel` mocks, the `items` fixture `[a: C, t: text "Verse", b: G]`, `player()` and `noop`)

**Interfaces:**
- Consumes: nothing from Tasks 1–4.
- Produces: `BoardPlayerProps.showControls?: boolean`, `BoardPlayerHandle { play(): void; stop(): void; next(): void; prev(): void; replay(): void }`, and `BoardPlayer` as a `forwardRef` component (props unchanged, so existing hosts compile).

- [ ] **Step 1: Write the failing tests** in a new `describe("BoardPlayer on-screen controls")` in `test/board-player.test.tsx`:

```ts
const btn = (cls: string) => document.querySelector(`.${cls}`) as HTMLButtonElement;

it("draws a labelled Play toggle that asks the host to start", () => {
  const onPlayingChange = vi.fn();
  render(<BoardPlayer items={items} playing={false} onPlayingChange={onPlayingChange} />);
  expect(btn("chordl-player-play").getAttribute("aria-label")).toBe("Play board");
  expect(btn("chordl-player-next")).toBeNull();          // transport only while playing
  fireEvent.click(btn("chordl-player-play"));
  expect(onPlayingChange).toHaveBeenCalledWith(true);
});
it("Next steps over the text card to the second chord and sounds it", async () => {
  render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
  fireEvent.click(btn("chordl-player-next"));
  await waitFor(() => expect(startPlayback).toHaveBeenLastCalledWith([55, 59, 62], expect.anything()));
  expect(document.querySelector(".board-player-cursor")!.getAttribute("data-board-id")).toBe("b");
});
it("Prev and Replay drive the same cursor as the keys", async () => {
  // Next → Prev → cursor "a", last call [60,64,67]; Replay → one more call, cursor still "a"
});
it("Stop cancels the sounding chord and asks the host to stop", async () => {
  const onPlayingChange = vi.fn();
  render(<BoardPlayer items={items} playing onPlayingChange={onPlayingChange} />);
  fireEvent.click(btn("chordl-player-replay"));
  await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(1));
  cancel.mockClear();
  fireEvent.click(btn("chordl-player-play"));            // aria-label "Stop playing" now
  expect(cancel).toHaveBeenCalled();                     // before any host re-render
  expect(onPlayingChange).toHaveBeenCalledWith(false);
});
it("arrow keys work right after the on-screen Play", () => {
  // stateful host (useState) wrapping BoardPlayer; click Play → document.activeElement === player();
  // fireEvent.keyDown(player(), { key: "ArrowRight" }) → startPlayback called with [55,59,62]
});
it("meets the 44px touch target and hides with showControls={false}", () => {
  // each .chordl-player-controls button's inline/computed min-width/min-height is "44px" (assert the CSS text in the <style> contains the rule if jsdom gives no computed style)
  // rerender showControls={false} → .chordl-player-controls null; p key still toggles
});
it("exposes play/stop/next/prev/replay through a ref", async () => {
  // createRef<BoardPlayerHandle>(); playing=false: ref.next() → startPlayback not called;
  // ref.play() → onPlayingChange(true); with playing: ref.next() → cursor "b"; ref.stop() → cancel + onPlayingChange(false)
});
it("disables the transport on a board of only text cards", () => {
  // items [{kind:"text"}] playing → prev/replay/next all .disabled === true
});
```

- [ ] **Step 2: Run to verify the failures**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/board-player.test.tsx`
Expected: the new tests FAIL (no `.chordl-player-*` elements, and no ref). The existing ones still pass.

- [ ] **Step 3: Implement** the `BoardPlayer.tsx` changes, then the `index.ts` export, README and verify-script updates.

- [ ] **Step 4: Run the player tests and lint**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/board-player.test.tsx test/board-player-error-boundary.test.tsx test/lazy-export.test.tsx && pnpm --filter @pepperhorn/chordl-board lint`
Expected: PASS. The existing "takes focus when play mode is entered" and "does not steal focus back on a later re-render" still pass. The play button lives inside the root, so the focus effect's "focus already inside" guard is unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/BoardPlayer.tsx packages/chordl-board/src/index.ts packages/chordl-board/test/board-player.test.tsx README.md scripts/verify-board-package.mjs
git commit -m "feat(board): on-screen play controls and a ref handle for BoardPlayer"
```

---

### Task 6: Release chordl-board 0.2.1

**Files:**
- Modify: `packages/chordl-board/package.json` (`"version": "0.2.1"`; nothing else)
- Modify: `CHANGELOG.md` (new section above `## 2026-10-28 — embedded board editor and player`)
- Modify: `README.md:661` (`chordl-board@0.2.0` → `0.2.1` in the embed section's lead sentence)

**Interfaces:**
- Consumes: Tasks 1–5 merged on the branch.
- Produces: `@pepperhorn/chordl-board@0.2.1` on npm.

- [ ] **Step 1: Bump and document.** Set the version. Then add this to `CHANGELOG.md`:

```markdown
## 2026-10-28 — chordl-board 0.2.1

Only `@pepperhorn/chordl-board` is published. It depends on the already-published
`chordl-core@0.5.2` and `chordl-react@0.5.0`; neither changes. Hosts pin `0.2.1` exactly.

- **Card provenance `ref`:** `BoardItem.ref?: { source, id }` records where a card
  came from (e.g. a Directus `chords` row). Validated on import (each part 1–64 of
  `A-Za-z0-9_.:-`, not all dots; anything else is dropped), written on export, kept
  by copy/paste/duplicate, and not part of the render cache key. Boards stay
  `chordl.board/v3`; 0.2.0 reads them and ignores `ref`.
- **`BoardEditorHandle.setChord(chord, { ref })`:** the ref attaches to the next
  "+ Add to board" of that chord, and is dropped if the chord box is edited first.
  Retyping an existing card's chord clears its ref; annotation and voicing changes keep it.
- **Smaller player bundles:** `html2canvas` and `jspdf` load only when a PNG/PDF
  export starts, so `BoardPlayer` no longer bundles them.
- **Player controls:** `BoardPlayer` draws Play/Stop, and while playing Prev, Replay
  and Next (44px targets, labelled, `chordl-player-*` classes). Hide them with
  `showControls={false}`. A `ref` exposes `BoardPlayerHandle { play, stop, next,
  prev, replay }`. Hosts that drew their own Play button should drop it or hide these.
- **Safer import:** `importBoardJson` drops non-string card and board text, a
  non-object `meta`, and any image that is not a base64 PNG, JPEG, WebP or GIF data
  URI. SVG pictures in old exports no longer load.
```

- [ ] **Step 2: Full verification under Node 22** (CI's version)

Run: `pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test:run && node scripts/verify-board-package.mjs`
Expected: all green, including the 3 Node 25 baseline cases. Also confirm the packed manifest:
`pnpm --filter @pepperhorn/chordl-board pack --pack-destination /tmp/cb && tar -xOzf /tmp/cb/pepperhorn-chordl-board-0.2.1.tgz package/package.json | grep -E '"version"|chordl-(core|react)'`
Expected: `"version": "0.2.1"`, `"@pepperhorn/chordl-core": "0.5.2"`, `"@pepperhorn/chordl-react": "0.5.0"`.

- [ ] **Step 3: Commit and open the PR**

```bash
git add packages/chordl-board/package.json CHANGELOG.md README.md
git commit -m "chore(board): release 0.2.1"
git push -u origin feat/board-ref-lazy-export
gh pr create --base main --title "feat(board): card ref and lazy export deps (0.2.1)"
```

- [ ] **Step 4: After the PR is merged to `main`, tag and publish** (`release.yml`: tag `<dir>@<version>` on a main commit; the workflow checks the manifest version and that the commit is on main and the version is not on npm, then builds, tests, packs and publishes with OIDC provenance):

```bash
git checkout main && git pull
git tag chordl-board@0.2.1 && git push origin chordl-board@0.2.1
```

Then run `gh run watch` on the Release run, then `npm view @pepperhorn/chordl-board@0.2.1 version dependencies`.
Expected: `0.2.1`, with `chordl-core: '0.5.2'` and `chordl-react: '0.5.0'`.

- [ ] **Step 5: Hand off to hosts.** crf-staff and becreative bump to `"@pepperhorn/chordl-board": "0.2.1"` (exact). becreative removes its own Play button (or passes `showControls={false}`) and should pass stored boards through `importBoardJson` before rendering, because the new sanitising only guards that path. crf-staff passes `{ ref: { source: "chords", id: String(row.id) } }` to `setChord`.

---

## Self-review

1. **Spec coverage.** `ref` type, `parseRef`, export, cache-key exclusion, copy/paste/duplicate: Task 1. Clear-on-`nl`-change, with the exact write sites, and `setChord` opts: Task 2. Schema decision: Global Constraints. Lazy deps and guard test: Task 3. String/image sanitising, with the already-checked fields listed: Task 4. Player controls, `showControls`, `BoardPlayerHandle` (chosen, because `step`/`replay` already exist) and shared handlers: Task 5. Bump, other packages, build, publish, exact pins: Task 6.
2. **Step scan.** Each code step names its file, lines, signature and values. Test bodies are given where values matter and sketched as assertions elsewhere.
3. **Type consistency.** `BoardItemRef { source: string; id: string }` is used throughout. `setChord(chord: string, opts?: { ref?: BoardItemRef })` matches in Task 2, README and the verify script. `pendingRef: BoardItemRef | null` maps to `chordCardFields.ref: BoardItemRef | undefined`. `BoardPlayerHandle` method names match Global Constraints, Task 5 and the CHANGELOG text. The `chordl-player-*` class names are identical across Global Constraints, tests and the verify script.
4. **Review Focus.** Each of the 5 lines names its owning test. Hostile `ref` input and `setChord` while editing were moved out of the list, but stay pinned by tests in Tasks 1 and 2.
5. **Proportion.** Four tasks. Code appears only for test values and the CHANGELOG text.
