/**
 * "Starting on X" — the rule that decides which chord tone sits at the bottom.
 *
 * This lives in the theory layer rather than in a renderer because more than
 * one view of a chord has to agree about it. `PianoChord` rotates the voicing
 * it draws; the board's player rotates the voicing it *sounds*. A second copy
 * of the rule in the second caller is the one kind of drift nothing on screen
 * would reveal — the card would draw a first inversion and play root position,
 * silently, so both call this.
 *
 * Degree resolution ("starting on the 3rd") lives here for the same reason: it
 * is the first half of the same clause, and `bassDegree` ("over the 3rd") uses
 * the identical lookup.
 */

import { Note } from "tonal";

import { FLAT_TO_SHARP } from "../engine/note-spelling.js";

/**
 * Map semitones (mod 12) from root to a scale degree number.
 * Handles both major and minor variants of each degree.
 * Note: does not distinguish quality (e.g. b9 vs M9 both map to degree 2).
 * This means degree-based lookups may match the wrong quality in altered chords.
 */
function semitonesToDegree(semitones: number): number {
  const s = ((semitones % 12) + 12) % 12;
  if (s === 0) return 1;
  if (s <= 2) return 2;   // m2=1, M2=2 (also 9th)
  if (s <= 4) return 3;   // m3=3, M3=4
  if (s === 5) return 4;  // P4=5 (also 11th)
  if (s <= 7) return 5;   // d5=6, P5=7
  if (s <= 9) return 6;   // m6=8, M6=9 (also 13th)
  return 7;               // m7=10, M7=11
}

/** Ordinal names for the degrees a "starting on"/"over" clause can name. */
export const DEGREE_NAMES: Record<number, string> = {
  1: "root", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th", 7: "7th",
  9: "9th", 11: "11th", 13: "13th",
};

/**
 * Find the chord tone matching a musical degree, regardless of quality.
 * e.g. degree 3 finds Eb in Cm7 and E in Cmaj7.
 */
export function degreeToNote(root: string, degree: number, notes: string[]): string | undefined {
  const rootMidi = Note.midi(`${root}4`);
  if (rootMidi == null) return undefined;

  // Normalize compound degrees: 9→2, 11→4, 13→6
  const simpleDegree = degree > 7 ? degree - 7 : degree;

  for (const note of notes) {
    const noteMidi = Note.midi(`${note}4`);
    if (noteMidi == null) continue;
    const semitones = ((noteMidi - rootMidi) % 12 + 12) % 12;
    if (semitonesToDegree(semitones) === simpleDegree) return note;
  }

  return undefined;
}

/** Format the available degrees for error messages */
export function describeAvailableDegrees(root: string, notes: string[]): string {
  const rootMidi = Note.midi(`${root}4`);
  if (rootMidi == null) return notes.join(", ");

  const degrees: string[] = [];
  for (const note of notes) {
    const noteMidi = Note.midi(`${note}4`);
    if (noteMidi == null) continue;
    const semitones = ((noteMidi - rootMidi) % 12 + 12) % 12;
    const deg = semitonesToDegree(semitones);
    const name = DEGREE_NAMES[deg] ?? `${deg}th`;
    degrees.push(`${name} (${note})`);
  }
  return degrees.join(", ");
}

export interface StartingNoteRotation {
  /**
   * Where the named note sits in the original list, or `-1` when the chord
   * does not contain it. Callers distinguish the two "no rotation" cases from
   * this: `0` is already the bottom note, `-1` is a note that isn't there.
   */
  index: number;
  /** `notes` rotated so the named note is lowest — the input list when `index <= 0`. */
  notes: string[];
}

/**
 * Rotate a voicing so `startingNote` is its lowest note.
 *
 * Both sides are normalised before matching. `notes` keeps the chord's own
 * spelling — Bbm is ["Bb", "Db", "F"] — so normalising only the input turned
 * "Bbm starting on Db" into a search for "C#" and reported Db missing from a
 * chord whose own error message listed it as the 3rd; matching literally is
 * the mirror bug, and drops the rotation for "Bbm starting on C#".
 */
export function rotateToStartingNote(notes: string[], startingNote: string): StartingNoteRotation {
  const norm = FLAT_TO_SHARP[startingNote] ?? startingNote;
  const index = notes.findIndex((n) => (FLAT_TO_SHARP[n] ?? n) === norm);
  if (index <= 0) return { index, notes };
  return { index, notes: [...notes.slice(index), ...notes.slice(0, index)] };
}
