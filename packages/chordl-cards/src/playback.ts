/**
 * What a face sounds like: the exact MIDI voicing of the keys or strings it
 * draws, in performance order, so one timeline can drive sound and paint.
 *
 * Index i of `notes` is index i of the request's `notes` (keyboard) or of the
 * shape's sounding strings, low to high (guitar) — the numbering chordl-react's
 * `activePlaybackIndices` and `activeStrings` expect.
 */

import { INSTRUMENTS } from "@pepperhorn/chordl-guitar";
import { computeKeyboard } from "@pepperhorn/chordl-core";
import type { FaceRequest, GuitarFaceRequest, KeyboardFaceRequest } from "./faces";

export interface FacePlayback {
  /** MIDI note numbers, in the order the face plays them. */
  notes: number[];
  instrument: "acoustic_grand_piano" | "electric_guitar_clean" | "ukulele" | "electric_bass_finger";
  /** keyboard-hands: which `notes` indices each hand plays. */
  hands?: { lh: number[]; rh: number[] };
  /** Fretted faces: the physical string (0 = lowest-tuned, as INSTRUMENTS
   * lists the tuning; a ukulele's reentrant G is 0) each note sounds on. */
  strings?: number[];
}

const PC: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};

/**
 * The octave the first (lowest) note sounds in. Octave 3 is chordl-react's own
 * default right-hand register — its keyboard plays C-E-G as 48, 52, 55 — so a
 * card and a chordl diagram of the same chord sound alike.
 */
const FIRST_NOTE_OCTAVE = 3;

export function playbackFor(req: FaceRequest): FacePlayback {
  return req.kind === "keyboard" ? keyboardPlayback(req) : guitarPlayback(req);
}

function keyboardPlayback(req: KeyboardFaceRequest): FacePlayback {
  // Each note's semitone within the window, from chordl's own key list, so the
  // intervals are exactly the keys drawn — then the whole voicing is placed
  // with its lowest note in FIRST_NOTE_OCTAVE.
  const keys = computeKeyboard(req.startFrom as never, req.size, req.format);
  const semis = req.notes.map((n) => {
    const [note, octave] = n.split(":");
    const key = keys.find((k) => k.note === note && k.octave === Number(octave));
    if (!key || PC[note] === undefined) throw new Error(`"${n}" is not a key in "${req.chordLabel}"'s window`);
    return key.octave * 12 + PC[note];
  });
  const first = (FIRST_NOTE_OCTAVE + 1) * 12 + (semis[0] % 12);
  const notes = semis.map((s) => first + s - semis[0]);
  return {
    notes,
    instrument: "acoustic_grand_piano",
    ...(req.hands ? { hands: { lh: [...req.hands.lh], rh: [...req.hands.rh] } } : {}),
  };
}

/** The patch each fretted instrument sounds on (chordl-react's audio layer). */
const FRETTED_PATCH: Record<GuitarFaceRequest["instrument"], FacePlayback["instrument"]> = {
  "guitar-top3": "electric_guitar_clean",
  guitar: "electric_guitar_clean",
  ukulele: "ukulele",
  bass4: "electric_bass_finger",
};

function guitarPlayback(req: GuitarFaceRequest): FacePlayback {
  const { strings, openMidi } = INSTRUMENTS[req.instrument];
  const shape = req.shape as {
    fingers: Array<[number, number | string, unknown?]>;
    barres?: Array<{ fromString: number; toString: number; fret: number }>;
    position?: number;
  };
  const windowStart = shape.position ?? 1;
  const absolute = (fret: number) => (fret <= 0 || windowStart <= 1 ? fret : windowStart + fret - 1);

  // Fret per physical string (0 = lowest); undefined = not played.
  const frets: Array<number | undefined> = new Array(strings).fill(undefined);
  for (const [stringNo, fret] of shape.fingers) {
    const i = strings - stringNo;
    if (typeof fret === "number") frets[i] = Math.max(frets[i] ?? -1, absolute(fret));
    else frets[i] = undefined; // "x": muted
  }
  for (const b of shape.barres ?? []) {
    const lo = Math.min(b.fromString, b.toString);
    const hi = Math.max(b.fromString, b.toString);
    for (let stringNo = lo; stringNo <= hi; stringNo++) {
      const i = strings - stringNo;
      const muted = shape.fingers.some(([s, f]) => s === stringNo && typeof f !== "number");
      if (!muted) frets[i] = Math.max(frets[i] ?? -1, absolute(b.fret));
    }
  }

  const sounding = frets.flatMap((fret, i) => (fret === undefined ? [] : [{ i, midi: openMidi[i] + fret }]));
  return {
    notes: sounding.map((s) => s.midi),
    instrument: FRETTED_PATCH[req.instrument],
    strings: sounding.map((s) => s.i),
  };
}
