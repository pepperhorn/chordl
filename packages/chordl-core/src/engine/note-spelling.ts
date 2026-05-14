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

// ── Semitone mapping (canonical, replaces duplicates across codebase) ──

/**
 * Pitch class to semitone value (0-11). Handles both sharps and flats.
 * C=0, C#/Db=1, D=2, D#/Eb=3, E=4, F=5, F#/Gb=6, G=7, G#/Ab=8, A=9, A#/Bb=10, B=11
 */
export const PC_SEMITONES: Record<string, number> = {
  C: 0, "C#": 1, Db: 1,
  D: 2, "D#": 3, Eb: 3,
  E: 4, Fb: 4, "E#": 5,
  F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10,
  B: 11, Cb: 11, "B#": 0,
};

/** A3 MIDI value — default floor for scale starting notes. */
export const MIDI_A3 = 57;

/**
 * Assign ascending octaves to an array of pitch classes.
 * Each note that would descend (lower semitone than previous) bumps the octave.
 * Optionally compacts the result to stay within a maximum span.
 *
 * @param notes - Sharp-normalized pitch classes in voicing/scale order
 * @param baseOctave - Starting octave for the first note
 * @param maxSpan - Maximum semitone span before folding (0 = no limit)
 * @returns Array of { note, octave } pairs
 */
export function assignAscendingOctaves(
  notes: string[],
  baseOctave: number,
  maxSpan: number = 0,
): Array<{ note: string; octave: number }> {
  if (notes.length === 0) return [];

  let octave = baseOctave;
  let prevSemi = PC_SEMITONES[notes[0]] ?? 0;

  const result = notes.map((n, i) => {
    const semi = PC_SEMITONES[n] ?? 0;
    if (i > 0 && semi <= prevSemi) {
      octave++;
    }
    prevSemi = semi;
    return { note: n, octave };
  });

  // Optional compaction: fold notes down if span exceeds limit
  if (maxSpan > 0 && result.length > 1) {
    const baseSemi = (PC_SEMITONES[result[0].note] ?? 0) + result[0].octave * 12;
    for (let i = 1; i < result.length; i++) {
      const noteSemi = (PC_SEMITONES[result[i].note] ?? 0) + result[i].octave * 12;
      if (noteSemi - baseSemi > maxSpan && result[i].octave > result[0].octave) {
        result[i].octave--;
      }
    }
  }

  return result;
}
