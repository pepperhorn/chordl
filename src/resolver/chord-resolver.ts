import { Chord, Note } from "tonal";
import { FLAT_TO_SHARP } from "../engine/svg-constants";

function normalizeToSharp(note: string): string {
  const simplified = Note.simplify(note);
  return FLAT_TO_SHARP[simplified] ?? simplified;
}

export interface ResolvedChord {
  notes: string[];
  root: string;
  type: string;
}

export function resolveChord(
  chordName: string,
  inversion?: number
): ResolvedChord {
  const chord = Chord.get(chordName);

  if (chord.empty) {
    throw new Error(`Unknown chord: "${chordName}"`);
  }

  let notes = chord.notes.map(normalizeToSharp);
  const root = normalizeToSharp(chord.tonic ?? notes[0]);
  const type = chord.type;

  // Apply inversion: rotate notes array
  if (inversion && inversion > 0) {
    const rotation = inversion % notes.length;
    notes = [...notes.slice(rotation), ...notes.slice(0, rotation)];
  }

  return { notes, root, type };
}
