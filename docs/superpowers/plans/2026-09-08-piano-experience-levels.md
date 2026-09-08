# Piano Experience Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rank every piano voicing on the same three-rung experience ladder the guitar frame already uses, and have the level radio in `dev/App.tsx` filter the voicing toggle the way it already filters guitar shapes.

**Architecture:** A new `chordl-voicings/src/experience.ts` derives a level from a voicing's semitone offsets, gated by a core-quality allowlist recognised from the pitch-class set. Selection reuses `selectForExperience`'s exact relaxation contract. The ladder type is duplicated from `chordl-guitar` rather than shared — the package boundary forbids sharing — and pinned by a test in `chordl-react`.

**Tech Stack:** TypeScript, vitest, React 18, tonal. pnpm workspace (the root `npm run` scripts shell out to `pnpm --filter`).

**Spec:** `docs/superpowers/specs/2026-09-08-piano-experience-levels-design.md`

## Global Constraints

- **Additive only.** `generateVariants`, `voicingPitchClasses`, `realizeVoicingFull`, `voicingOctaveOffsets` and `VoicingEntry` keep their current signatures.
- **No new dependencies.** `chordl-voicings` depends on `tonal` and nothing else in this workspace. `chordl-guitar` depends on no workspace package at all and must keep publishing standalone.
- **`chordl-core` depends on `chordl-voicings`.** Importing `chordl-core` from `chordl-voicings` is a dependency cycle. Do not.
- **Relaxation contract, copied verbatim from guitar:** matching is cumulative (a level matches every rung at or below it on the ladder); drop the shape-class refinement before widening the level; widen one rung at a time; report having widened.
- **Beginner rule:** core quality, ≤ 4 notes, span ≤ 11 semitones.
- **Emerging rule:** every pitch class is one of the chord's own defining tones (at any octave — a doubling is free) or a natural 9th.
- **Core quality set:** major, minor, diminished and augmented triads, `maj7`, `dom7`, `sus2`, `sus4`, `5`.
- Comments in this codebase are load-bearing and explain *why*, not *what*. Match that standard.

---

### Task 1: Derive a level from semitone offsets

**Files:**
- Create: `packages/chordl-voicings/src/experience.ts`
- Test: `packages/chordl-voicings/test/experience.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ExperienceLevel`, `EXPERIENCE_LADDER`, `CORE_TEMPLATES`, `isCoreQuality(semitones: number[]): boolean`, `levelForVoicing(semitones: number[]): ExperienceLevel`.

**Why the allowlist is recognised from the pitch-class set, not from `VoicingQuality`:** `mapToVoicingQuality` returns `undefined` for a plain triad, so the four triads in the core set are not members of that union at all. Reducing the offsets mod 12 into a set also makes inversions fall out for free — an inversion is the same pitch-class set in a different order.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { levelForVoicing, isCoreQuality } from "../src/experience.js";

describe("isCoreQuality", () => {
  it("recognises the core set and its inversions", () => {
    expect(isCoreQuality([0, 4, 7])).toBe(true);        // major triad
    expect(isCoreQuality([4, 7, 12])).toBe(true);       // 1st inversion, same set
    expect(isCoreQuality([0, 3, 7])).toBe(true);        // minor
    expect(isCoreQuality([0, 3, 6])).toBe(true);        // diminished
    expect(isCoreQuality([0, 4, 8])).toBe(true);        // augmented
    expect(isCoreQuality([0, 4, 7, 11])).toBe(true);    // maj7
    expect(isCoreQuality([0, 4, 7, 10])).toBe(true);    // dom7
    expect(isCoreQuality([0, 2, 7])).toBe(true);        // sus2
    expect(isCoreQuality([0, 5, 7])).toBe(true);        // sus4
    expect(isCoreQuality([0, 7])).toBe(true);           // power chord
  });

  it("rejects everything outside it", () => {
    expect(isCoreQuality([0, 3, 7, 10])).toBe(false);   // min7 — deliberately not core
    expect(isCoreQuality([0, 3, 6, 10])).toBe(false);   // m7b5
    expect(isCoreQuality([4, 10, 15, 20])).toBe(false); // rootless alt
  });
});

describe("levelForVoicing", () => {
  it("ranks a core triad and every inversion beginner", () => {
    expect(levelForVoicing([0, 4, 7])).toBe("beginner");
    expect(levelForVoicing([4, 7, 12])).toBe("beginner");
    expect(levelForVoicing([7, 12, 16])).toBe("beginner");
  });

  it("ranks every inversion of a core seventh beginner", () => {
    expect(levelForVoicing([0, 4, 7, 11])).toBe("beginner");  // span 11, at the bound
    expect(levelForVoicing([4, 7, 11, 12])).toBe("beginner");
    expect(levelForVoicing([7, 11, 12, 16])).toBe("beginner");
    expect(levelForVoicing([11, 12, 16, 19])).toBe("beginner");
  });

  it("rejects a core quality spread past a major 7th", () => {
    // Same pitch classes as a maj7, but spread — the hand cannot hold it.
    expect(levelForVoicing([0, 7, 16, 23])).not.toBe("beginner");
  });

  it("rejects a fifth note even inside the span bound", () => {
    expect(levelForVoicing([0, 2, 4, 7, 11])).not.toBe("beginner");
  });

  it("ranks a non-core quality above beginner however easy it is to play", () => {
    // A rootless Type A min7: four close notes any hand can play, and not a
    // beginner's chord. This is the case that makes the rule a hybrid.
    expect(levelForVoicing([3, 7, 10, 14])).toBe("emerging");
  });

  it("treats an octave doubling as free, not as a tension", () => {
    // spread-madd9: the 15 is its own b3 an octave up, not a #9.
    expect(levelForVoicing([0, 7, 14, 15])).toBe("emerging");
  });

  it("puts a genuine alteration at established", () => {
    expect(levelForVoicing([0, 4, 10, 15])).toBe("established");  // #9 over a dom7
    expect(levelForVoicing([4, 10, 21, 25, 28])).toBe("established");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd packages/chordl-voicings && npx vitest run test/experience.test.ts`
Expected: FAIL — cannot resolve `../src/experience.js`.

- [ ] **Step 3: Implement**

```ts
/**
 * How hard a voicing is to play, as the three rungs `chordl-guitar` already
 * uses. Duplicated from that package rather than shared: `chordl-guitar`
 * depends on no workspace package and must keep publishing standalone, and
 * `chordl-core` already depends on this package, so importing back is a
 * cycle. `chordl-react` pins the two copies together — see its
 * experience-ladder test, which fails if they drift.
 */
export type ExperienceLevel = "beginner" | "emerging" | "established";

/** Easiest first, so `indexOf` gives the rung number and +1 widens. */
export const EXPERIENCE_LADDER: ExperienceLevel[] = [
  "beginner",
  "emerging",
  "established",
];

/**
 * The chords a beginner actually plays, as pitch-class sets relative to the
 * root.
 *
 * Recognised from the set rather than from `VoicingQuality` for two reasons:
 * `mapToVoicingQuality` returns `undefined` for a plain triad, so the four
 * triads here are not members of that union at all; and a set comparison
 * makes inversions fall out for free, since an inversion is the same pitch
 * classes in a different order.
 *
 * `min7` is deliberately absent. It has beginner shells today only by
 * accident of sharing the maj7/dom7 shell shapes, and whether a beginner is
 * offered a minor seventh is an open question — see the spec.
 */
export const CORE_TEMPLATES: number[][] = [
  [0, 4, 7],      // major
  [0, 3, 7],      // minor
  [0, 3, 6],      // diminished
  [0, 4, 8],      // augmented
  [0, 4, 7, 11],  // maj7
  [0, 4, 7, 10],  // dom7
  [0, 2, 7],      // sus2
  [0, 5, 7],      // sus4
  [0, 7],         // power chord
];

const pcSet = (semitones: number[]): Set<number> =>
  new Set(semitones.map((s) => ((s % 12) + 12) % 12));

const sameSet = (a: Set<number>, b: number[]): boolean =>
  a.size === b.length && b.every((x) => a.has(x));

export function isCoreQuality(semitones: number[]): boolean {
  const set = pcSet(semitones);
  return CORE_TEMPLATES.some((t) => sameSet(set, t));
}

/**
 * Every pitch class the chord itself is built from, so a doubling can be told
 * from a tension. Derived from the voicing's own set: a note whose pitch class
 * already sounds somewhere in the chord is the same note an octave away, not a
 * new colour, however large its raw interval. `spread-madd9`'s 15 is its own
 * b3 doubled, not a #9, and a raw-value check reads it wrong.
 */
const NATURAL_NINTH = 2;

/**
 * @param semitones - Offsets from the root, which may be negative (drop
 *   voicings) and may exceed 12 (anything spread). Not reduced: the span
 *   bound is measured on these raw values, because that is the distance the
 *   hand actually covers.
 */
export function levelForVoicing(semitones: number[]): ExperienceLevel {
  if (semitones.length === 0) return "beginner";
  const span = Math.max(...semitones) - Math.min(...semitones);

  if (isCoreQuality(semitones) && semitones.length <= 4 && span <= 11) {
    return "beginner";
  }

  // Emerging admits the chord's own tones at any octave, plus a natural 9th.
  // Anything else — an altered tension, an 11th or 13th that is not one of
  // the chord's own tones — is established.
  const own = pcSet(semitones);
  const base = new Set(
    [...own].filter((pc) => pc !== NATURAL_NINTH || own.size <= 4),
  );
  const beyond = [...own].filter((pc) => !base.has(pc) && pc !== NATURAL_NINTH);
  return beyond.length === 0 ? "emerging" : "established";
}
```

**Note for the implementer:** the `base`/`beyond` computation above is a first cut and the tests are the specification, not this code. `levelForVoicing([0,4,10,15])` must be `established` and `levelForVoicing([0,7,14,15])` must be `emerging`; if this expression does not deliver both, rewrite it until it does. The rule in words: reduce every offset to a pitch class; the chord's *defining* tones are the pitch classes of its lowest occurrence of each degree; a natural 9th is additionally allowed; any remaining pitch class means established.

- [ ] **Step 4: Run the tests**

Run: `cd packages/chordl-voicings && npx vitest run test/experience.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-voicings/src/experience.ts packages/chordl-voicings/test/experience.test.ts
git commit -m "feat(voicings): rank a voicing on the experience ladder"
```

---

### Task 2: Measure the corpus, and pin the measurement

**Files:**
- Test: `packages/chordl-voicings/test/experience-corpus.test.ts`

**Interfaces:**
- Consumes: `levelForVoicing` from Task 1, `VOICING_LIBRARY`.
- Produces: nothing consumed by later tasks. This task exists to turn the spec's coverage claims into an executable assertion, so a later edit to `CORE_TEMPLATES` or the emerging rule cannot silently reshape the corpus.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { VOICING_LIBRARY } from "../src/library.js";
import { levelForVoicing } from "../src/experience.js";

describe("the library under the experience rule", () => {
  it("has a stable rung distribution", () => {
    const counts = { beginner: 0, emerging: 0, established: 0 };
    for (const e of VOICING_LIBRARY) counts[levelForVoicing(e.intervals)]++;
    // Pinned so a change to CORE_TEMPLATES or the emerging rule has to be
    // deliberate. Update these numbers WITH a reason, never to make a run green.
    expect(counts.beginner + counts.emerging + counts.established).toBe(VOICING_LIBRARY.length);
    expect(counts).toMatchInlineSnapshot();
  });

  it("leaves most qualities with no beginner voicing, which is the answer", () => {
    const beginnerQualities = new Set(
      VOICING_LIBRARY.filter((e) => levelForVoicing(e.intervals) === "beginner")
        .map((e) => e.quality),
    );
    // m7b5, dim7, 6/9, m6/9, alt, maj7b5 and the adds are not chords a
    // beginner plays. Empty is correct; relaxation covers the request.
    expect(beginnerQualities.has("alt")).toBe(false);
    expect(beginnerQualities.has("m7b5")).toBe(false);
    expect(beginnerQualities.has("6/9")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and let the snapshot fill in**

Run: `cd packages/chordl-voicings && npx vitest run test/experience-corpus.test.ts -u`
Then **read the written snapshot** and sanity-check it against the spec's coverage section before committing. If `beginner` is 0, something is wrong with Task 1 — stop and report.

- [ ] **Step 3: Commit**

```bash
git add packages/chordl-voicings/test/experience-corpus.test.ts
git commit -m "test(voicings): pin the library's rung distribution"
```

---

### Task 3: The power-chord shell

**Files:**
- Modify: `packages/chordl-voicings/src/library.ts`
- Test: `packages/chordl-voicings/test/experience.test.ts` (extend)

**Interfaces:**
- Consumes: `levelForVoicing`.
- Produces: a library entry with id `power-5-shell`.

**Why:** the `5` quality has no beginner voicing and structurally cannot have a 3-note one — its two pitch classes sit 5 and 7 semitones apart, so any three octave-transposed picks span two consecutive gaps summing to exactly 12. The existing `power-5` (`[0,7,12]`) misses the bound by one semitone, and no voicing choice fixes that. A 2-note `[0,7]` satisfies the rule.

- [ ] **Step 1: Write the failing test**

```ts
it("gives the power chord a beginner voicing", () => {
  const shell = VOICING_LIBRARY.find((e) => e.id === "power-5-shell");
  expect(shell).toBeDefined();
  expect(shell!.intervals).toEqual([0, 7]);
  expect(levelForVoicing(shell!.intervals)).toBe("beginner");
});

it("cannot make a three-note power chord beginner", () => {
  // Structural, not a choice: [0,7,12] spans exactly 12, one past the bound.
  expect(levelForVoicing([0, 7, 12])).not.toBe("beginner");
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd packages/chordl-voicings && npx vitest run test/experience.test.ts`
Expected: FAIL — `shell` is undefined.

- [ ] **Step 3: Add the entry**

Place it immediately **before** `power-5` in `VOICING_LIBRARY`, because `findVoicing` and `generateVariants` keep only the first entry per (quality, style) and both entries are style `Shell` — putting it second would make it unreachable.

```ts
  {
    id: "power-5-shell",
    name: "Power chord (shell)",
    quality: "5",
    // Root and fifth, nothing else. The 3-note form [0,7,12] spans exactly a
    // twelfth — the two pitch classes are 5 and 7 semitones apart, so any
    // three octave-transposed picks span two gaps summing to 12 — which puts
    // every 3-note spelling one semitone past the beginner bound. Two notes
    // is not a compromise here; it is the only shape that can be beginner.
    intervals: [0, 7],
    tags: { era: "Modal", style: "Shell" },
  },
```

- [ ] **Step 4: Run the tests**

Run: `cd packages/chordl-voicings && npx vitest run`
Expected: PASS. The corpus snapshot from Task 2 will change by one — update it, and say why in the commit.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-voicings/src/library.ts packages/chordl-voicings/test/
git commit -m "feat(voicings): give the power chord a beginner shell"
```

---

### Task 4: Select by level, and relax rather than empty

**Files:**
- Modify: `packages/chordl-voicings/src/experience.ts`
- Modify: `packages/chordl-voicings/src/types.ts` (add `level?: ExperienceLevel` to `VoicingVariant`)
- Modify: `packages/chordl-voicings/src/variant-generator.ts`
- Modify: `packages/chordl-voicings/src/index.ts` (export the new surface)
- Test: `packages/chordl-voicings/test/experience-select.test.ts`

**Interfaces:**
- Consumes: `levelForVoicing`, `EXPERIENCE_LADDER`, `VoicingVariant`.
- Produces:
  - `interface VoicingSelection { indices: number[]; level: ExperienceLevel; widenedFrom?: ExperienceLevel }`
  - `selectVoicingsForExperience(variants: VoicingVariant[], level: ExperienceLevel): VoicingSelection`
  - `VoicingVariant.level?: ExperienceLevel`

**The span problem, and why each variant source is measured differently.** A library variant carries `octaveOffsets` (added in #57) and its entry's `intervals`, so its real placement is known. An inversion or algorithmic variant has neither — its ordered pitch classes *are* the voicing, and its placement is whatever the `ascendingOctaves` stack produces. So `generateVariants` computes each variant's semitones at the point it builds it, where it still knows which source it came from, and stores the resulting level on the variant. Do not try to recover this downstream from `notes` alone; that is exactly the information loss #57 was about.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { selectVoicingsForExperience } from "../src/experience.js";
import type { VoicingVariant } from "../src/types.js";

const v = (id: string, level: "beginner" | "emerging" | "established"): VoicingVariant =>
  ({ id, label: id, notes: ["C"], source: "library", level });

describe("selectVoicingsForExperience", () => {
  it("matches cumulatively — a rung includes everything below it", () => {
    const vs = [v("a", "beginner"), v("b", "emerging"), v("c", "established")];
    expect(selectVoicingsForExperience(vs, "established").indices).toEqual([0, 1, 2]);
    expect(selectVoicingsForExperience(vs, "emerging").indices).toEqual([0, 1]);
    expect(selectVoicingsForExperience(vs, "beginner").indices).toEqual([0]);
  });

  it("widens one rung and says so rather than returning nothing", () => {
    const vs = [v("a", "emerging"), v("b", "established")];
    const sel = selectVoicingsForExperience(vs, "beginner");
    expect(sel.indices).toEqual([0]);
    expect(sel.level).toBe("emerging");
    expect(sel.widenedFrom).toBe("beginner");
  });

  it("widens as far as it must, still one rung at a time", () => {
    const vs = [v("a", "established")];
    const sel = selectVoicingsForExperience(vs, "beginner");
    expect(sel.indices).toEqual([0]);
    expect(sel.level).toBe("established");
    expect(sel.widenedFrom).toBe("beginner");
  });

  it("never widens when the requested rung already matched", () => {
    const vs = [v("a", "beginner")];
    expect(selectVoicingsForExperience(vs, "beginner").widenedFrom).toBeUndefined();
  });

  it("returns indices into the array it was handed", () => {
    const vs = [v("a", "established"), v("b", "beginner"), v("c", "established")];
    expect(selectVoicingsForExperience(vs, "beginner").indices).toEqual([1]);
  });

  it("survives an empty list", () => {
    expect(selectVoicingsForExperience([], "beginner").indices).toEqual([]);
  });

  it("treats a variant with no level as established", () => {
    // An older persisted variant, or one from a source that did not rank it.
    const vs = [{ id: "x", label: "x", notes: ["C"], source: "inversion" } as VoicingVariant];
    expect(selectVoicingsForExperience(vs, "beginner").level).toBe("established");
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd packages/chordl-voicings && npx vitest run test/experience-select.test.ts`
Expected: FAIL — `selectVoicingsForExperience` is not exported.

- [ ] **Step 3: Implement the selector**

Append to `experience.ts`:

```ts
import type { VoicingVariant } from "./types.js";

export interface VoicingSelection {
  /** Indices into the input array, in input order. Never empty when input is non-empty. */
  indices: number[];
  /** The level actually served — differs from the request when it widened. */
  level: ExperienceLevel;
  /** The level originally asked for, when it had to widen. Absent otherwise. */
  widenedFrom?: ExperienceLevel;
}

/**
 * Filter variants by level, and relax rather than show nothing.
 *
 * The contract is `chordl-guitar`'s `selectForExperience`, verbatim, because
 * two frames answering the same question must answer it the same way.
 * Matching is CUMULATIVE — `established` matches everything, `emerging`
 * matches beginner + emerging — since the level asks "can I play this yet",
 * and an established player can obviously play a root-position triad.
 *
 * Emptiness is the common case here, not an edge case: most qualities have no
 * beginner voicing at all, and that is the correct answer rather than a gap.
 * So widening is the normal path for a beginner request on anything exotic,
 * and it reports itself — a filter that silently ignores itself is worse than
 * one that says it could not be honoured.
 *
 * There is no shape-class refinement on this side, so the guitar version's
 * "drop the refinement first" step has nothing to do and is absent.
 */
export function selectVoicingsForExperience(
  variants: VoicingVariant[],
  level: ExperienceLevel,
): VoicingSelection {
  if (variants.length === 0) return { indices: [], level };
  const rank = (l: ExperienceLevel) => EXPERIENCE_LADDER.indexOf(l);
  // An unranked variant is treated as established: it is the rung that
  // matches everything, so an unknown voicing is never wrongly offered to a
  // beginner, only wrongly withheld — the safe direction of the two.
  const levelOf = (v: VoicingVariant): ExperienceLevel => v.level ?? "established";
  const at = (l: ExperienceLevel) =>
    variants.map((_, i) => i).filter((i) => rank(levelOf(variants[i])) <= rank(l));

  const exact = at(level);
  if (exact.length > 0) return { indices: exact, level };

  const start = EXPERIENCE_LADDER.indexOf(level);
  for (let i = start + 1; i < EXPERIENCE_LADDER.length; i++) {
    const wider = at(EXPERIENCE_LADDER[i]);
    if (wider.length > 0) {
      return { indices: wider, level: EXPERIENCE_LADDER[i], widenedFrom: level };
    }
  }
  // Unreachable: cumulative matching means `at("established")` matches every
  // variant, and the guard above guarantees there is at least one.
  throw new Error(
    "selectVoicingsForExperience: unreachable — cumulative matching " +
      "guarantees the widening loop returns by \"established\"",
  );
}
```

- [ ] **Step 4: Rank each variant as it is built**

In `variant-generator.ts`, add `level` to every `addCandidate` call. The semitones differ by source:

- **Library** (both the slot-A branch and the by-style loop): the entry's own `intervals`. `level: levelForVoicing(entry.intervals)`.
- **Inversion and algorithmic**: derive from the ordered pitch classes by the same ascending-letter stack the renderer uses, relative to the root. Add a local helper rather than importing from `chordl-react` (wrong direction, and `chordl-voicings` must stay dependency-free):

```ts
import { Note } from "tonal";

/**
 * Semitones from the root for a variant that has no declared placement.
 *
 * An inversion or algorithmic variant carries only ordered pitch classes, and
 * the renderer places them by stacking each note above the previous one. So
 * the span it will be drawn at is a function of that order, and this
 * reproduces the same walk — ranking a voicing by a placement other than the
 * one it is drawn at is the fault #57 fixed, and this is where it would come
 * back.
 *
 * The renderer stacks on diatomic LETTER; this stacks on PITCH. They agree
 * for these variants because their notes come from `resolvedNotes`, which is
 * already ascending by pitch, so no letter can fail to advance without the
 * pitch also failing to advance. That is a property of the input, not a
 * property of the two rules, and it stops being true the moment a caller
 * hands this a set that is not pitch-ascending.
 */
function semitonesFromStack(root: string, notes: string[]): number[] {
  const rootMidi = Note.midi(`${root}4`);
  if (rootMidi == null || notes.length === 0) return [];
  let prev = -Infinity;
  let octave = 4;
  const out: number[] = [];
  for (const n of notes) {
    let midi = Note.midi(`${n}${octave}`);
    if (midi == null) return [];
    // Stack upward: raise by octaves until this note is above the last one.
    while (midi <= prev) {
      octave++;
      midi += 12;
    }
    prev = midi;
    out.push(midi - rootMidi);
  }
  return out;
}
```

Note the first note may land below the root (a variant whose bottom note is the third, say), giving a negative first offset. That is correct and `levelForVoicing` handles it — the span is `max - min`, not `max`.

- [ ] **Step 5: Export the new surface**

In `packages/chordl-voicings/src/index.ts`:

```ts
export {
  levelForVoicing,
  isCoreQuality,
  selectVoicingsForExperience,
  EXPERIENCE_LADDER,
  CORE_TEMPLATES,
} from "./experience.js";
export type { ExperienceLevel, VoicingSelection } from "./experience.js";
```

- [ ] **Step 6: Run every test in the package**

Run: `cd packages/chordl-voicings && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/chordl-voicings/
git commit -m "feat(voicings): select voicings by level, widening rather than emptying"
```

---

### Task 5: Pin the two ladders together

**Files:**
- Test: `packages/chordl-react/test/experience-ladder-parity.test.ts`

**Interfaces:**
- Consumes: `EXPERIENCE_LADDER` from both `@pepperhorn/chordl-guitar` and `@pepperhorn/chordl-voicings`.
- Produces: nothing.

**Why here:** `chordl-react` is the only package that depends on both. This test is what makes the duplication safe, and it is the reason the duplication is acceptable at all.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from "vitest";
import { EXPERIENCE_LADDER as GUITAR_LADDER } from "@pepperhorn/chordl-guitar";
import { EXPERIENCE_LADDER as PIANO_LADDER } from "@pepperhorn/chordl-voicings";

describe("the experience ladder", () => {
  /*
   * The two packages declare this type separately and must never disagree.
   * They cannot share it: chordl-guitar depends on no workspace package and
   * must keep publishing standalone, and chordl-core already depends on
   * chordl-voicings, so importing back is a cycle. Duplication pinned by a
   * test is the house pattern for exactly this — see build-top3.mjs and
   * DIAGRAM_FRETS.
   *
   * If this fails, do not "fix" it by editing one side to match. Work out
   * which change was intended and apply it to both.
   */
  it("is identical in chordl-guitar and chordl-voicings", () => {
    expect(PIANO_LADDER).toEqual(GUITAR_LADDER);
  });

  it("runs easiest first, which indexOf-based widening depends on", () => {
    expect(GUITAR_LADDER).toEqual(["beginner", "emerging", "established"]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `cd packages/chordl-react && npx vitest run test/experience-ladder-parity.test.ts`
Expected: PASS immediately — this test guards against future drift, not a current bug.

- [ ] **Step 3: Prove it can fail**

Temporarily reorder `EXPERIENCE_LADDER` in `packages/chordl-voicings/src/experience.ts`, rebuild that package (`cd packages/chordl-voicings && npm run build`), re-run the test, confirm it FAILS, then revert and rebuild. Report what you saw.

- [ ] **Step 4: Commit**

```bash
git add packages/chordl-react/test/experience-ladder-parity.test.ts
git commit -m "test(react): pin the guitar and piano experience ladders together"
```

---

### Task 6: Filter the voicing toggle, and wire the radio

**Files:**
- Modify: `packages/chordl-react/src/components/VoicingVariantToggle.tsx`
- Modify: `packages/chordl-react/dev/App.tsx`
- Modify: `packages/chordl-react/src/index.ts` (re-export `ExperienceLevel` from voicings if it is not already named)
- Test: `packages/chordl-react/test/VoicingVariantToggle.experience.test.tsx`

**Interfaces:**
- Consumes: `selectVoicingsForExperience`, `VoicingSelection`.
- Produces: `VoicingVariantToggleProps.level?: ExperienceLevel`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoicingVariantToggle } from "../src/components/VoicingVariantToggle";

describe("VoicingVariantToggle level filtering", () => {
  it("offers fewer variants at a lower rung", () => {
    const { container: est } = render(<VoicingVariantToggle chord="C7" level="established" />);
    const estCount = est.querySelectorAll(".voicing-variant-btn").length;
    const { container: beg } = render(<VoicingVariantToggle chord="C7" level="beginner" />);
    const begCount = beg.querySelectorAll(".voicing-variant-btn").length;
    expect(begCount).toBeLessThan(estCount);
  });

  it("says so when the level had to widen", () => {
    render(<VoicingVariantToggle chord="C7alt" level="beginner" />);
    expect(screen.getByText(/no beginner voicing/i)).toBeTruthy();
  });

  it("still shows a chord when no variant matches the rung", () => {
    const { container } = render(<VoicingVariantToggle chord="C7alt" level="beginner" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
```

**Before writing this, read the component** and replace `.voicing-variant-btn` with whatever class the A/B/C buttons actually carry. Do not invent a class name.

- [ ] **Step 2: Run and watch it fail**

Run: `cd packages/chordl-react && npx vitest run test/VoicingVariantToggle.experience.test.tsx`
Expected: FAIL — `level` is not a prop, so both renders are identical.

- [ ] **Step 3: Add the prop and the filter**

Add `level?: ExperienceLevel` to `VoicingVariantToggleProps`, defaulting to `"established"` so an embedder that passes nothing sees today's behaviour. After the `variants` memo, apply the selection and derive the visible list — mirroring `GuitarChordPanel`'s approach, where indices stay indices into the full list so a persisted index never changes meaning:

```tsx
const selection = useMemo(
  () => selectVoicingsForExperience(variants, level),
  [variants, level],
);
const visible = selection.indices;
```

Render the widening notice with the same wording shape the guitar frame uses:
`No ${selection.widenedFrom} voicing for ${label} — showing ${selection.level} instead.`

- [ ] **Step 4: Wire it in `dev/App.tsx`**

The `level` state and the radio already exist (from #56). Pass it to the toggle, next to the existing props:

```tsx
<VoicingVariantToggle
  chord={...}
  level={level}
  ...
/>
```

- [ ] **Step 5: Run the tests**

Run: `cd packages/chordl-react && npx vitest run`
Expected: PASS.

- [ ] **Step 6: Verify the radio drives both frames**

Extend `packages/chordl-react/test/InteractiveInput.level-control.test.tsx` with a case that clicks Beginner in Keyboard mode and asserts the variant count changes. This is the test that proves the control is no longer inert on the piano side, which was the whole point.

- [ ] **Step 7: Commit**

```bash
git add packages/chordl-react/
git commit -m "feat(react): filter piano voicings by experience level"
```

---

### Task 7: `spellingsFor`, as a logic layer

**Files:**
- Create: `packages/chordl-voicings/src/spellings.ts`
- Modify: `packages/chordl-voicings/src/index.ts`
- Test: `packages/chordl-voicings/test/spellings.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `spellingsFor(pitchClasses: string[]): string[]`.

**Rendered nowhere, deliberately.** How often this fires across the corpus has not been measured, and that measurement should decide the presentation rather than a guess. #50's `reason` grading is the natural consumer. Do not add UI for it in this plan.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { spellingsFor } from "../src/spellings.js";

describe("spellingsFor", () => {
  it("names every rotation of a symmetric chord", () => {
    // C-E-G# is equally E-G#-C and Ab-C-E. All three are in the beginner set,
    // so a learner meets genuine spelling ambiguity early.
    const names = spellingsFor(["C", "E", "G#"]);
    expect(names).toHaveLength(3);
    expect(names).toEqual(expect.arrayContaining(["Caug", "Eaug", "G#aug"]));
  });

  it("names all four spellings of a diminished seventh", () => {
    expect(spellingsFor(["C", "D#", "F#", "A"])).toHaveLength(4);
  });

  it("returns exactly one name for an unambiguous chord", () => {
    expect(spellingsFor(["C", "E", "G"])).toEqual(["C"]);
  });

  it("returns nothing it cannot name", () => {
    expect(spellingsFor(["C", "C#"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd packages/chordl-voicings && npx vitest run test/spellings.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { Note } from "tonal";

/**
 * Chord shapes as semitone offsets from their own root.
 *
 * Copied from `chordl-listen`'s `CHORD_TEMPLATES` rather than imported:
 * that package is audio detection and matches a chroma vector by similarity,
 * while this matches an exact set, and `chordl-voicings` must not depend on
 * it. The table is the shared thing, not the matcher.
 */
const TEMPLATES: { offsets: number[]; suffix: string }[] = [
  { offsets: [0, 4, 7], suffix: "" },
  { offsets: [0, 3, 7], suffix: "m" },
  { offsets: [0, 3, 6], suffix: "dim" },
  { offsets: [0, 4, 8], suffix: "aug" },
  { offsets: [0, 5, 7], suffix: "sus4" },
  { offsets: [0, 2, 7], suffix: "sus2" },
  { offsets: [0, 4, 7, 10], suffix: "7" },
  { offsets: [0, 4, 7, 11], suffix: "maj7" },
  { offsets: [0, 3, 7, 10], suffix: "m7" },
  { offsets: [0, 3, 6, 10], suffix: "m7b5" },
  { offsets: [0, 3, 6, 9], suffix: "dim7" },
  { offsets: [0, 4, 7, 9], suffix: "6" },
  { offsets: [0, 3, 7, 9], suffix: "m6" },
];

const PITCH_CLASSES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

/**
 * Every chord name a set of pitch classes spells.
 *
 * Returns more than one name whenever the set is genuinely ambiguous — an
 * augmented triad is symmetric, so C-E-G# is equally E-G#-C and Ab-C-E, and a
 * diminished seventh has four equally correct names. That is #50's `inherent`
 * grading seen from the naming side: not a defect to warn about, but a fact
 * about the notes that no voicing can resolve.
 *
 * Rendered nowhere yet, on purpose. How often this fires across the corpus
 * has not been measured, and that measurement should choose the presentation.
 */
export function spellingsFor(pitchClasses: string[]): string[] {
  const pcs = [...new Set(
    pitchClasses.map((n) => Note.chroma(n)).filter((c): c is number => c != null),
  )].sort((a, b) => a - b);
  if (pcs.length === 0) return [];

  const names: string[] = [];
  for (const root of pcs) {
    const offsets = pcs.map((pc) => ((pc - root) % 12 + 12) % 12).sort((a, b) => a - b);
    for (const t of TEMPLATES) {
      if (t.offsets.length !== offsets.length) continue;
      if (t.offsets.every((o, i) => o === offsets[i])) {
        names.push(`${PITCH_CLASSES[root]}${t.suffix}`);
      }
    }
  }
  return names;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd packages/chordl-voicings && npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-voicings/src/spellings.ts packages/chordl-voicings/test/spellings.test.ts packages/chordl-voicings/src/index.ts
git commit -m "feat(voicings): name every chord a pitch-class set spells"
```

---

### Task 8: Changelog and final verification

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the entry under Unreleased**

Say what changed for a user: the level control now filters piano voicings as well as guitar shapes; most qualities have no beginner voicing and the frame says so rather than emptying; the power chord gains a two-note beginner shell. Name `spellingsFor` as added-but-unrendered so nobody looks for its UI.

- [ ] **Step 2: Run everything**

```bash
npm test && npm run lint && npm run build
```

`packages/chordl-react/tsconfig.json` has `include: ["src"]`, so `dev/App.tsx` is not typechecked by the normal build. Typecheck it separately with an out-of-tree tsconfig extending the real `compilerOptions` with `dev/**` added to `include`, run with `--noEmit`, and confirm via `--listFiles` that `dev/App.tsx` was actually in the program. Leave no scratch files in the repo.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: changelog for piano experience levels"
```

---

## Open questions this plan does not answer

- **Does `min7` belong in the core set?** It is excluded here (Task 1), which is a change from the status quo where it has beginner shells by accident of sharing the maj7/dom7 shell shapes. If the answer is yes, it is one line in `CORE_TEMPLATES` plus a corpus-snapshot update.
- **Reachability.** Six library entries cannot be selected in the app at all — `findVoicing`/`generateVariants` keep only the first entry per (quality, style), and `inferStyle` never returns "Rootless Type B". Task 3 works around this by ordering the new entry first. The underlying bug is its own change.
- **Two render paths still place voicings by diatonic letter** — the slash-bass branch and the progression renderer (recorded in #57). A voicing ranked by its declared placement will be drawn at a different one in those two paths.
