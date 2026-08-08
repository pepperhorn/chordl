# chordl-guitar Gap-Closing Implementation Plan (Phase B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `@pepperhorn/chordl-guitar` the three capabilities `frames` needs but the package does not yet have, and release it as 0.3.0.

**Architecture:** Additive only. Three capabilities — `(key, suffix)` lookup that bypasses label parsing, an iterator over the chord library, and power chords generalised to bass — then the public surface, version and changelog. Nothing existing changes behaviour.

**Tech Stack:** TypeScript (ESM), Vitest 4, `@tombatossals/chords-db` 0.5.1 (already a runtime dependency), `svguitar` 2.5.1.

**Spec:** `docs/superpowers/specs/2026-08-09-frames-migration-design.md`

## Global Constraints

- Package directory: `/home/shaun/chordl/packages/chordl-guitar`. All paths below are relative to it.
- Run tests with `pnpm test:run` (runs `build:data` first — required, the generated JSON is gitignored).
- **Never modify `scripts/build-data.mjs` or `test/generated-data.test.ts`.** Stripping `midi`/`capo` from the shipped JSON is deliberate and tested; pitches are derived.
- **`openMidi` is always chords-db index order** — `openMidi[i]` is the string `frets[i]` refers to, never svguitar's highest-pitch-first numbering. Exactly one place inverts string order: `dbPositionToChord`. Do not touch it.
- **Additive only.** No existing export may change signature or behaviour. `lookupGuitarChord`, `hasGuitarChord`, `selectVoicings`, `canonicalPositionIndex`, `positionFacts`, `positionToMidi` all stay exactly as they are.
- Unknown input returns `null` or an empty result. Never invent or guess a shape.
- `chordl-guitar` depends only on `@tombatossals/chords-db` and `svguitar` — **no workspace dependencies**, which is what lets it publish standalone. Do not add any dependency, and never import from `chordl-core` or `chordl-voicings`.
- Repo style: double quotes, 2-space indent, `export function` for public API.
- Baseline: package 11 files / 116 tests; repo-wide 35 files / 474 tests, zero failures. Confirm before starting.
- Work on a branch off `origin/main`: `feat/guitar-enumeration`.

---

### Task 1: `(key, suffix)` lookup

**Files:**
- Modify: `src/chordLookup.ts` (append)
- Test: `test/chordLookup.test.ts` (append)

**Interfaces:**
- Consumes: `dbFor`, `GuitarChordResult`, `INSTRUMENTS`, `dbPositionToChord` (all existing in the module)
- Produces: `lookupChordByKeySuffix(key: string, suffix: string, instrument?: InstrumentId): GuitarChordResult | null`

**Why this is distinct from `lookupGuitarChord`:** that function takes a parsed *label* (`"Am"`, `"F#m7"`) and runs it through `splitLabel` → `ROOT_TO_DB_KEYS` → `toDbSuffix` before searching. `frames`' `/api/frame` instead accepts chords-db's **own raw container key and exact suffix** (`"Csharp"`, `"major"`) with no aliasing at all. Reconstructing a label from those and re-parsing it would change the API's error text and could round-trip incorrectly through the enharmonic table. A direct lookup preserves the existing semantics exactly.

**The `label` field:** `GuitarChordResult.label` is documented as "the chord label as given". There is no given label here, so synthesise the conventional one — `key + suffix`, with `"major"` rendered as the empty suffix, matching how `frames` builds its default title.

- [ ] **Step 1: Write the failing test**

Append to `test/chordLookup.test.ts`:

```ts
import { lookupChordByKeySuffix } from "../src/chordLookup";

describe("lookupChordByKeySuffix", () => {
  it("finds an entry by chords-db's own key and exact suffix", () => {
    const r = lookupChordByKeySuffix("C", "major")!;
    expect(r).not.toBeNull();
    expect(r.instrument).toBe("guitar");
    expect(r.positions.length).toBeGreaterThan(0);
    expect(r.shapes.length).toBe(r.positions.length);
  });

  it("returns positions in chords-db's stored order, matching lookupGuitarChord", () => {
    const byKey = lookupChordByKeySuffix("C", "major")!;
    const byLabel = lookupGuitarChord("C")!;
    expect(byKey.positions).toEqual(byLabel.positions);
  });

  it("does not alias the key — chords-db's spelling is required", () => {
    expect(lookupChordByKeySuffix("Csharp", "major")).not.toBeNull();
    expect(lookupChordByKeySuffix("C#", "major")).toBeNull();
  });

  it("does not alias the suffix", () => {
    expect(lookupChordByKeySuffix("A", "minor")).not.toBeNull();
    expect(lookupChordByKeySuffix("A", "m")).toBeNull();
  });

  it("synthesises a label, omitting the suffix for major", () => {
    expect(lookupChordByKeySuffix("C", "major")!.label).toBe("C");
    expect(lookupChordByKeySuffix("C", "7")!.label).toBe("C7");
  });

  it("uses the ukulele library when asked", () => {
    const r = lookupChordByKeySuffix("C", "major", "ukulele")!;
    expect(r.instrument).toBe("ukulele");
    expect(r.shapes[0].fingers.length).toBeGreaterThan(0);
  });

  it("returns null for an unknown chord and for an instrument chords-db does not cover", () => {
    expect(lookupChordByKeySuffix("C", "nope")).toBeNull();
    expect(lookupChordByKeySuffix("Zz", "major")).toBeNull();
    expect(lookupChordByKeySuffix("C", "major", "bass4")).toBeNull();
  });
});
```

Check whether `lookupGuitarChord` is already imported at the top of that file; if so, extend the existing import rather than adding a second one from the same module.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run -- chordLookup`
Expected: FAIL — `lookupChordByKeySuffix` is not exported.

- [ ] **Step 3: Implement**

Append to `src/chordLookup.ts`:

```ts
/**
 * Look up shapes by chords-db's own container key and exact suffix, with no
 * aliasing of either.
 *
 * `lookupGuitarChord` parses a musical label ("Am", "F#m7") through the
 * enharmonic and suffix tables. Some callers instead hold chords-db's raw
 * spelling already — frames' /api/frame accepts `key: "Csharp", suffix: "major"`
 * verbatim — and reconstructing a label from those only to re-parse it would
 * change their error text and could round-trip through the wrong enharmonic.
 *
 * @param key - a chords-db container key, e.g. "C", "Csharp", "Eb"
 * @param suffix - an exact chords-db suffix, e.g. "major", "minor", "7"
 * @returns null when the instrument has no library, or the key/suffix is absent
 */
export function lookupChordByKeySuffix(
  key: string,
  suffix: string,
  instrument: InstrumentId = "guitar",
): GuitarChordResult | null {
  const db = dbFor(instrument);
  if (!db) return null;

  const entries = db.chords[key];
  if (!entries) return null;

  const entry = entries.find((e) => e.suffix === suffix);
  if (!entry || entry.positions.length === 0) return null;

  // GuitarChordResult.label is "the label as given"; there is no given label
  // here, so synthesise the conventional one.
  const label = `${key}${suffix === "major" ? "" : suffix}`;
  const strings = INSTRUMENTS[instrument].strings;
  const shapes = entry.positions.map((pos) => dbPositionToChord(pos, strings, label));
  return { label, instrument, positions: entry.positions, shapes };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run -- chordLookup`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/chordLookup.ts test/chordLookup.test.ts
git commit -m "feat(guitar): look up shapes by chords-db key and suffix

Callers holding chords-db's raw spelling should not have to synthesise a
label only for it to be re-parsed through the enharmonic tables."
```

---

### Task 2: Library enumeration

**Files:**
- Create: `src/library.ts`
- Test: `test/library.test.ts`

**Interfaces:**
- Consumes: `dbFor` (needs exporting from `src/chordLookup.ts`, or move it — see below), `ChordsDbEntry`, `InstrumentId`
- Produces: `chordLibraryKeys(instrument): string[]`, `chordLibrarySuffixes(instrument): string[]`, `chordLibraryEntries(instrument): Iterable<ChordsDbEntry>`

**Why an iterator, not an array:** `ChordWorkbench.buildPresets` walks the whole library to build a preset gallery. Returning a generator lets a caller stop early or filter without materialising ~500 entries, and — the reason it is specified this way rather than as a key list — a future similarity or filtering feature can build its own index over the corpus without needing another package release.

**A structural decision to make:** `dbFor` is currently a private function in `src/chordLookup.ts`. Export it from there and import it here, rather than duplicating the guitar/ukulele branch. If exporting it feels wrong for the public surface, keep it internal by not re-exporting it from `src/index.ts` — module-level export and package-level export are separate decisions.

- [ ] **Step 1: Write the failing test**

Create `test/library.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { chordLibraryKeys, chordLibrarySuffixes, chordLibraryEntries } from "../src/library";

describe("chordLibraryKeys", () => {
  it("returns chords-db's own key spellings for guitar", () => {
    const keys = chordLibraryKeys("guitar");
    expect(keys).toContain("C");
    expect(keys).toContain("Csharp");
    expect(keys.length).toBeGreaterThan(10);
  });

  it("returns the ukulele library's spellings, which differ from guitar's", () => {
    // guitar spells accidentals "Csharp"/"Fsharp"; ukulele uses "Db"/"Gb".
    expect(chordLibraryKeys("ukulele")).toContain("Db");
  });

  it("returns an empty array for an instrument chords-db does not cover", () => {
    expect(chordLibraryKeys("bass4")).toEqual([]);
  });
});

describe("chordLibrarySuffixes", () => {
  it("returns the library's suffix vocabulary", () => {
    const s = chordLibrarySuffixes("guitar");
    expect(s).toContain("major");
    expect(s).toContain("minor");
    expect(s.length).toBeGreaterThan(10);
  });

  it("is empty for an unsupported instrument", () => {
    expect(chordLibrarySuffixes("bass5")).toEqual([]);
  });
});

describe("chordLibraryEntries", () => {
  it("yields every entry across every key", () => {
    const entries = [...chordLibraryEntries("guitar")];
    expect(entries.length).toBeGreaterThan(400);
    for (const e of entries.slice(0, 20)) {
      expect(typeof e.key).toBe("string");
      expect(typeof e.suffix).toBe("string");
      expect(e.positions.length).toBeGreaterThan(0);
    }
  });

  it("is lazy — a caller can stop early without walking the library", () => {
    let seen = 0;
    for (const _ of chordLibraryEntries("guitar")) {
      seen++;
      if (seen === 3) break;
    }
    expect(seen).toBe(3);
  });

  it("yields nothing for an unsupported instrument", () => {
    expect([...chordLibraryEntries("bass4")]).toEqual([]);
  });

  it("agrees with lookupChordByKeySuffix on every entry it yields", () => {
    // Spot-check the first 25 rather than all ~500 — this is a consistency
    // check between two views of the same data, not a corpus test.
    const entries = [...chordLibraryEntries("guitar")].slice(0, 25);
    for (const e of entries) {
      const r = lookupChordByKeySuffix(e.key, e.suffix);
      expect(r, `${e.key}${e.suffix}`).not.toBeNull();
      expect(r!.positions).toEqual(e.positions);
    }
  });
});
```

Add `import { lookupChordByKeySuffix } from "../src/chordLookup";` at the top for the last test.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run -- library`
Expected: FAIL — cannot find module `../src/library`.

- [ ] **Step 3: Export `dbFor`**

In `src/chordLookup.ts`, change `function dbFor(` to `export function dbFor(` and extend its doc comment to note it is internal to the package and deliberately not re-exported from the index.

- [ ] **Step 4: Write `src/library.ts`**

```ts
/**
 * Enumeration over a chords-db library.
 *
 * Consumers that build a gallery, an index, or a similarity search need to walk
 * the corpus rather than look up one chord at a time. Entries are yielded lazily
 * so a caller can stop early or filter without materialising the whole library.
 */
import { dbFor } from "./chordLookup";
import type { ChordsDbEntry, InstrumentId } from "./instruments";

/** chords-db's own container key spellings. Empty when the instrument has no library. */
export function chordLibraryKeys(instrument: InstrumentId = "guitar"): string[] {
  const db = dbFor(instrument);
  return db ? [...db.keys] : [];
}

/** The library's suffix vocabulary. Empty when the instrument has no library. */
export function chordLibrarySuffixes(instrument: InstrumentId = "guitar"): string[] {
  const db = dbFor(instrument);
  return db ? [...db.suffixes] : [];
}

/**
 * Every entry in the library, key by key, in chords-db's stored order.
 *
 * Lazy: the generator yields as it walks, so `for (const e of …) { …; break; }`
 * costs only what it consumed.
 */
export function* chordLibraryEntries(
  instrument: InstrumentId = "guitar",
): Generator<ChordsDbEntry> {
  const db = dbFor(instrument);
  if (!db) return;
  for (const key of db.keys) {
    const entries = db.chords[key];
    if (!entries) continue;
    yield* entries;
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test:run -- library`
Expected: PASS.

Note: `db.keys` is chords-db's own key list. If iterating it misses entries present in `db.chords` (the two could disagree), the "yields every entry" test will show a lower count than expected — if that happens, report the discrepancy rather than silently switching to `Object.keys(db.chords)`, because which one is authoritative is a real question about the data.

- [ ] **Step 6: Commit**

```bash
git add src/library.ts test/library.test.ts src/chordLookup.ts
git commit -m "feat(guitar): enumerate the chord library

Lazy generator over entries, plus the key and suffix vocabularies, so
consumers can build galleries and indexes without importing chords-db."
```

---

### Task 3: Power chords for bass

**Files:**
- Modify: `src/powerChords.ts`
- Test: `test/powerChords.test.ts` (append)

**Interfaces:**
- Consumes: `INSTRUMENTS`, `dbPositionToChord`, `positionToMidi`
- Produces: `PowerChordOptions` gains `instrument?: "guitar" | "bass4" | "bass5"` (default `"guitar"`)

**Why this works:** bass strings are all perfect fourths — `bass4` `openMidi` is `[28, 33, 38, 43]`, consecutive differences 5, 5, 5. The existing rule (root on one string, fifth two frets up on the next, octave two frets up on the one after) depends only on adjacent strings being a fourth apart, so it transfers to bass unchanged. Guitar's G–B pair is a major third, which is why the existing `stringSet` is limited to `"E"` and `"A"` — bass has no such irregularity, but `bass4` has only 4 strings so an octave-inclusive shape from the A string needs care.

**Bounds to respect:** `bass4` has 4 strings, `bass5` has 5. A three-note shape rooted at index `i` writes indices `i`, `i+1`, `i+2`, so on `bass4` the root may not be above index 1. Return `null` rather than writing out of range.

- [ ] **Step 1: Write the failing test**

Append to `test/powerChords.test.ts`:

```ts
describe("powerChordPosition — bass", () => {
  const bass4 = INSTRUMENTS.bass4.openMidi;

  it("puts G5 at the 3rd fret of the low E string on bass4", () => {
    const pos = powerChordPosition(7, { stringSet: "E", instrument: "bass4" })!;
    expect(pos.baseFret).toBe(3);
    expect(pos.frets).toEqual([1, 3, 3, -1]);
    // G1 D2 G2
    expect(positionToMidi(pos, bass4)).toEqual([31, 38, 43]);
  });

  it("uses the nut for an open E5 on bass4", () => {
    const pos = powerChordPosition(4, { stringSet: "E", instrument: "bass4" })!;
    expect(pos.baseFret).toBe(1);
    expect(pos.frets).toEqual([0, 2, 2, -1]);
    expect(positionToMidi(pos, bass4)).toEqual([28, 35, 40]);
  });

  it("sounds root and fifth for every root on bass4", () => {
    for (let pc = 0; pc < 12; pc++) {
      const pos = powerChordPosition(pc, { stringSet: "E", instrument: "bass4" })!;
      const pcs = new Set(positionToMidi(pos, bass4).map((m) => m % 12));
      expect([...pcs].sort((a, b) => a - b), `pc ${pc}`).toEqual(
        [pc % 12, (pc + 7) % 12].sort((a, b) => a - b),
      );
    }
  });

  it("returns null when the shape would run off the end of the fretboard", () => {
    // bass4 has 4 strings: a three-note shape cannot start on the D string.
    expect(powerChordPosition(0, { stringSet: "D", instrument: "bass4" } as never)).toBeNull();
  });

  it("supports the low B string on bass5", () => {
    const bass5 = INSTRUMENTS.bass5.openMidi;
    const pos = powerChordPosition(11, { stringSet: "B", instrument: "bass5" } as never)!;
    expect(positionToMidi(pos, bass5)[0] % 12).toBe(11);
  });

  it("leaves guitar behaviour unchanged", () => {
    const guitar = INSTRUMENTS.guitar.openMidi;
    const pos = powerChordPosition(7, { stringSet: "E" })!;
    expect(pos.frets).toEqual([1, 3, 3, -1, -1, -1]);
    expect(positionToMidi(pos, guitar)).toEqual([43, 50, 55]);
  });
});
```

The `stringSet` values for bass are a design decision you must settle in Step 3 — the test above assumes string sets are named for the string that carries the root (`"E"`, `"A"`, `"D"` on bass4; `"B"`, `"E"`, `"A"`, `"D"` on bass5). If you choose a different scheme, update these assertions to match and say so in your report. The `as never` casts are placeholders for whatever type you land on; remove them once the type covers the value.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run -- powerChords`
Expected: FAIL — `instrument` is not a valid option.

- [ ] **Step 3: Generalise the implementation**

Widen `PowerChordStringSet` and `PowerChordOptions` to cover bass, replace the hardcoded `INSTRUMENTS.guitar` with a lookup on `opts.instrument`, size the `frets`/`fingers` arrays from `INSTRUMENTS[instrument].strings` rather than the literal `6`, and return `null` when `rootIdx + 2` (or `+1` without the octave) would exceed the string count.

Keep the two-branch open/fretted encoding exactly as it is — both encodings must still yield identical pitches through `positionToMidi`, which the existing guitar tests already assert.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run -- powerChords`
Expected: PASS, including the unchanged guitar assertions.

- [ ] **Step 5: Compare against frames' hand-authored shapes**

`frames` carries `BASS_PRESETS` in `src/lib/staticPresets.ts` — roughly 110 lines of hand-fingered bass power chords keyed `(key, suffix: "5")`. Write a throwaway script that generates the equivalent shape for each preset and diffs the resulting `frets`, `fingers` and sounding pitches.

Report the comparison in full. If the generated shapes match musically (same pitches, possibly different finger numbers), say so — that is the green light for frames to delete its presets. **If any differ musically, do not adjust the generator to match**: report which chords differ and how, because a hand-authored shape that disagrees with the formula is a musical judgement worth understanding before it is overwritten.

Delete the script before committing.

- [ ] **Step 6: Commit**

```bash
git add src/powerChords.ts test/powerChords.test.ts
git commit -m "feat(guitar): generate power chords for bass4 and bass5

Bass strings are all perfect fourths, so the existing root/+2-frets rule
transfers unchanged. Guitar behaviour is untouched."
```

---

### Task 4: Public API, version and changelog

**Files:**
- Modify: `src/index.ts`
- Modify: `package.json`
- Modify: `../../CHANGELOG.md`
- Test: `test/publicApi.test.ts` (append)

**Interfaces:**
- Consumes: everything from Tasks 1–3
- Produces: the 0.3.0 public surface

- [ ] **Step 1: Write the failing test**

Append to `test/publicApi.test.ts`:

```ts
describe("public API — 0.3.0 additions", () => {
  it("exports lookup, enumeration and bass power chords", () => {
    for (const name of [
      "lookupChordByKeySuffix",
      "chordLibraryKeys",
      "chordLibrarySuffixes",
      "chordLibraryEntries",
    ]) {
      expect(api, `missing export ${name}`).toHaveProperty(name);
    }
  });

  it("keeps dbFor internal to the package", () => {
    expect(api).not.toHaveProperty("dbFor");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run -- publicApi`
Expected: FAIL.

- [ ] **Step 3: Update `src/index.ts`**

Add `lookupChordByKeySuffix` to the existing `./chordLookup` export line, and add a new block:

```ts
export {
  chordLibraryKeys,
  chordLibrarySuffixes,
  chordLibraryEntries,
} from "./library";
```

Do **not** export `dbFor` — it is exported at module level so `library.ts` can use it, and that is a different decision from exposing it on the package surface.

- [ ] **Step 4: Bump the version**

`package.json`: `0.2.0` → `0.3.0`. Additive, so a minor bump.

- [ ] **Step 5: Add the changelog entry**

Under the existing `## Unreleased` heading in `/home/shaun/chordl/CHANGELOG.md` — **the repository root, which from this package is `../../CHANGELOG.md`**. Do not create a second `Unreleased` heading and do not edit released sections.

Cover: `lookupChordByKeySuffix` and why it exists alongside `lookupGuitarChord`; the three enumeration functions and the laziness of `chordLibraryEntries`; power chords for `bass4`/`bass5`. State plainly that nothing existing changed.

- [ ] **Step 6: Verify the whole monorepo**

Run, from the repository root (two levels up): `pnpm build && pnpm test:run`
Expected: all packages build; totals are the 35 files / 474 tests baseline plus this branch's additions, zero failures.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts package.json ../../CHANGELOG.md test/publicApi.test.ts
git commit -m "feat(guitar): publish key/suffix lookup and library enumeration as 0.3.0"
```

---

### Task 5: Prepare the release

**Files:**
- Create: `RELEASING.md` in the package directory

**Interfaces:**
- Consumes: the 0.3.0 surface
- Produces: a verified, publishable package — but **does not publish it**

**Why publishing is not a step here:** `npm publish` needs registry credentials this plan cannot assume, and it is irreversible — a published version number can never be reused. The release is prepared and verified; a human runs the final command.

- [ ] **Step 1: Verify the package contents**

Run: `pnpm build && npm pack --dry-run`

Confirm the tarball contains `dist/` and nothing else of substance (`files: ["dist"]`), that `dist/index.js` and `dist/index.d.ts` exist, and that the generated slim JSON is inside `dist` — it is gitignored in source but must ship, since `chordLookup` imports it.

**If the generated JSON is missing from the tarball, stop and report it.** That would mean the published package cannot look up any chord, and it is exactly the kind of failure that only appears after publishing.

- [ ] **Step 2: Verify it resolves as a consumer would**

From a scratch directory outside the repo, `npm pack` the built package and install the tarball into an empty project, then import it and call `lookupChordByKeySuffix("C", "major")` and `[...chordLibraryEntries("guitar")].length`.

This is worth doing rather than assuming: the package is ESM-only with no `require` condition, and its built output has been observed to emit extensionless relative specifiers and a JSON import without an import attribute — both fine under a bundler, both potentially fatal in plain Node. **Report exactly what happens, including any failure.** Whether that blocks the release is a decision for the controller, not for you to work around.

- [ ] **Step 3: Write `RELEASING.md`**

Record: the exact publish command, the prerequisite that `pnpm build` must run first (because `dist/` is gitignored), the result of the Step 2 consumer check, and a note that `chordl-guitar` has no workspace dependencies and so publishes without coordinating `chordl-core` or `chordl-voicings`.

- [ ] **Step 4: Commit**

```bash
git add RELEASING.md
git commit -m "docs(guitar): record the release procedure and consumer verification"
```

---

## Self-Review

**Spec coverage:** Phase B of the spec lists four items — `(key, suffix)` lookup (Task 1), library enumeration as an iterator (Task 2), power chords extended to bass with a diff against frames' presets (Task 3, Step 5), and publishing 0.3.0 (Tasks 4 and 5).

**Deliberately not automated:** the `npm publish` itself. Task 5 prepares and verifies; a human runs the command.

**Known open question, flagged rather than resolved:** Task 5 Step 2 may find that the published package does not import cleanly in plain Node. That risk is pre-existing and was observed twice during earlier work; it is surfaced here as a verification step rather than a fix, because fixing it means changing `moduleResolution` across the monorepo — well outside this plan's scope, and a decision for the controller once there is evidence.

**Test-count expectation:** Tasks 1–4 add roughly 20 tests. The plan does not pin an exact total, because Task 3's bass string-set scheme is a design decision left to the implementer and changes the count.
