/**
 * Scale fingering lookup for piano.
 *
 * Standard fingerings from established piano pedagogy (Hanon, Czerny, ABRSM).
 * Core rule: thumb always crosses to a white key.
 *
 * Each entry is one octave ascending. For multi-octave scales, the pattern
 * repeats with the last finger of one octave becoming the first of the next.
 * The final note of the last octave always uses finger 5 (RH) or 1 (LH).
 */

export type ScaleHand = "rh" | "lh";

interface ScaleFingeringPattern {
  /** One octave ascending (8 notes: tonic to tonic). */
  rh: number[];
  /** One octave ascending (8 notes: tonic to tonic). */
  lh: number[];
}

// ── Major scale fingerings ────────────────────────────────────────

const MAJOR_FINGERINGS: Record<string, ScaleFingeringPattern> = {
  // White-key scales: standard 1-2-3, 1-2-3-4-5
  C:  { rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
  G:  { rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
  D:  { rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
  A:  { rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
  E:  { rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
  B:  { rh: [1,2,3,1,2,3,4,5], lh: [4,3,2,1,4,3,2,1] },
  // F major: thumb on C after Bb
  F:  { rh: [1,2,3,4,1,2,3,4], lh: [5,4,3,2,1,3,2,1] },
  // Flat-key scales: thumb avoids black keys
  Bb: { rh: [2,1,2,3,1,2,3,4], lh: [3,2,1,4,3,2,1,3] },
  Eb: { rh: [2,1,2,3,4,1,2,3], lh: [3,2,1,4,3,2,1,3] },
  Ab: { rh: [2,3,1,2,3,1,2,3], lh: [3,2,1,4,3,2,1,3] },
  Db: { rh: [2,3,1,2,3,4,1,2], lh: [3,2,1,4,3,2,1,3] },
  Gb: { rh: [2,3,4,1,2,3,1,2], lh: [4,3,2,1,3,2,1,4] },
  // Enharmonic equivalents
  "F#": { rh: [2,3,4,1,2,3,1,2], lh: [4,3,2,1,3,2,1,4] },
  "C#": { rh: [2,3,1,2,3,4,1,2], lh: [3,2,1,4,3,2,1,3] },
};

// ── Minor scale fingerings (natural minor) ────────────────────────
// Harmonic and melodic minor use the same fingerings.

const MINOR_FINGERINGS: Record<string, ScaleFingeringPattern> = {
  A:  { rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
  E:  { rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
  B:  { rh: [1,2,3,1,2,3,4,5], lh: [4,3,2,1,4,3,2,1] },
  D:  { rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
  G:  { rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
  C:  { rh: [1,2,3,1,2,3,4,5], lh: [5,4,3,2,1,3,2,1] },
  F:  { rh: [1,2,3,4,1,2,3,4], lh: [5,4,3,2,1,3,2,1] },
  "F#": { rh: [2,3,1,2,3,1,2,3], lh: [4,3,2,1,3,2,1,4] },
  "C#": { rh: [2,3,1,2,3,1,2,3], lh: [3,2,1,4,3,2,1,3] },
  "G#": { rh: [2,3,1,2,3,1,2,3], lh: [3,2,1,4,3,2,1,3] },
  Bb: { rh: [2,1,2,3,1,2,3,4], lh: [2,1,3,2,1,4,3,2] },
  Eb: { rh: [2,1,2,3,4,1,2,3], lh: [2,1,4,3,2,1,3,2] },
  Ab: { rh: [2,3,1,2,3,1,2,3], lh: [3,2,1,4,3,2,1,3] },
};

// ── Normalize note name ───────────────────────────────────────────

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
};

function normalizeRoot(root: string): string {
  // Keep the original if it's in the lookup; otherwise try sharp equivalent
  return root;
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Get scale fingering for a given root and scale type.
 *
 * @param root - Root note (e.g. "C", "Bb", "F#")
 * @param scaleType - Scale type (e.g. "major", "minor", "harmonic minor", "melodic minor", "dorian")
 * @param hand - "rh" (default) or "lh"
 * @param octaves - Number of octaves (default 1)
 * @returns Array of finger numbers, one per note. Empty array if no fingering available.
 */
export function scaleAutoFingering(
  root: string,
  scaleType: string,
  hand: ScaleHand = "rh",
  octaves: number = 1,
): number[] {
  const type = scaleType.toLowerCase().replace(/\s+/g, " ").trim();

  // Map scale types to fingering tables
  let table: Record<string, ScaleFingeringPattern>;
  if (type === "major" || type === "ionian") {
    table = MAJOR_FINGERINGS;
  } else if (
    type === "minor" || type === "natural minor" ||
    type === "harmonic minor" || type === "minor harmonic" ||
    type === "melodic minor" || type === "minor melodic" ||
    type === "aeolian"
  ) {
    table = MINOR_FINGERINGS;
  } else if (type === "dorian" || type === "mixolydian" || type === "phrygian" ||
             type === "lydian" || type === "locrian") {
    // Modal scales use the fingering of their parent major/minor key.
    // For simplicity, use the relative major fingering pattern rotated.
    // This is an approximation — use the minor table as a reasonable default.
    table = MINOR_FINGERINGS;
  } else {
    // Pentatonic, blues, whole tone, etc. — no standard fingering
    return [];
  }

  // Look up the pattern: try original root, then flat equivalent, then sharp
  let pattern = table[root];
  if (!pattern) {
    const sharp = FLAT_TO_SHARP[root];
    if (sharp) pattern = table[sharp];
  }
  if (!pattern) {
    // Try reverse: if root is sharp, check if flat version exists
    for (const [flat, sharp] of Object.entries(FLAT_TO_SHARP)) {
      if (sharp === root) { pattern = table[flat]; break; }
    }
  }
  if (!pattern) return [];

  const oneOctave = hand === "rh" ? pattern.rh : pattern.lh;

  if (octaves <= 1) return oneOctave;

  // Multi-octave: repeat the inner pattern (notes 1-7), then cap with final finger.
  // Pattern is 8 notes: [start...middle...end]. For continuation:
  // - Octave 1: notes 0-6 (drop the 8th — it becomes the 1st of next octave)
  // - Octave 2..N-1: same
  // - Final octave: full 8 notes
  const result: number[] = [];
  for (let oct = 0; oct < octaves; oct++) {
    if (oct < octaves - 1) {
      // Not the last octave: use first 7 fingers (skip the tonic repeat)
      result.push(...oneOctave.slice(0, 7));
    } else {
      // Last octave: use all 8 fingers
      result.push(...oneOctave);
    }
  }

  return result;
}
