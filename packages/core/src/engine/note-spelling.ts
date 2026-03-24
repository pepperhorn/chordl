/**
 * Consolidated enharmonic spelling logic.
 *
 * Single source of truth for flat↔sharp conversion, key-context-aware
 * note spelling, and pitch class normalization.
 */

/** Convert flat note names to their sharp equivalents. */
export const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
};

/** Convert sharp note names to their flat equivalents. */
export const SHARP_TO_FLAT: Record<string, string> = {
  "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb",
};

/**
 * Keys whose notes should be spelled with flats.
 * Includes both major flat keys and enharmonic equivalents.
 */
export const FLAT_KEYS = new Set([
  "F", "Bb", "Eb", "Ab", "Db", "Gb", "Cb",
]);

/**
 * Normalize a pitch class to sharps for internal matching.
 * e.g. "Bb" → "A#", "Db" → "C#", "C" → "C"
 */
export function normalizeToSharps(note: string): string {
  return FLAT_TO_SHARP[note] ?? note;
}

/**
 * Spell a pitch class to match the key context of the given root.
 * Flat-key roots get flat spelling; sharp-key roots keep sharp spelling.
 *
 * e.g. spellForKey("A#", "Bb") → "Bb"
 *      spellForKey("Bb", "E")  → "A#"
 */
export function spellForKey(pc: string, key: string): string {
  if (FLAT_KEYS.has(key)) {
    return SHARP_TO_FLAT[pc] ?? pc;
  }
  return FLAT_TO_SHARP[pc] ?? pc;
}

/**
 * Choose enharmonic spelling with explicit flat preference.
 * Used for roman numeral accidentals (bVII → flat spelling regardless of key).
 */
export function spellWithPreference(
  note: string,
  key: string,
  preferFlat: boolean = false,
): string {
  if (preferFlat) {
    return SHARP_TO_FLAT[note] ?? note;
  }
  return spellForKey(note, key);
}
