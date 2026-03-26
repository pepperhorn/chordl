/**
 * Local enharmonic spelling helpers for the voicings package.
 *
 * These mirror the canonical implementations in @better-chord/core's
 * note-spelling.ts but are duplicated here to avoid a circular dependency
 * (core depends on voicings for progression-resolver, voicings cannot
 * depend on core).
 */

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
};

const SHARP_TO_FLAT: Record<string, string> = {
  "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb",
};

const FLAT_KEYS = new Set(["F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb"]);

/** Normalize a pitch class to sharps. */
export function normalizeToSharps(note: string): string {
  return FLAT_TO_SHARP[note] ?? note;
}

/** Spell a pitch class to match the key context of the given root. */
export function spellForKey(pc: string, key: string): string {
  if (FLAT_KEYS.has(key)) {
    return SHARP_TO_FLAT[pc] ?? pc;
  }
  return FLAT_TO_SHARP[pc] ?? pc;
}
