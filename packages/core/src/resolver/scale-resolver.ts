/**
 * Scale resolver — resolves scale names to notes via Tonal.
 * Handles melodic minor direction, multi-octave expansion, and
 * generates Tonal interval arrays for degree label computation.
 */
import { Scale } from "tonal";

export interface ResolvedScale {
  /** Pitch classes for the full multi-octave display (includes final tonic). */
  notes: string[];
  root: string;
  type: string;
  /** Single-octave Tonal intervals (e.g. ["1P","2M","3M","4P","5P","6M","7M"]). */
  intervals: string[];
}

/** Normalize common scale name variants for Tonal compatibility. */
const SCALE_NAME_MAP: Record<string, string> = {
  "natural minor": "minor",
  "minor harmonic": "harmonic minor",
  "minor melodic": "melodic minor",
  "major pentatonic": "major pentatonic",
  "minor pentatonic": "minor pentatonic",
  "whole tone": "whole tone",
  "bebop": "bebop major",
};

export function resolveScale(
  root: string,
  scaleType: string,
  direction?: "ascending" | "descending",
  octaves: number = 1,
): ResolvedScale {
  // Melodic minor descending = natural minor
  let effectiveType = scaleType;
  if (scaleType === "melodic minor" && direction === "descending") {
    effectiveType = "minor";
  }

  // Apply name normalization
  const tonalName = SCALE_NAME_MAP[effectiveType] ?? effectiveType;

  const scale = Scale.get(`${root} ${tonalName}`);
  if (scale.empty) {
    throw new Error(`Unknown scale: "${root} ${scaleType}"`);
  }

  const oneOctaveNotes = scale.notes;
  const intervals = scale.intervals;

  // Expand across octaves: repeat pitch classes + add final tonic
  const notes: string[] = [];
  for (let oct = 0; oct < octaves; oct++) {
    notes.push(...oneOctaveNotes);
  }
  // Add the final tonic to complete the last octave
  notes.push(oneOctaveNotes[0]);

  return {
    notes,
    root,
    type: scaleType,
    intervals,
  };
}
