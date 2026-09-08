import type { VoicingVariant } from "./types.js";

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
 *
 * Being in this list is necessary but not sufficient for a library entry to
 * rank beginner: `isCoreQuality` only asks whether the pitch-class *set*
 * matches, not whether the voicing sounds every tone in it. maj7, dom7 and
 * sus4 are all here, yet not one library entry for any of them ranks
 * beginner — every maj7/dom7/sus4 entry in `library.ts` is a shell, rootless,
 * drop or spread voicing, and each of those deliberately omits or displaces
 * some core tone (that is what makes it a shell rather than a close triad),
 * so `isCoreQuality` correctly says no. A beginner still gets an easy
 * root-position maj7/dom7/sus4 in the app — `generateVariants`' inversion
 * path builds one from the close pitch classes directly and never touches
 * this library, so it ranks beginner on its own stacked semitones instead.
 * Measured: 2 of the library's 73 entries rank beginner (`close-sus2` and
 * `power-5-shell`); see `experience-corpus.test.ts`.
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

/** Pitch class of a natural 9th, the one tension the emerging rung admits. */
const NATURAL_NINTH = 2;

/**
 * The chromatic variants that occupy the same tertian slot. A chord has at
 * most one third, one fifth and one seventh — it cannot be minor and major at
 * the same time — so if two members of one family both sound, one of them is
 * necessarily a genuine alteration on top of the chord's own tone for that
 * slot, not a second copy of it: `[0,4,10,15]`, a real #9 over a dom7, has
 * both a b3 (pc 3, the altered ninth) and a natural 3 (pc 4, the chord's own
 * third) — two members of the third family — which is what makes it
 * established, full stop, regardless of which one a listener would call
 * "the" third.
 *
 * The root (pc 0) needs no family: nothing else stands in for it.
 */
const DEGREE_FAMILIES: number[][] = [
  [3, 4],     // third: minor or major
  [6, 7, 8],  // fifth: diminished, perfect, augmented
  [10, 11],   // seventh: minor or major
];

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

  // Emerging admits the chord's own defining tones at any octave — a doubling
  // is free — plus a natural 9th, and nothing past that. A pitch class that
  // sits in none of the three tertian families and isn't the root or the
  // natural 9th (pc 1, 5 or 9) is never a chord's own tone under any
  // spelling, so its presence alone is a tension that pushes the voicing to
  // established. And within a single family, having two members present is
  // itself the established condition — see the comment on `DEGREE_FAMILIES` —
  // independent of which member "the chord's tone" actually is, so there is
  // nothing left to decide once both are known to sound.
  const own = pcSet(semitones);
  const isBareTension = (pc: number): boolean =>
    pc !== 0 && pc !== NATURAL_NINTH && !DEGREE_FAMILIES.some((family) => family.includes(pc));
  const hasBareTension = [...own].some(isBareTension);
  const hasFamilyClash = DEGREE_FAMILIES.some(
    (family) => family.filter((pc) => own.has(pc)).length >= 2,
  );
  return hasBareTension || hasFamilyClash ? "established" : "emerging";
}

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
