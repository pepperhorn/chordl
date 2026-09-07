/**
 * Generate src/top3Generated.ts — the three-string (G B E) voicing table for
 * the `guitar-top3` instrument.
 *
 * Design: docs/superpowers/specs/2026-09-07-guitar-top3-generated-voicings-design.md
 *
 * Unlike scripts/build-data.mjs, the output of this script is **checked in**.
 * It is ~500 shapes a human should be able to review in a diff, because a wrong
 * shape is unrecoverable once printed. test/top3Generated.test.ts re-runs
 * `renderTop3Source()` and asserts the checked-in file is byte-identical, so the
 * generator and its output cannot drift apart.
 *
 * ── String-order conventions, stated once ────────────────────────────────────
 *
 * chords-db `frets` and `InstrumentConfig.openMidi` run **low → high**, so the
 * top three strings are indices 3 (G3), 4 (B3), 5 (E4).
 *
 * svguitar numbers strings from the **highest** pitch, so those same strings are
 * svguitar 3 (G), 2 (B), 1 (E).
 *
 * This script works internally in `[g, b, e]` order — low → high, matching
 * chords-db — and the emitted table is documented as `[g, b, e]` too.
 * staticPresets.ts turns each row into svguitar fingers 3/2/1. That is the only
 * place string order is re-expressed, and it is a relabelling, not an inversion:
 * `dbPositionToChord` remains the single function that inverts.
 *
 * Frets in the emitted table are **absolute** (0 = open, measured from the nut),
 * exactly as the hand-authored table was. chords-db positions are not: a fret
 * value f > 0 sounds at `baseFret - 1 + f`, while -1 (muted) and 0 (open) are
 * sentinels that are never offset.
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

// ── Roots ────────────────────────────────────────────────────────────────────

/**
 * chords-db container key → pitch class.
 *
 * The container keys are `Csharp`/`Fsharp` (not `C#`/`F#`) and `Eb`/`Ab`/`Bb`.
 * `rootPitchClass()` parses *labels*, and its regex matches only the leading
 * `C` of "Csharp" — it would silently return 0. Hence an explicit map.
 */
const DB_KEY_PC = {
  C: 0, Csharp: 1, D: 2, Eb: 3, E: 4, F: 5,
  Fsharp: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11,
};

/** chords-db container key → the label the table (and `lookupTop3Chord`) uses. */
const DB_KEY_LABEL = {
  C: "C", Csharp: "C#", D: "D", Eb: "Eb", E: "E", F: "F",
  Fsharp: "F#", G: "G", Ab: "Ab", A: "A", Bb: "Bb", B: "B",
};

// ── Chord tones ──────────────────────────────────────────────────────────────

/**
 * Intervals above the root, by role, for every suffix chords-db ships.
 *
 * `third` is the 3rd (major or minor); `sus` replaces it where a chord has no
 * 3rd; `fifth` covers altered fifths too. `seventh`/`sixth`/`ninth`/`eleventh`/
 * `thirteenth` are the tones that *name* the chord beyond the triad.
 *
 * Slash suffixes ("/E", "m/G") name a bass note, which no three-string voicing
 * on G-B-E can sound; the chord above it is a plain triad, so that is what they
 * carry here.
 */
const SUFFIX_ROLES = {
  major: { third: 4, fifth: 7 },
  minor: { third: 3, fifth: 7 },
  dim: { third: 3, fifth: 6 },
  dim7: { third: 3, fifth: 6, seventh: 9 },
  sus2: { sus: 2, fifth: 7 },
  sus4: { sus: 5, fifth: 7 },
  "7sus4": { sus: 5, fifth: 7, seventh: 10 },
  // chords-db's "7sg" positions sound a plain dominant 7th in every key.
  "7sg": { third: 4, fifth: 7, seventh: 10 },
  aug: { third: 4, fifth: 8 },
  6: { third: 4, fifth: 7, sixth: 9 },
  69: { third: 4, fifth: 7, sixth: 9, ninth: 2 },
  7: { third: 4, fifth: 7, seventh: 10 },
  "7b5": { third: 4, fifth: 6, seventh: 10 },
  aug7: { third: 4, fifth: 8, seventh: 10 },
  9: { third: 4, fifth: 7, seventh: 10, ninth: 2 },
  "9b5": { third: 4, fifth: 6, seventh: 10, ninth: 2 },
  aug9: { third: 4, fifth: 8, seventh: 10, ninth: 2 },
  "7b9": { third: 4, fifth: 7, seventh: 10, ninth: 1 },
  "7#9": { third: 4, fifth: 7, seventh: 10, ninth: 3 },
  11: { third: 4, fifth: 7, seventh: 10, ninth: 2, eleventh: 5 },
  "9#11": { third: 4, fifth: 7, seventh: 10, ninth: 2, eleventh: 6 },
  13: { third: 4, fifth: 7, seventh: 10, ninth: 2, eleventh: 5, thirteenth: 9 },
  maj7: { third: 4, fifth: 7, seventh: 11 },
  "maj7b5": { third: 4, fifth: 6, seventh: 11 },
  "maj7#5": { third: 4, fifth: 8, seventh: 11 },
  maj9: { third: 4, fifth: 7, seventh: 11, ninth: 2 },
  maj11: { third: 4, fifth: 7, seventh: 11, ninth: 2, eleventh: 5 },
  maj13: { third: 4, fifth: 7, seventh: 11, ninth: 2, eleventh: 5, thirteenth: 9 },
  m6: { third: 3, fifth: 7, sixth: 9 },
  m69: { third: 3, fifth: 7, sixth: 9, ninth: 2 },
  m7: { third: 3, fifth: 7, seventh: 10 },
  "m7b5": { third: 3, fifth: 6, seventh: 10 },
  m9: { third: 3, fifth: 7, seventh: 10, ninth: 2 },
  m11: { third: 3, fifth: 7, seventh: 10, ninth: 2, eleventh: 5 },
  mmaj7: { third: 3, fifth: 7, seventh: 11 },
  "mmaj7b5": { third: 3, fifth: 6, seventh: 11 },
  mmaj9: { third: 3, fifth: 7, seventh: 11, ninth: 2 },
  mmaj11: { third: 3, fifth: 7, seventh: 11, ninth: 2, eleventh: 5 },
  add9: { third: 4, fifth: 7, ninth: 2 },
  madd9: { third: 3, fifth: 7, ninth: 2 },
  /**
   * The altered dominant, and the one quality with no three-string voicing at all.
   *
   * It needs four notes to exist: the 3rd and the b7 that make it a dominant,
   * plus the alteration it is named for. Any three of them drop one of those
   * three jobs and name a different chord — without the alteration it is a plain
   * dominant 7th; without the b7 it is a triad. chords-db agrees in its own way:
   * its `alt` positions sound root-3rd-b5 on the top strings and spread the b7
   * onto a string this instrument mutes.
   *
   * So `alt` is `unvoiceable` — the table says nothing rather than something wrong.
   */
  alt: { third: 4, seventh: 10, extra: [1, 3, 6, 8], unvoiceable: true },
};

/** "/E", "m/G" and friends: a plain triad over a named bass. */
function rolesForSuffix(suffix) {
  const direct = SUFFIX_ROLES[suffix];
  if (direct) return direct;
  if (suffix.startsWith("m/")) return SUFFIX_ROLES.minor;
  if (suffix.startsWith("/")) return SUFFIX_ROLES.major;
  return null;
}

/** Every pitch class the chord contains, as a sorted array of intervals. */
function toneIntervals(roles) {
  const out = new Set([0]);
  for (const key of ["third", "sus", "fifth", "seventh", "sixth", "ninth", "eleventh", "thirteenth"]) {
    if (roles[key] !== undefined) out.add(roles[key]);
  }
  for (const x of roles.extra ?? []) out.add(x);
  return [...out].sort((a, b) => a - b);
}

/**
 * The tones without which the chord is a different chord.
 *
 * Exactly two are droppable, and everything else names the chord:
 *
 *   - the **root**, because a rootless voicing is a real voicing. Dropping it is
 *     what made `Am7` print C major, so it is never dropped silently — an entry
 *     without its root is marked `approximate`.
 *   - the **perfect fifth**, because it is the one tone a listener supplies for
 *     themselves. This is the design's "drop the 5th". An *altered* fifth is not
 *     droppable: `C7b5` without its b5 is `C7`.
 *
 * The 9th, 11th, 13th and 6th are therefore essential, not optional colour. An
 * earlier version ranked them below the 7th and so reduced `C9` to root-3rd-b7,
 * which is a `C7` printed under a `C9` label — the same fault as the rootless
 * presets, one tone further out.
 */
function essentialIntervals(roles) {
  const droppable = new Set([0]);
  if (roles.fifth === 7) droppable.add(7);
  return toneIntervals(roles).filter((i) => !droppable.has(i));
}

/**
 * The three tones to build from, or null where three is not enough.
 *
 * Root plus everything essential; where that leaves room, the 5th comes back to
 * fill it. A chord needing four essential tones — `C9` (3rd, b7, 9th), `C7b5`
 * (3rd, b5, b7), every diminished 7th — has no three-note version that keeps its
 * name, so nothing is constructed for it and it takes what the corpus offers.
 */
function reductionIntervals(roles) {
  const essential = essentialIntervals(roles);
  const set = new Set([0, ...essential]);
  if (set.size < 3 && roles.fifth !== undefined) set.add(roles.fifth);
  return set.size === 3 ? [...set].sort((a, b) => a - b) : null;
}

// ── Shape geometry ───────────────────────────────────────────────────────────

/** Open-string MIDI for G3, B3, E4 — INSTRUMENTS["guitar-top3"].openMidi[3..5]. */
const OPEN_MIDI = [55, 59, 64];

/** Absolute fret for a chords-db value: -1 and 0 are sentinels, never offset. */
function absoluteFret(f, baseFret) {
  return f <= 0 ? f : baseFret - 1 + f;
}

/** Stretch across the fretted strings; open strings need no finger, so no reach. */
function spanOf(frets) {
  const fretted = frets.filter((f) => f > 0);
  return fretted.length < 2 ? 0 : Math.max(...fretted) - Math.min(...fretted);
}

function pitchesOf(frets) {
  return frets.map((f, i) => OPEN_MIDI[i] + f);
}

function pitchClassesOf(frets) {
  return new Set(pitchesOf(frets).map((m) => m % 12));
}

/**
 * Frets a diagram draws.
 *
 * This must equal `INSTRUMENTS["guitar-top3"].frets`, which is what decides the
 * window at render time. It is a literal rather than an import because the
 * script is plain ESM and `src/instruments.ts` is TypeScript; the two are pinned
 * together by test/top3Generated.test.ts, which fails if they drift.
 *
 * Changing it changes which shapes are eligible, so it is a change to the table,
 * not just to the picture.
 */
export const DIAGRAM_FRETS = 4;

/**
 * Can a reader actually see this shape?
 *
 * A diagram is drawn either from the nut or from a window that slides up the
 * neck, and an open string exists only at the nut. So a shape that mixes an open
 * string with a note past the window can be drawn in neither: slide the window
 * and the open string is gone, keep it at the nut and the fretted note falls off
 * the picture. `[0, 5, 5]` and `[8, 0, 8]` are unreadable however well they spell
 * the chord.
 *
 * Everything else is fine. Span is already ≤2, so any shape without an open
 * string fits inside a window at its own lowest fret.
 */
function renderable(frets) {
  const fretted = frets.filter((f) => f > 0);
  const highest = fretted.length ? Math.max(...fretted) : 0;
  return highest <= DIAGRAM_FRETS || !frets.includes(0);
}

/** One finger per fret, lowest fret = index finger. Open strings carry no label. */
function fingersFor(frets) {
  const fretted = frets.filter((f) => f > 0);
  if (fretted.length === 0) return ["", "", ""];
  const min = Math.min(...fretted);
  return frets.map((f) => (f > 0 ? String(1 + f - min) : ""));
}

const keyOf = (frets) => frets.join(",");

// ── Ambiguity ────────────────────────────────────────────────────────────────

/**
 * The complete three-note chords a listener names on hearing them. A shape whose
 * pitch classes match one of these on a *different* root is telling the listener
 * the wrong chord — that is what "unambiguous" excludes.
 */
const TRIAD_TYPES = {
  major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6],
  aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7],
};

const TRIAD_INDEX = new Map();
for (const [name, ivs] of Object.entries(TRIAD_TYPES)) {
  for (let root = 0; root < 12; root++) {
    const k = ivs.map((i) => (root + i) % 12).sort((a, b) => a - b).join(",");
    if (!TRIAD_INDEX.has(k)) TRIAD_INDEX.set(k, []);
    TRIAD_INDEX.get(k).push({ name, root });
  }
}

function namesAnotherChord(pcs, root) {
  const k = [...pcs].sort((a, b) => a - b).join(",");
  const hits = TRIAD_INDEX.get(k);
  if (!hits) return false;
  return hits.some((h) => h.root !== root);
}

/** Qualities that are stacks of equal intervals, so one shape names several roots. */
const SYMMETRIC_SUFFIXES = new Set(["dim", "dim7", "aug"]);

/**
 * Two chords may print the same diagram only when they are the same notes.
 *
 * This is the whole of fault 3: `Am7` and `C major` are *different* note sets,
 * so one diagram cannot stand for both. Three families are different labels for
 * one set, and no amount of generation separates them:
 *
 *   - a slash chord and its triad — G-B-E cannot sound a bass note, so `C/G`
 *     and `C` are three identical notes;
 *   - a sus2 and the sus4 a fifth above — `Csus2` and `Gsus4` are both C-D-G;
 *   - the symmetric qualities, where one shape genuinely names three roots
 *     (aug) or four (dim7).
 *
 * The tone set is the grouping key, so all three fall out of one rule.
 */
function toneSetKey(rootPc, roles) {
  return toneIntervals(roles).map((i) => (rootPc + i) % 12).sort((a, b) => a - b).join(",");
}

/**
 * Who picks first when shapes are scarce.
 *
 * The design commits to all 12 roots for these eleven qualities, so they choose
 * before an altered thirteenth does. Everything else keeps chords-db's own
 * suffix order behind them.
 */
const QUALITY_PRIORITY = [
  "major", "minor", "7", "m7", "maj7", "6", "9", "sus2", "sus4", "dim", "aug",
];

// ── Candidate evaluation ─────────────────────────────────────────────────────

function describe(frets, rootPc, roles) {
  const pcs = pitchClassesOf(frets);
  const rel = new Set([...pcs].map((pc) => (pc - rootPc + 12) % 12));
  const tones = new Set(toneIntervals(roles));
  const inChord = [...rel].every((i) => tones.has(i));
  const essential = essentialIntervals(roles);
  const fretted = frets.filter((f) => f > 0);
  /** The shape sounds the whole chord — nothing has been dropped to fit. */
  const whole = inChord && pcs.size === tones.size;
  const ambiguous = namesAnotherChord(pcs, rootPc);
  return {
    frets,
    pcs,
    inChord,
    hasRoot: rel.has(0),
    /**
     * Every tone that names the chord is sounding, and the shape is grounded.
     *
     * "Grounded" is the design's "root-or-5th", and it applies only where there
     * is room for it: a chord with three essential tones fills all three strings
     * with them, and the standard voicing of exactly those chords — the rootless
     * 3rd-b7-9th shell of a 9th, the 3rd-b5-b7 of a 7b5 — is grounded by nothing
     * but the label. Where two tones name the chord, the third string owes the
     * listener the root or the fifth.
     */
    complete:
      inChord &&
      essential.every((i) => rel.has(i)) &&
      (essential.length >= 3 ||
        rel.has(0) ||
        (roles.fifth !== undefined && rel.has(roles.fifth))),
    ambiguous,
    /**
     * The shape spells a complete chord rooted somewhere else *and* it got there
     * by dropping something. A shape that is the whole of its own chord is not
     * misleading however many names it answers to: an augmented triad genuinely
     * names three roots, and `Csus2` and `Gsus4` are the same three notes.
     */
    misleading: ambiguous && !whole,
    whole,
    distinct: pcs.size,
    highestFret: Math.max(...frets),
    span: spanOf(frets),
    opens: frets.filter((f) => f === 0).length,
    /** Distinct fretted frets — a mini-barre is one finger, not two. */
    fingerCount: new Set(fretted).size,
  };
}

/** Within a tier: highest fret asc, span asc, opens desc, fingers asc. */
function rankCompare(a, b) {
  return (
    a.highestFret - b.highestFret ||
    a.span - b.span ||
    b.opens - a.opens ||
    a.fingerCount - b.fingerCount ||
    keyOf(a.frets).localeCompare(keyOf(b.frets))
  );
}

// ── Sources ──────────────────────────────────────────────────────────────────

/**
 * The hand-authored table this replaces, verbatim, in `[g, b, e]` absolute
 * frets with its original finger labels.
 *
 * Fifteen of the twenty keep their shape (tier 1). The other five — D7, A7,
 * Am7, Dm7, Fmaj7 — drop the root, which makes each of them spell some other
 * chord, so they do not qualify and are regenerated.
 */
const LEGACY = [
  { key: "C", suffix: "major", frets: [0, 1, 0], fingers: ["", "1", ""] },
  { key: "G", suffix: "major", frets: [0, 0, 3], fingers: ["", "", "3"] },
  { key: "D", suffix: "major", frets: [2, 3, 2], fingers: ["1", "3", "2"] },
  { key: "A", suffix: "major", frets: [2, 2, 0], fingers: ["1", "2", ""] },
  { key: "E", suffix: "minor", frets: [0, 0, 0], fingers: ["", "", ""] },
  { key: "A", suffix: "minor", frets: [2, 1, 0], fingers: ["2", "1", ""] },
  { key: "D", suffix: "minor", frets: [2, 3, 1], fingers: ["2", "3", "1"] },
  { key: "E", suffix: "major", frets: [1, 0, 0], fingers: ["1", "", ""] },
  { key: "C", suffix: "7", frets: [3, 1, 0], fingers: ["3", "1", ""] },
  { key: "G", suffix: "7", frets: [0, 0, 1], fingers: ["", "", "1"] },
  { key: "B", suffix: "minor", frets: [4, 3, 2], fingers: ["3", "2", "1"] },
  { key: "F", suffix: "major", frets: [2, 1, 1], fingers: ["2", "1", "1"] },
  { key: "D", suffix: "7", frets: [2, 1, 2], fingers: ["2", "1", "3"] },
  { key: "E", suffix: "7", frets: [1, 3, 0], fingers: ["1", "3", ""] },
  { key: "A", suffix: "7", frets: [0, 2, 0], fingers: ["", "2", ""] },
  { key: "A", suffix: "m7", frets: [0, 1, 0], fingers: ["", "1", ""] },
  { key: "D", suffix: "m7", frets: [2, 1, 1], fingers: ["2", "1", "1"] },
  { key: "E", suffix: "m7", frets: [0, 3, 0], fingers: ["", "3", ""] },
  { key: "F", suffix: "maj7", frets: [2, 1, 0], fingers: ["2", "1", ""] },
  { key: "G", suffix: "minor", frets: [3, 3, 3], fingers: ["1", "2", "3"] },
];

/** Every G-B-E window in this chord's stored positions, in absolute frets. */
function corpusWindows(entry) {
  const seen = new Set();
  const out = [];
  for (const pos of entry.positions) {
    const frets = [3, 4, 5].map((i) => absoluteFret(pos.frets[i], pos.baseFret));
    if (frets.some((f) => f < 0)) continue;
    if (spanOf(frets) > 2) continue;
    const k = keyOf(frets);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(frets);
  }
  return out;
}

/** Frets 0-12 on G, B and E whose pitch classes are exactly the target set. */
function constructedWindows(rootPc, reduction) {
  if (!reduction) return [];
  const target = [...reduction].map((i) => (rootPc + i) % 12).sort((a, b) => a - b).join(",");
  const out = [];
  for (let g = 0; g <= 12; g++) {
    for (let b = 0; b <= 12; b++) {
      for (let e = 0; e <= 12; e++) {
        const frets = [g, b, e];
        if (spanOf(frets) > 2) continue;
        const pcs = pitchClassesOf(frets);
        if (pcs.size !== 3) continue;
        if ([...pcs].sort((a, b2) => a - b2).join(",") !== target) continue;
        out.push(frets);
      }
    }
  }
  return out;
}

/**
 * Every shape this chord could wear, best first: tier order, then the
 * within-tier ranking. Each fret triple appears once, at its best tier.
 */
function candidatesFor(dbKey, suffix, entry) {
  const rootPc = DB_KEY_PC[dbKey];
  const roles = rolesForSuffix(suffix);
  if (!roles || roles.unvoiceable) return [];
  const label = DB_KEY_LABEL[dbKey];

  const tiers = new Map(); // fret key → { tier, cand, fingers }
  const offer = (tier, frets, fingers) => {
    const k = keyOf(frets);
    const prev = tiers.get(k);
    if (prev && prev.tier <= tier) return;
    tiers.set(k, { tier, frets, fingers: fingers ?? fingersFor(frets), cand: describe(frets, rootPc, roles) });
  };

  // Tier 1 — the hand-authored preset, when it keeps the root and is unambiguous.
  const legacy = LEGACY.find((p) => p.key === label && p.suffix === suffix);
  if (legacy) {
    const d = describe(legacy.frets, rootPc, roles);
    if (d.inChord && d.hasRoot && !d.ambiguous) offer(1, legacy.frets, legacy.fingers);
  }

  const windows = entry ? corpusWindows(entry) : [];
  for (const frets of windows) {
    const d = describe(frets, rootPc, roles);
    if (!d.inChord) continue;
    // Tiers 2-4 want three real notes; tier 7 will take a doubling.
    //
    // Tier 6 is "complete, accepting ambiguity" and tier 4 is "complete and
    // unambiguous", so completeness is a floor the whole ladder stands on;
    // tiers 2 and 3 add the root back and tier 2 adds the fret-5 reach.
    if (d.distinct === 3 && d.complete) {
      if (d.hasRoot && !d.ambiguous && d.highestFret <= 5) offer(2, frets);
      if (d.hasRoot && !d.ambiguous) offer(3, frets);
      if (!d.ambiguous) offer(4, frets);
      offer(6, frets);
    }
    offer(7, frets);
  }

  // Tier 5 — arithmetic construction.
  for (const frets of constructedWindows(rootPc, reductionIntervals(roles))) {
    offer(5, frets);
  }

  // Renderability sorts ahead of the tier, which makes it a hard filter rather
  // than a preference: the assignment below never looks past the renderable
  // candidates unless a chord has none at all.
  return [...tiers.values()].sort(
    (a, b) =>
      Number(renderable(b.frets)) - Number(renderable(a.frets)) ||
      a.tier - b.tier ||
      rankCompare(a.cand, b.cand),
  );
}

// ── Assignment ───────────────────────────────────────────────────────────────

/**
 * A shape belongs to one chord. Two entries printing the same diagram is the
 * fault this table exists to fix, so a shape another chord already holds is not
 * a candidate — unless the two chords are the same notes, which `toneSet` decides.
 *
 * Each chord takes the first tier that yields it an unclaimed shape, exactly as
 * the design says. Chords are served in the order the design commits to them:
 * the eleven qualities promised for all 12 roots first, then chords-db's own
 * suffix order. Serving `D9` before `D7` would let the rarer chord take the only
 * window `D7` could be built in, and leave the beginner chord with a rootless
 * approximation.
 */
function buildTable(db) {
  const rows = [];
  for (const dbKey of Object.keys(db.chords)) {
    for (const entry of db.chords[dbKey]) {
      const roles = rolesForSuffix(entry.suffix);
      if (!roles) throw new Error(`no chord tones defined for suffix "${entry.suffix}"`);
      const candidates = candidatesFor(dbKey, entry.suffix, entry);
      rows.push({
        dbKey,
        key: DB_KEY_LABEL[dbKey],
        rootPc: DB_KEY_PC[dbKey],
        suffix: entry.suffix,
        suffixIndex: db.suffixes.indexOf(entry.suffix),
        priority: QUALITY_PRIORITY.indexOf(entry.suffix) >= 0
          ? QUALITY_PRIORITY.indexOf(entry.suffix)
          : 100 + db.suffixes.indexOf(entry.suffix),
        toneSet: toneSetKey(DB_KEY_PC[dbKey], roles),
        candidates,
        // The same list ranked on musical grounds alone, so the build log can
        // report what the renderability filter cost.
        candidatesUnfiltered: [...candidates].sort(
          (a, b) => a.tier - b.tier || rankCompare(a.cand, b.cand),
        ),
      });
    }
  }

  const claimed = new Map(); // fret key → tone set of whoever holds it
  const pending = [...rows].sort(
    (a, b) => a.priority - b.priority || a.rootPc - b.rootPc || a.suffixIndex - b.suffixIndex,
  );

  for (const row of pending) {
    for (const c of row.candidates) {
      if (!renderable(c.frets)) break; // renderable candidates sort first
      const k = keyOf(c.frets);
      const held = claimed.get(k);
      if (held !== undefined && held !== row.toneSet) continue;
      claimed.set(k, row.toneSet);
      row.chosen = c;
      break;
    }
  }

  // Last resort. There are more chords than there are three-note shapes inside a
  // two-fret reach, so the tail of the corpus — altered ninths, minor-major
  // elevenths — runs out of unclaimed windows long before it runs out of chords.
  // Per the product decision, a chord with a shape it can honestly wear gets it
  // even though another chord is already wearing it; `approximate` says so.
  for (const row of pending) {
    if (row.chosen) continue;
    const best = row.candidates.find((c) => renderable(c.frets));
    // A chord with nothing drawable gets nothing. Handing back a shape that the
    // renderer cannot place is worse than the honest gap: `lookupGuitarChord`
    // exposes only positions and shapes, so a caller has no way to see that the
    // diagram it is about to draw is broken.
    if (!best) continue;
    row.chosen = best;
    row.reused = true;
  }

  // chords-db root order, then chords-db suffix order — a stable, reviewable diff.
  const keyOrder = Object.keys(db.chords);
  rows.sort(
    (a, b) =>
      keyOrder.indexOf(a.dbKey) - keyOrder.indexOf(b.dbKey) ||
      a.suffixIndex - b.suffixIndex,
  );
  return rows;
}

// ── Emit ─────────────────────────────────────────────────────────────────────

const SOURCE_BY_TIER = {
  1: "legacy", 2: "corpus", 3: "corpus", 4: "corpus",
  5: "constructed", 6: "corpus", 7: "corpus",
};

function rowLiteral(row) {
  const c = row.chosen;
  const parts = [
    `key: ${JSON.stringify(row.key)}`,
    `suffix: ${JSON.stringify(row.suffix)}`,
    `frets: [${c.frets.join(", ")}]`,
    `fingers: [${c.fingers.map((f) => JSON.stringify(f)).join(", ")}]`,
    `source: ${JSON.stringify(SOURCE_BY_TIER[c.tier])}`,
    `tier: ${c.tier}`,
  ];
  // Tiers 6 and 7 accept ambiguity, any tier can land on a rootless window or on
  // a shape that spells someone else's chord, and a re-used shape is already
  // another chord's. None is a faithful spelling, and the flag says so.
  if (c.tier >= 6 || !c.cand.hasRoot || c.cand.misleading || row.reused) {
    parts.push("approximate: true");
  }
  return `  { ${parts.join(", ")} },`;
}

export function renderTop3Source() {
  const srcPath = require.resolve("@tombatossals/chords-db/lib/guitar.json");
  const db = JSON.parse(readFileSync(srcPath, "utf8"));
  const rows = buildTable(db);

  const resolved = rows.filter((r) => r.chosen);
  const unresolved = rows.filter((r) => !r.chosen);

  const lines = [];
  lines.push("// GENERATED FILE — DO NOT EDIT BY HAND.");
  lines.push("//");
  lines.push("// Produced by scripts/build-top3.mjs from @tombatossals/chords-db (MIT).");
  lines.push("// Re-run `node scripts/build-top3.mjs` to regenerate; test/top3Generated.test.ts");
  lines.push("// asserts this file is byte-identical to what the generator emits, so a hand");
  lines.push("// edit here will fail the suite rather than survive.");
  lines.push("//");
  lines.push("// Design: docs/superpowers/specs/2026-09-07-guitar-top3-generated-voicings-design.md");
  lines.push("//");
  lines.push("// Frets are ABSOLUTE (0 = open, measured from the nut) and listed low → high as");
  lines.push("// [G, B, E] — chords-db string order. svguitar numbers those strings 3, 2, 1;");
  lines.push("// staticPresets.ts does that relabelling, and it is the only place it happens.");
  lines.push("");
  lines.push("/** Where a shape came from: see the source-precedence tiers in the design. */");
  lines.push('export type Top3Source = "legacy" | "corpus" | "constructed";');
  lines.push("");
  lines.push("export interface Top3GeneratedEntry {");
  lines.push("  /** Root, spelled as chords-db spells it: C, C#, D, Eb, E, F, F#, G, Ab, A, Bb, B. */");
  lines.push("  key: string;");
  lines.push("  /** chords-db suffix — \"major\", \"minor\", \"7\", \"m7\", \"sus4\", … */");
  lines.push("  suffix: string;");
  lines.push("  /** Absolute frets on G, B, E (low → high). 0 = open. */");
  lines.push("  frets: [number, number, number];");
  lines.push("  /** Finger label per string; \"\" for an open string. */");
  lines.push("  fingers: [string, string, string];");
  lines.push("  source: Top3Source;");
  lines.push("  /** Source-precedence tier that produced it, 1-7. */");
  lines.push("  tier: number;");
  lines.push("  /** True when the shape is ambiguous or drops the root: playable, not a faithful spelling. */");
  lines.push("  approximate?: boolean;");
  lines.push("}");
  lines.push("");
  lines.push(`/** ${resolved.length} of ${rows.length} (root, suffix) pairs; the rest have no honest three-string window. */`);
  lines.push("export const TOP3_GENERATED: Top3GeneratedEntry[] = [");
  for (const row of resolved) lines.push(rowLiteral(row));
  lines.push("];");
  lines.push("");
  lines.push("/**");
  lines.push(" * Chords with no three-string voicing, as `key + suffix`.");
  lines.push(" *");
  lines.push(" * Listed rather than silently missing: a gap here is a fact about the chord, not");
  lines.push(" * an oversight in the table.");
  lines.push(" */");
  lines.push("export const TOP3_UNRESOLVED: string[] = [");
  for (const row of unresolved) lines.push(`  ${JSON.stringify(row.key + row.suffix)},`);
  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

/** Tier histogram and coverage, for the build log and for eyeballing a change. */
export function summarise() {
  const srcPath = require.resolve("@tombatossals/chords-db/lib/guitar.json");
  const db = JSON.parse(readFileSync(srcPath, "utf8"));
  const rows = buildTable(db);
  const tiers = {};
  for (const r of rows) {
    const t = r.chosen ? r.chosen.tier : 8;
    tiers[t] = (tiers[t] ?? 0) + 1;
  }
  return {
    total: rows.length,
    resolved: rows.filter((r) => r.chosen).length,
    tiers,
    unresolved: rows.filter((r) => !r.chosen).map((r) => r.key + r.suffix),
    /** Chords whose best-spelled shape was dropped because nobody could read it. */
    lostFirstChoice: rows
      .filter((r) => r.candidates.length && !renderable(r.candidatesUnfiltered[0].frets))
      .map((r) => r.key + r.suffix),
    /** Chords with no readable shape at all. */
    noRenderable: rows
      .filter((r) => r.candidates.length && !r.candidates.some((c) => renderable(c.frets)))
      .map((r) => r.key + r.suffix),
    rows,
  };
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  const out = join(here, "..", "src", "top3Generated.ts");
  writeFileSync(out, renderTop3Source());
  const s = summarise();
  console.log(
    `guitar-top3: ${s.resolved}/${s.total} shapes — tiers ` +
      Object.entries(s.tiers).map(([t, n]) => `${t}:${n}`).join(" "),
  );
  console.log(
    `  renderability: ${s.lostFirstChoice.length} chords gave up their best-spelled shape, ` +
      `${s.noRenderable.length} had no readable shape at all`,
  );
  if (s.unresolved.length) console.log(`  no shape: ${s.unresolved.join(", ")}`);
}
