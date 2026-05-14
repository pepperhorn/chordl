/**
 * Generate a dottl play-grid-clip JSON and copy it to the system clipboard.
 * This allows pasting chords directly into dottl.app via Ctrl+V.
 */

import { Note } from "tonal";

const DOTTL_NOTE_NAMES = ["C", "C#/Db", "D", "D#/Eb", "E", "F", "F#/Gb", "G", "G#/Ab", "A", "Bb", "B"];

function midiToRow(midiNote: number): number {
  return midiNote % 12;
}

function midiToOctave(midiNote: number): number {
  return Math.floor(midiNote / 12) - 1;
}

function midiToDottlName(midiNote: number): string {
  return DOTTL_NOTE_NAMES[midiNote % 12];
}

export interface DottlClipNote {
  name: string;
  col: number;
  row: number;
  octave: number;
  isRoot: boolean;
  sustainCells: number;
}

/**
 * Build a dottl clipboard payload from note names with octaves (e.g. "C4", "E4", "G4").
 */
export function buildDottlClip(noteNames: string[], rootNote?: string): string {
  const midiNotes = noteNames
    .map((n) => Note.midi(n))
    .filter((m): m is number => m != null);

  if (midiNotes.length === 0) return "";

  const rootPc = rootNote ? Note.pitchClass(rootNote) : Note.pitchClass(noteNames[0]);
  const originRow = Math.min(...midiNotes.map(midiToRow));

  const notes: DottlClipNote[] = midiNotes.map((midi, i) => ({
    name: midiToDottlName(midi),
    col: 1,
    row: midiToRow(midi),
    octave: midiToOctave(midi),
    isRoot: Note.pitchClass(noteNames[i]) === rootPc,
    sustainCells: 0,
  }));

  const clip = {
    _type: "play-grid-clip",
    label: `${notes.length} notes (${notes.map((n) => n.name.split("/")[0]).join(", ")})`,
    timestamp: Date.now(),
    data: {
      notes,
      lines: [],
      originCol: 1,
      originRow,
    },
  };

  return JSON.stringify(clip);
}

/**
 * Copy a chord as a dottl clip to the system clipboard.
 * Returns true on success.
 */
export async function copyDottlClip(noteNames: string[], rootNote?: string): Promise<boolean> {
  const json = buildDottlClip(noteNames, rootNote);
  if (!json) return false;
  try {
    await navigator.clipboard.writeText(json);
    return true;
  } catch {
    return false;
  }
}
