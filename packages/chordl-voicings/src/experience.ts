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

/** Pitch class of a natural 9th, the one tension the emerging rung admits. */
const NATURAL_NINTH = 2;

/**
 * The chromatic variants that occupy the same tertian slot. A chord has at
 * most one third, one fifth and one seventh — it cannot be minor and major at
 * the same time — so when two members of the same family both sound, only
 * one of them is *the* chord's tone for that slot and the other is a genuine
 * alteration, not a second copy of the same thing.
 *
 * The root (pc 0) needs no family: nothing else stands in for it.
 */
const DEGREE_FAMILIES: number[][] = [
  [3, 4],     // third: minor or major
  [6, 7, 8],  // fifth: diminished, perfect, augmented
  [10, 11],   // seventh: minor or major
];

/** The lowest raw offset at which `pc` sounds, among possibly-negative or
 * spread offsets. Used to decide which family member "got there first". */
const lowestOffsetOf = (semitones: number[], pc: number): number =>
  Math.min(...semitones.filter((s) => ((s % 12) + 12) % 12 === pc));

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
  // is free — plus a natural 9th. "Defining" is decided per tertian slot, not
  // per pitch class: when both a b3 and a natural 3 sound (as in a genuine
  // #9 over a dominant, where pc 3 is really the altered ninth, not a second
  // third), the slot goes to whichever one sounds lowest in the voicing, and
  // the other is a tension. Without this, `[0,4,10,15]` (a real #9, pc 3
  // arriving only after the major third pc 4 has already claimed the third
  // slot) is indistinguishable from `[0,7,14,15]` (spread-madd9, where pc 3
  // *is* the chord's own minor third, and 15 is just that same b3 an octave
  // up) — both reduce to the same raw "pc 3 present" fact, and only looking
  // at which slot got there first tells them apart.
  const own = pcSet(semitones);
  const defining = new Set<number>();
  if (own.has(0)) defining.add(0);
  for (const family of DEGREE_FAMILIES) {
    const present = family.filter((pc) => own.has(pc));
    if (present.length === 0) continue;
    const winner = present.reduce((best, pc) =>
      lowestOffsetOf(semitones, pc) < lowestOffsetOf(semitones, best) ? pc : best,
    );
    defining.add(winner);
  }

  const beyond = [...own].filter((pc) => pc !== NATURAL_NINTH && !defining.has(pc));
  return beyond.length === 0 ? "emerging" : "established";
}
