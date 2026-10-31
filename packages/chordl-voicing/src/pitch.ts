import { Interval, Note } from "tonal";
import { intervalToDegreeLabel } from "@pepperhorn/chordl-core";
import { chordIntervals, parseChordId } from "./chordId.js";

export interface ParsedPitch {
  midi: number;
  pc: number;
  letter: string;
  alter: number;
  octave: number;
}

export interface LabelledNote {
  pitch: string;
  degree: string;
  inChord: boolean;
  misspelled: boolean;
}

// ASCII only: letter, optional b/bb/#/##, octave. Unicode accidentals are rejected.
const PITCH_RE = /^[A-G](?:bb?|##?)?-?\d+$/;
const INTERVAL_RE = /^(\d+)([A-Za-z]+)$/;
const MAJOR_QUALITY_DEGREES = new Set([2, 3, 6, 7]);

export function parsePitch(p: string): ParsedPitch | null {
  if (typeof p !== "string" || !PITCH_RE.test(p)) return null;
  const n = Note.get(p);
  if (n.empty || n.midi === null || n.oct === undefined) return null;
  return { midi: n.midi, pc: n.chroma, letter: n.letter, alter: n.alt, octave: n.oct };
}

// Wraps core's label: a diminished major-quality degree is double-flat (7d -> bbVII).
// Core returns bVII for 7d; see ruling R1.
export function degreeLabel(interval: string): string {
  const m = INTERVAL_RE.exec(interval);
  if (m) {
    // An altered root reads as a diminished octave (A to Ab is 8d); core labels it "b8".
    if (m[1] === "8" && /^d+$/.test(m[2])) return `${"b".repeat(m[2].length)}I`;
    const simple = ((parseInt(m[1], 10) - 1) % 7) + 1;
    if (m[2] === "d" && MAJOR_QUALITY_DEGREES.has(simple)) {
      return `bb${intervalToDegreeLabel(`${m[1]}M`)}`;
    }
  }
  return intervalToDegreeLabel(interval);
}

// Jazz extension naming for a non-chord tone: 2/4/6 are written as 9/11/13.
function extensionInterval(simple: string): string {
  const m = INTERVAL_RE.exec(simple);
  if (!m) return simple;
  const deg = parseInt(m[1], 10);
  return [2, 4, 6].includes(deg) ? `${deg + 7}${m[2]}` : simple;
}

export function labelNotes(chordId: string, pitches: string[]): LabelledNote[] {
  const parsed = parseChordId(chordId);
  if (!parsed) throw new Error(`Invalid chord id: ${chordId}`);
  const chord = chordIntervals(chordId).map((iv) => ({
    iv,
    simple: Interval.simplify(iv),
    chroma: (Note.chroma(parsed.root) + Interval.semitones(iv)) % 12,
  }));
  return pitches.map((pitch) => {
    if (!parsePitch(pitch)) throw new Error(`Invalid pitch "${pitch}": use ASCII scientific pitch such as Eb4`);
    const name = Note.pitchClass(pitch);
    const dist = Interval.distance(parsed.root, name);
    const exact = chord.find((c) => c.simple === dist);
    if (exact) return { pitch, degree: degreeLabel(exact.iv), inChord: true, misspelled: false };
    const chroma = Note.chroma(name);
    const enh = chord.find((c) => c.chroma === chroma);
    if (enh) return { pitch, degree: degreeLabel(enh.iv), inChord: true, misspelled: true };
    return { pitch, degree: degreeLabel(extensionInterval(dist)), inChord: false, misspelled: false };
  });
}
