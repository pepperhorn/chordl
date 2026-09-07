# Experience Levels and Guitar Frame Options — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every guitar shape a derived experience level, and turn the guitar frame's hidden difficulty machinery into controls a learner can actually use.

**Architecture:** A new `src/experience.ts` in `chordl-guitar` owns the level vocabulary, its derivation from `PositionFacts`, and the relaxation ladder. `chordl-guitar` exposes level per shape; `chordl-react`'s `GuitarChordPanel` consumes it as a filter and replaces its existing ad-hoc `hideBarres` checkbox. The dev app greys the annotation controls that do nothing on guitar.

**Tech Stack:** TypeScript (ESM, `nodenext`), Vitest 4, React 19, svguitar 2.5.x.

**Spec:** `docs/superpowers/specs/2026-09-07-experience-levels-and-frame-options-design.md`

## Global Constraints

- Baseline **as measured 2026-09-07 at `6ed06d4`**: voicings 4/144, core 14/357, listen 1/13, guitar 13/224, react 21/186, board 13/141 — **66 files / 1065 tests**, zero failures. `pnpm lint` clean across all six packages. Confirm before starting.
- Run package tests with `pnpm test:run` from the package dir. `chordl-guitar` runs `build:data` first — required, the generated JSON is gitignored.
- **`openMidi` is always chords-db index order, low→high.** svguitar numbers strings from the highest pitch. Exactly one function inverts: `dbPositionToChord`. Do not add a second.
- Absolute fret is `baseFret - 1 + f` for `f > 0`; `-1` (muted) and `0` (open) are sentinels and are never offset.
- **Additive only.** `GuitarChordResult.positions` and `.shapes` keep their meaning, order and length. `ShapeClass`, `SHAPE_CLASS_LADDER` and `matchesShapeClass` are unchanged — the level is computed *from* the same facts, it does not replace them.
- `chordl-guitar` depends only on `@tombatossals/chords-db` and `svguitar`. Add no dependency; never import from `chordl-core` or `chordl-voicings`.
- Vocabulary is **`beginner` → `emerging` → `established`**, that spelling, everywhere.
- Repo style: double quotes, 2-space indent, `export function` for public API.
- Work on a branch off `origin/main`: `feat/experience-levels`.

## Correction to the spec, before you start

The spec says `GuitarChordPanel` offers every stored position "with nothing to distinguish them". **That is not quite true and it changes Task 5.** The panel already has a `hideBarres` boolean (`GuitarChordPanel.tsx:133`) rendered as a checkbox, with an `onlyBarres` fallback that shows barre shapes anyway, with a notice, when filtering would empty the frame.

That is `ShapeClass` `"no-barre"` versus `"any"` in miniature, and its fallback is the relaxation rule this plan generalises. **The shape-class control replaces `hideBarres`; it does not sit beside it.** Three overlapping difficulty controls would be absurd. Preserve the `onlyBarres` behaviour — it is proven and users rely on it.

## File Structure

| File | Responsibility |
|---|---|
| `packages/chordl-guitar/src/experience.ts` *(new)* | Level vocabulary, derivation from facts, derivation for top-3 shapes, the relaxation ladder. One concern: "how hard is this, and what do I show when the filter empties". |
| `packages/chordl-guitar/src/chordLookup.ts` | Gains per-shape level on `GuitarChordResult`. |
| `packages/chordl-guitar/scripts/build-top3.mjs` | Computes `level` per generated entry. |
| `packages/chordl-guitar/src/top3Generated.ts` | Regenerated with `level`. |
| `packages/chordl-guitar/src/staticPresets.ts` | `StaticPreset` gains `level`. |
| `packages/chordl-react/src/components/GuitarChordPanel.tsx` | Level + shape-class controls replacing `hideBarres`; fret-count control. |
| `packages/chordl-react/dev/App.tsx` | Greys annotation controls on guitar. |

---

### Task 1: Level derivation for stored positions

**Files:**
- Create: `packages/chordl-guitar/src/experience.ts`
- Test: `packages/chordl-guitar/test/experience.test.ts` (new)

**Interfaces:**
- Consumes: `PositionFacts` from `./voicingFacts.js` (`isOpenShape`, `hasBarre`, `baseFret`)
- Produces:
  - `export type ExperienceLevel = "beginner" | "emerging" | "established"`
  - `export const EXPERIENCE_LADDER: ExperienceLevel[]` — easiest first
  - `export function levelForFacts(facts: PositionFacts): ExperienceLevel`

- [ ] **Step 1: Write the failing test**

Create `test/experience.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EXPERIENCE_LADDER, levelForFacts } from "../src/experience";
import { positionFacts } from "../src/voicingFacts";
import { INSTRUMENTS, lookupGuitarChord } from "../src";

const guitar = INSTRUMENTS.guitar.openMidi;

describe("levelForFacts", () => {
  it("ranks an open C as beginner", () => {
    const c = lookupGuitarChord("C", "guitar")!;
    // X32010 — barre-free and at the nut.
    const facts = positionFacts(c.positions[0], guitar, 0);
    expect(facts.isOpenShape).toBe(true);
    expect(levelForFacts(facts)).toBe("beginner");
  });

  it("ranks a barre F as established", () => {
    const f = lookupGuitarChord("F", "guitar")!;
    const barre = f.positions.find((p) => p.barres.length > 0)!;
    expect(levelForFacts(positionFacts(barre, guitar, 5))).toBe("established");
  });

  it("ranks a barre-free shape away from the nut as emerging", () => {
    const d = lookupGuitarChord("D", "guitar")!;
    const moved = d.positions.find(
      (p) => p.barres.length === 0 && p.baseFret > 1,
    );
    if (!moved) return; // guarded: the corpus need not contain one for D
    expect(levelForFacts(positionFacts(moved, guitar, 2))).toBe("emerging");
  });

  it("orders the ladder easiest first", () => {
    expect(EXPERIENCE_LADDER).toEqual(["beginner", "emerging", "established"]);
  });

  // Derived, not tabulated: assert against the facts across the whole corpus
  // rather than restating a list that can drift from the data.
  it("agrees with the facts for every stored guitar position", () => {
    for (const label of ["C", "G", "Am", "F", "Bm", "E7", "Dm7"]) {
      const res = lookupGuitarChord(label, "guitar")!;
      for (const pos of res.positions) {
        const facts = positionFacts(pos, guitar, 0);
        const level = levelForFacts(facts);
        if (facts.isOpenShape) expect(level).toBe("beginner");
        else if (!facts.hasBarre) expect(level).toBe("emerging");
        else expect(level).toBe("established");
      }
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run -- experience`
Expected: FAIL — cannot resolve `../src/experience`.

- [ ] **Step 3: Implement**

Create `src/experience.ts`:

```ts
/**
 * How hard a shape is to play, as three rungs a learner moves through.
 *
 * Derived from the facts, never stored: a level that can be hand-edited drifts
 * from the shape it describes. `ShapeClass` in voicingSelect.ts filters on the
 * same facts; this ranks on them. They are deliberately separate — a filter
 * answers "show me the open ones", a rank answers "can I play this yet".
 */
import type { PositionFacts } from "./voicingFacts.js";

export type ExperienceLevel = "beginner" | "emerging" | "established";

/** Easiest first, so `indexOf` gives the rung number and +1 widens. */
export const EXPERIENCE_LADDER: ExperienceLevel[] = [
  "beginner",
  "emerging",
  "established",
];

/**
 * An open shape is barre-free and at the nut — nothing to hold down across
 * strings and no hand position to find. Barre-free but moved up the neck is
 * the next step. A barre is the rung most beginners stall on, so it anchors
 * the top.
 */
export function levelForFacts(facts: PositionFacts): ExperienceLevel {
  if (facts.isOpenShape) return "beginner";
  if (!facts.hasBarre) return "emerging";
  return "established";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run -- experience`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/experience.ts test/experience.test.ts
git commit -m "feat(guitar): derive an experience level from position facts"
```

---

### Task 2: Level on the top-3 table

**Files:**
- Modify: `packages/chordl-guitar/src/experience.ts` (append)
- Modify: `packages/chordl-guitar/scripts/build-top3.mjs`
- Modify: `packages/chordl-guitar/src/top3Generated.ts` (regenerated — do not hand-edit)
- Modify: `packages/chordl-guitar/src/staticPresets.ts`
- Test: `packages/chordl-guitar/test/experience.test.ts` (append), `test/top3Generated.test.ts` (append)

**Interfaces:**
- Produces: `export function levelForTop3(frets: number[], position: number): ExperienceLevel`
  - `frets` are the **window-relative** frets of the sounding strings (`0` = open, `-1` excluded by the caller); `position` is the diagram's `baseFret`.
- `Top3GeneratedEntry` and `StaticPreset` each gain `level: ExperienceLevel`.

**Why a separate function:** `PositionFacts` assumes six strings and real barres. A top-3 shape has three strings and never barres, so `isOpenShape`/`hasBarre` cannot rank it. The axes that do are the ones #49's generator already ranks candidates by: how far the fingers stretch, how many there are, whether open strings carry any of it, and how far from the nut it sits.

- [ ] **Step 1: Write the failing test**

Append to `test/experience.test.ts`:

```ts
import { levelForTop3 } from "../src/experience";

describe("levelForTop3", () => {
  it("calls an open, one-finger shape beginner", () => {
    // Open C on G-B-E: [0,1,0] at the nut, one finger, two open strings.
    expect(levelForTop3([0, 1, 0], 1)).toBe("beginner");
  });

  it("calls a nut-position three-finger shape emerging", () => {
    // D major [2,3,2] — no open strings, but still first position.
    expect(levelForTop3([2, 3, 2], 1)).toBe("emerging");
  });

  it("calls a shape up the neck established", () => {
    // Fmaj7 sits at the 10th fret.
    expect(levelForTop3([1, 1, 3], 10)).toBe("established");
  });

  it("never returns a level outside the ladder", () => {
    for (const p of [1, 3, 5, 7, 10, 12]) {
      for (const f of [[0, 0, 0], [1, 1, 1], [1, 3, 2], [0, 2, 4]]) {
        expect(EXPERIENCE_LADDER).toContain(levelForTop3(f, p));
      }
    }
  });
});
```

Append to `test/top3Generated.test.ts`:

```ts
import { EXPERIENCE_LADDER } from "../src/experience";
import { TOP3_GENERATED } from "../src/top3Generated";
import { GUITAR_TOP3_PRESETS } from "../src/staticPresets";

describe("experience level on the generated table", () => {
  it("gives every entry exactly one level from the ladder", () => {
    for (const e of TOP3_GENERATED) {
      expect(EXPERIENCE_LADDER, `${e.key}${e.suffix}`).toContain(e.level);
    }
  });

  it("carries the level through to the presets", () => {
    for (const p of GUITAR_TOP3_PRESETS) {
      expect(EXPERIENCE_LADDER, `${p.key}${p.suffix}`).toContain(p.level);
    }
  });

  it("puts the open shapes at the beginner rung", () => {
    const openC = TOP3_GENERATED.find((e) => e.key === "C" && e.suffix === "major")!;
    expect(openC.frets).toEqual([0, 1, 0]);
    expect(openC.level).toBe("beginner");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run -- experience top3Generated`
Expected: FAIL — `levelForTop3` is not exported; `e.level` is undefined.

- [ ] **Step 3: Implement the ranking**

Append to `src/experience.ts`:

```ts
/**
 * Rank a three-string shape. `PositionFacts` cannot: it assumes six strings
 * and real barres, and a top-3 shape has neither.
 *
 * The axes are the ones the generator already ranks candidates by — stretch,
 * finger count, open strings, distance from the nut. A shape a learner can
 * play without moving out of first position is the dividing line, because
 * finding a hand position is the skill that separates the first two rungs.
 */
export function levelForTop3(frets: number[], position: number): ExperienceLevel {
  const fretted = frets.filter((f) => f > 0);
  const opens = frets.filter((f) => f === 0).length;
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  const highest = position - 1 + (fretted.length ? Math.max(...fretted) : 0);

  // Away from the nut is established regardless of how few fingers it takes:
  // the hand has to be placed before it can be shaped.
  if (position > 1 || highest > 4) return "established";
  // At the nut: open strings or at most two fingers, with no stretch.
  if (span <= 1 && (opens > 0 || fretted.length <= 2)) return "beginner";
  return "emerging";
}
```

- [ ] **Step 4: Carry it into the generator and the types**

In `scripts/build-top3.mjs`, import nothing new — reimplement the same three lines inline (the script is plain ESM and cannot import the TypeScript module), and **add a test in Step 6 that pins the two implementations together**, exactly as `DIAGRAM_FRETS` is pinned today.

Add `level` to each emitted row in `rowLiteral`, computed from the row's window-relative frets and its `position`.

In `src/top3Generated.ts`, add to `Top3GeneratedEntry`:

```ts
  /** How hard the shape is to play. Derived; see src/experience.ts. */
  level: ExperienceLevel;
```

In `src/staticPresets.ts`, add the same field to `StaticPreset` and copy it through in `toPreset`.

- [ ] **Step 5: Regenerate and run**

Run: `pnpm run build:top3 && pnpm test:run`
Expected: PASS. The regenerated `top3Generated.ts` must differ only by the added `level` on each row — check `git diff --stat` shows one file with roughly one changed line per entry, and no frets moved.

- [ ] **Step 6: Pin the two implementations together**

Append to `test/top3Generated.test.ts`:

```ts
it("the generator's ranking agrees with the library's", () => {
  for (const e of TOP3_GENERATED) {
    const relative = e.frets.map((f) => (f > 0 ? f : f));
    expect(levelForTop3(relative, e.position ?? 1), `${e.key}${e.suffix}`)
      .toBe(e.level);
  }
});
```

- [ ] **Step 7: Commit**

```bash
git add src/experience.ts src/top3Generated.ts src/staticPresets.ts \
        scripts/build-top3.mjs test/experience.test.ts test/top3Generated.test.ts
git commit -m "feat(guitar): rank every top-3 shape by experience level"
```

---

### Task 3: The relaxation ladder

**Files:**
- Modify: `packages/chordl-guitar/src/experience.ts` (append)
- Test: `packages/chordl-guitar/test/experience.test.ts` (append)

**Interfaces:**
- Consumes: `PositionFacts`, `ShapeClass`, `matchesShapeClass` from `./voicingSelect.js`
- Produces:

```ts
export interface ExperienceQuery {
  level: ExperienceLevel;
  /** Optional refinement within the level. Default "any". */
  shapeClass?: ShapeClass;
}

export interface ExperienceSelection {
  /** Indices into the input array, in input order. Never empty when input is non-empty. */
  indices: number[];
  /** The level actually served — differs from the request when it widened. */
  level: ExperienceLevel;
  /** True when the shape-class refinement had to be dropped to find anything. */
  droppedShapeClass: boolean;
  /** The level originally asked for, when it had to widen. Absent otherwise. */
  widenedFrom?: ExperienceLevel;
}

export function selectForExperience(
  facts: PositionFacts[],
  query: ExperienceQuery,
): ExperienceSelection;
```

**Why the order matters:** 220 of 529 chords have no open shape at all and 88 have only barre shapes, so emptiness is the common case rather than the edge. An explicit level choice outranks a refinement, so the refinement is dropped first. **A reasonable implementer would do this the other way round**, which is why Step 1 pins it.

- [ ] **Step 1: Write the failing test**

Append to `test/experience.test.ts`:

```ts
import { selectForExperience } from "../src/experience";

const factsFor = (label: string) => {
  const res = lookupGuitarChord(label, "guitar")!;
  return res.positions.map((p) => positionFacts(p, guitar, 0));
};

describe("selectForExperience", () => {
  it("returns the matching shapes when the level has some", () => {
    const facts = factsFor("C");
    const sel = selectForExperience(facts, { level: "beginner" });
    expect(sel.indices.length).toBeGreaterThan(0);
    expect(sel.level).toBe("beginner");
    expect(sel.widenedFrom).toBeUndefined();
    for (const i of sel.indices) expect(facts[i].isOpenShape).toBe(true);
  });

  it("widens rather than returning nothing when a level is empty", () => {
    // F has no open shape in the corpus.
    const facts = factsFor("F");
    expect(facts.some((f) => f.isOpenShape)).toBe(false);
    const sel = selectForExperience(facts, { level: "beginner" });
    expect(sel.indices.length).toBeGreaterThan(0);
    expect(sel.widenedFrom).toBe("beginner");
    expect(sel.level).not.toBe("beginner");
  });

  it("drops the shape class BEFORE widening the level", () => {
    const facts = factsFor("C");
    // Ask for an impossible refinement within a level that does have shapes.
    const sel = selectForExperience(facts, { level: "beginner", shapeClass: "no-barre" });
    // "no-barre" is satisfiable here, so nothing should relax.
    expect(sel.droppedShapeClass).toBe(false);
    expect(sel.widenedFrom).toBeUndefined();

    // A level whose members all carry barres: the refinement must go first,
    // and the level must NOT widen while shapes remain at this rung.
    const barreOnly = factsFor("F").filter((f) => f.hasBarre);
    const sel2 = selectForExperience(barreOnly, {
      level: "established",
      shapeClass: "open",
    });
    expect(sel2.droppedShapeClass).toBe(true);
    expect(sel2.level).toBe("established");
    expect(sel2.widenedFrom).toBeUndefined();
  });

  it("never returns empty while any shape exists", () => {
    for (const label of ["C", "F", "Bm", "G", "Am", "E7"]) {
      const facts = factsFor(label);
      for (const level of EXPERIENCE_LADDER) {
        const sel = selectForExperience(facts, { level });
        expect(sel.indices.length, `${label} @ ${level}`).toBeGreaterThan(0);
      }
    }
  });

  it("returns an empty selection only for empty input", () => {
    const sel = selectForExperience([], { level: "beginner" });
    expect(sel.indices).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run -- experience`
Expected: FAIL — `selectForExperience` is not exported.

- [ ] **Step 3: Implement**

Append to `src/experience.ts`:

```ts
import type { ShapeClass } from "./voicingSelect.js";
import { matchesShapeClass } from "./voicingSelect.js";

/**
 * Filter by level, refine by shape class, and relax rather than show nothing.
 *
 * Emptiness is the common case, not the edge: 220 of 529 chords have no open
 * shape at all and 88 have only barre shapes, so a beginner filter finds
 * nothing for nearly half the corpus. Returning an empty frame there would
 * punish exactly the learner the filter is for.
 *
 * Relaxation order is deliberate. The refinement goes first because the level
 * is what the user asked for and the shape class only narrows it; widening the
 * level changes the answer to the question they asked.
 */
export function selectForExperience(
  facts: PositionFacts[],
  query: ExperienceQuery,
): ExperienceSelection {
  if (facts.length === 0) {
    return { indices: [], level: query.level, droppedShapeClass: false };
  }
  const cls = query.shapeClass ?? "any";
  const at = (level: ExperienceLevel, withClass: boolean) =>
    facts
      .map((f, i) => i)
      .filter(
        (i) =>
          levelForFacts(facts[i]) === level &&
          (!withClass || matchesShapeClass(facts[i], cls)),
      );

  // 1. level + refinement
  const exact = at(query.level, true);
  if (exact.length > 0) {
    return { indices: exact, level: query.level, droppedShapeClass: false };
  }
  // 2. drop the refinement, same level
  const noClass = at(query.level, false);
  if (noClass.length > 0) {
    return { indices: noClass, level: query.level, droppedShapeClass: cls !== "any" };
  }
  // 3. widen the level, one rung at a time, refinement already gone
  const start = EXPERIENCE_LADDER.indexOf(query.level);
  for (let i = start + 1; i < EXPERIENCE_LADDER.length; i++) {
    const wider = at(EXPERIENCE_LADDER[i], false);
    if (wider.length > 0) {
      return {
        indices: wider,
        level: EXPERIENCE_LADDER[i],
        droppedShapeClass: cls !== "any",
        widenedFrom: query.level,
      };
    }
  }
  // 4. everything is easier than the request — take it all rather than nothing.
  return {
    indices: facts.map((_, i) => i),
    level: query.level,
    droppedShapeClass: cls !== "any",
    widenedFrom: query.level,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run -- experience`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/experience.ts test/experience.test.ts
git commit -m "feat(guitar): relax a level filter instead of emptying the frame"
```

---

### Task 4: Level on `GuitarChordResult`, and the public surface

**Files:**
- Modify: `packages/chordl-guitar/src/chordLookup.ts`
- Modify: `packages/chordl-guitar/src/index.ts`
- Test: `packages/chordl-guitar/test/chordLookup.test.ts` (append), `test/publicApi.test.ts` (append)

**Interfaces:**
- Produces: `GuitarChordResult` gains `levels: ExperienceLevel[]`, parallel to `shapes` and `positions` (same length, same order).
- `index.ts` exports `ExperienceLevel`, `EXPERIENCE_LADDER`, `levelForFacts`, `levelForTop3`, `selectForExperience`, and the `ExperienceQuery` / `ExperienceSelection` types.

**Why a parallel array rather than an object per shape:** `positions` and `shapes` are already parallel and callers index across them. A third parallel array keeps that contract; wrapping shapes in objects would break every existing consumer.

- [ ] **Step 1: Write the failing test**

Append to `test/chordLookup.test.ts`:

```ts
describe("experience level on lookup results", () => {
  it("returns one level per shape, in the same order", () => {
    const res = lookupGuitarChord("C", "guitar")!;
    expect(res.levels).toHaveLength(res.shapes.length);
    expect(res.levels).toHaveLength(res.positions.length);
  });

  it("agrees with levelForFacts for every shape", () => {
    for (const label of ["C", "G", "F", "Bm", "Am7"]) {
      const res = lookupGuitarChord(label, "guitar")!;
      res.positions.forEach((p, i) => {
        const expected = levelForFacts(positionFacts(p, INSTRUMENTS.guitar.openMidi, 0));
        expect(res.levels[i], `${label}[${i}]`).toBe(expected);
      });
    }
  });

  it("levels a top-3 result from its own ranking", () => {
    const res = lookupGuitarChord("C", "guitar-top3")!;
    expect(res.levels).toHaveLength(res.shapes.length);
    expect(EXPERIENCE_LADDER).toContain(res.levels[0]);
  });
});
```

Append to `test/publicApi.test.ts`:

```ts
it("exports the experience surface", () => {
  for (const name of [
    "EXPERIENCE_LADDER",
    "levelForFacts",
    "levelForTop3",
    "selectForExperience",
  ]) {
    expect(api, `missing export ${name}`).toHaveProperty(name);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run -- chordLookup publicApi`
Expected: FAIL — `res.levels` is undefined.

- [ ] **Step 3: Implement**

In `chordLookup.ts`, add `levels: ExperienceLevel[]` to `GuitarChordResult` and populate it in `toResult`. For chords-db instruments derive from `positionFacts`; for `guitar-top3` use the preset's stored `level`.

In `index.ts` add:

```ts
export {
  EXPERIENCE_LADDER,
  levelForFacts,
  levelForTop3,
  selectForExperience,
} from "./experience.js";
export type {
  ExperienceLevel,
  ExperienceQuery,
  ExperienceSelection,
} from "./experience.js";
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run` (whole package)
Expected: PASS, 224 + the new tests.

- [ ] **Step 5: Verify the monorepo**

Run from the repo root: `pnpm build && pnpm test:run`
Expected: all packages build; the 1065 baseline plus this branch's additions; zero failures.

- [ ] **Step 6: Commit**

```bash
git add src/chordLookup.ts src/index.ts test/chordLookup.test.ts test/publicApi.test.ts
git commit -m "feat(guitar): expose an experience level per looked-up shape"
```

---

### Task 5: Level and shape-class controls on the guitar frame

**Files:**
- Modify: `packages/chordl-react/src/components/GuitarChordPanel.tsx`
- Test: `packages/chordl-react/test/GuitarChordPanel.experience.test.tsx` (new)

**Interfaces:**
- Consumes: `selectForExperience`, `ExperienceLevel`, `EXPERIENCE_LADDER`, `SHAPE_CLASS_LADDER` from `@pepperhorn/chordl-guitar`
- Produces: `GuitarChordPanelProps` gains optional `level`, `onLevelChange`, `shapeClass`, `onShapeClassChange`, each seeding internal state and re-syncing when the prop changes — the pattern `instrument` and `position` already use.

**This replaces `hideBarres`** (`GuitarChordPanel.tsx:133`). Delete the boolean and its checkbox. Preserve its `onlyBarres` notice behaviour, generalised: when `selectForExperience` reports `widenedFrom` or `droppedShapeClass`, say so in the same place the old notice appeared.

**Keep indices stable.** The existing comment at `:130` is load-bearing: visible placements carry their index into the *full* list, so a host persisting `position` (a board card does) is never handed a number that means something else once the filter changes. `ExperienceSelection.indices` are already indices into the input array — pass the full `positions` array, never a pre-filtered one.

- [ ] **Step 1: Write the failing test**

Create `test/GuitarChordPanel.experience.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuitarChordPanel } from "../src/components/GuitarChordPanel";

describe("GuitarChordPanel experience controls", () => {
  it("offers the three levels", () => {
    render(<GuitarChordPanel chord="C" />);
    for (const level of ["Beginner", "Emerging", "Established"]) {
      expect(screen.getByRole("button", { name: level })).toBeTruthy();
    }
  });

  it("has no hide-barres checkbox any more", () => {
    render(<GuitarChordPanel chord="C" />);
    expect(screen.queryByLabelText(/barre/i)).toBeNull();
  });

  it("says so when a level had to widen", () => {
    // F has no open shape, so a beginner request must widen and admit it.
    render(<GuitarChordPanel chord="F" level="beginner" />);
    expect(screen.getByText(/no beginner shape/i)).toBeTruthy();
  });

  it("still renders a diagram when the level is empty", () => {
    const { container } = render(<GuitarChordPanel chord="F" level="beginner" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run -- GuitarChordPanel.experience`
Expected: FAIL — no level buttons.

- [ ] **Step 3: Implement**

Replace the `hideBarres` state with `level` and `shapeClass` state seeded from props. In the `placements` memo, build `facts` from `result.positions` and call `selectForExperience`, using `selection.indices` where `visible` was used. Render a level toggle beside the instrument toggle, and the widen/drop notice where `onlyBarres` rendered.

**Keep the memo above the early returns** — hook order must stay stable, as the comment added in #51 records.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run`
Expected: PASS — 186 baseline plus 4.

- [ ] **Step 5: Commit**

```bash
git add src/components/GuitarChordPanel.tsx test/GuitarChordPanel.experience.test.tsx
git commit -m "feat(react): filter guitar shapes by experience level"
```

---

### Task 6: Fret count with a per-shape floor

**Files:**
- Modify: `packages/chordl-react/src/components/GuitarChordPanel.tsx`
- Test: `packages/chordl-react/test/GuitarChordPanel.frets.test.tsx` (new)

**Interfaces:**
- Produces: `GuitarChordPanelProps` gains optional `frets?: number`. The panel computes `minFrets` from the displayed shape and passes `Math.max(frets ?? minFrets, minFrets)` to `GuitarChord`.

**The floor:** the highest window-relative fret the displayed shape uses, minimum 1. No shape in the corpus needs more than 4, while guitar and ukulele default to 5 — so the default tightens for every chord.

- [ ] **Step 1: Write the failing test**

Create `test/GuitarChordPanel.frets.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { GuitarChordPanel } from "../src/components/GuitarChordPanel";

const rows = (c: HTMLElement) => c.querySelectorAll("line, .fret").length;

describe("fret count", () => {
  it("never draws fewer frets than the shape needs", () => {
    const { container } = render(<GuitarChordPanel chord="C" frets={1} />);
    // The request is below the floor, so the floor wins and the chord is whole.
    expect(container.querySelector("svg")).toBeTruthy();
    expect(rows(container)).toBeGreaterThan(1);
  });

  it("honours a larger request", () => {
    const { container } = render(<GuitarChordPanel chord="C" frets={7} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run -- GuitarChordPanel.frets`
Expected: FAIL — `frets` is not a prop.

- [ ] **Step 3: Implement**

Compute `minFrets` inside the `placements` memo from `result.positions[idx].frets` (window-relative, ignore `-1` and `0`), and clamp.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GuitarChordPanel.tsx test/GuitarChordPanel.frets.test.tsx
git commit -m "feat(react): size the fret window to the shape being drawn"
```

---

### Task 7: Grey the annotations that do nothing on guitar

**Files:**
- Modify: `packages/chordl-react/dev/App.tsx`
- Modify: `packages/chordl-react/dev/index.html`

**Interfaces:**
- `AnnotationControl` (`dev/App.tsx:198`) gains `disabled?: boolean`.

**Why:** `GuitarChordPanel` ignores note names, degrees and fingering entirely — they are piano-only. Today those controls sit enabled beside a guitar frame and do nothing when clicked. Grey rather than hide, so they keep their position when the instrument changes.

The dev app already knows: `displayMode === "guitar"` (`dev/App.tsx:650`).

- [ ] **Step 1: Implement**

Add `disabled` to `AnnotationControl`'s props; when true, set `disabled` on the toggle button and the size `<select>`, add `aria-disabled`, add a `title` explaining why ("Note names apply to the keyboard and staff, not to guitar frames"), and a `.annotation-control--disabled` class. Pass `disabled={displayMode === "guitar"}` at all three call sites.

Add to `dev/index.html`:

```css
.annotation-control--disabled { opacity: 0.45; }
.annotation-control--disabled .pill-btn,
.annotation-control--disabled .annotation-size { cursor: not-allowed; }
```

- [ ] **Step 2: Verify in the running app**

Start the dev server if it is not up, switch the display mode to guitar, and confirm the three controls grey out and do not respond, and that switching back to keyboard re-enables them without the controls moving.

- [ ] **Step 3: Run the suites**

Run from the repo root: `pnpm lint && pnpm test:run`
Expected: clean; no test regressions.

- [ ] **Step 4: Commit**

```bash
git add dev/App.tsx dev/index.html
git commit -m "fix(dev): grey the annotation controls that guitar frames ignore"
```

---

## Self-Review

**Spec coverage.** Level derived on every shape — Tasks 1, 2, 4. Level filters and shape class refines — Tasks 3, 5. Relaxation order with the widening reported — Task 3 (logic) and Task 5 (surfaced). Fret floor — Task 6. Greyed annotations — Task 7. Naming fixed in Global Constraints. Public API additive — Task 4.

**One spec item deliberately not implemented:** the spec's open item that top-3 stores one shape per chord, so it has no variations to filter. Task 2 still gives each entry a level (useful for ordering a lesson), but no top-3 filtering exists to build, and inventing it would need the generator to keep its runners-up — its own design cycle, as the spec says.

**Type consistency.** `ExperienceLevel`, `EXPERIENCE_LADDER`, `levelForFacts`, `levelForTop3`, `selectForExperience`, `ExperienceQuery`, `ExperienceSelection` are defined in Tasks 1-3 and used with those exact names in Tasks 4-6. `GuitarChordResult.levels` is introduced in Task 4 and consumed in Task 5.

**Known risk, flagged not resolved:** Task 2 duplicates the ranking rule into `build-top3.mjs` because the script is plain ESM and cannot import the TypeScript module. Step 6 pins the two together with a test, the same treatment `DIAGRAM_FRETS` already gets. If that test is skipped, the table and the library will disagree silently.
