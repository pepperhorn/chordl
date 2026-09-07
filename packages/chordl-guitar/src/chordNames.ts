/**
 * Chord-label spelling, resolved once for every lookup path.
 *
 * A user types `Db`, `C#`, `Cø`, `CM7`, `Csus`; chords-db stores `Csharp`,
 * `m7b5`, `maj7`, `sus4`. Both the six-string library and the top-3 table need
 * the same translation, and two copies of it drift — the top-3 path used to
 * carry a three-line version of `toDbSuffix` that knew only `""`, `m` and `min`,
 * which left the generated table addressable for a fraction of what it holds.
 *
 * Roots are resolved by pitch class rather than by spelling wherever the target
 * is keyed that way; `rootPitchClass` in pitch.ts is the one parser for that.
 * This module carries what pitch classes cannot express: where the suffix ends
 * and, for chords-db, which of its inconsistent root spellings to try.
 */

/**
 * chordl suffix → chords-db suffix. Most match verbatim; only the triads and a
 * handful of aliases need translating.
 */
export function toDbSuffix(suffix: string): string {
  const s = suffix.trim();
  if (s === "" || s === "maj" || s === "M") return "major";
  if (s === "m" || s === "min" || s === "-") return "minor";
  if (s === "min7") return "m7";
  if (s === "M7") return "maj7";
  if (s === "°") return "dim";
  if (s === "°7") return "dim7";
  if (s === "ø" || s === "ø7") return "m7b5";
  // chords-db spells the 6/9 voicings without the slash.
  if (s === "6/9") return "69";
  if (s === "m6/9") return "m69";
  // Bare "sus" (and "7sus") carry no extension number; sus4 is the convention.
  if (s === "sus") return "sus4";
  if (s === "7sus") return "7sus4";
  return s; // m7, maj7, 7, dim7, sus4, 6, 9, 11, 13, m7b5, ... match verbatim
}

/** Split a label into its root spelling and everything after it. */
export function splitLabel(label: string): { root: string; suffix: string } | null {
  const m = label.trim().match(/^([A-Ga-g][#b]?)(.*)$/);
  if (!m) return null;
  const root = m[1].charAt(0).toUpperCase() + m[1].slice(1);
  return { root, suffix: m[2] };
}
