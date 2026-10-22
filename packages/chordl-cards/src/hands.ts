/**
 * Decides which hand plays which tone of a chord, for the keyboard-hands face:
 * the bass in the left hand, two tones in the right.
 *
 * The right hand gets the two tones that say what KIND of chord it is - the
 * 3rd (or the sus tone) and the 5th, or the 3rd and the 6th/7th when the chord
 * has one. The root is the left hand's. Spelling comes from chordl-core's
 * `resolveChord`, the same authority `chordNotes` in ./faces.ts uses, so
 * a card says "Bb" where a sharp-only table would say "A#".
 *
 * Pure and node-free: it is bundled for the browser with the card builder and the web player.
 */

import { resolveChord } from "@pepperhorn/chordl-core";
import { keyboardWindow, voiceAscending, type KeyboardWindow } from "./keyboard-window";

export interface HandTone {
  /** Display spelling, "Bb" not "A#". */
  name: string;
  /** Sharp identity, "A#". */
  pc: string;
  /** Semitones above the L.H. bass; the bass itself is 0. */
  semitone: number;
}

export interface ExplodedVoicing {
  lh: HandTone[];
  rh: HandTone[];
}

/**
 * White keys the hands face shows, and the context it guarantees either side.
 * Sized for a bass plus an R.H. in the octave directly above it: the widest
 * voicing is a maj7 on a black-key bass (C#maj7 -> C# | E# B#), 8 white keys,
 * since the bass is measured from the white key beneath it. 8 + 3 + 3 = 14, one
 * key more than the plain keyboard face's 13, which fits the same 8-key span
 * with only 2 keys of context (theme `keyboard.minContextKeys`).
 */
export const HANDS_WINDOW = { whiteKeys: 14, minContextKeys: 3 } as const;

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Chord-tone intervals and the indices (into those intervals) the R.H. plays. */
const QUALITIES: Record<string, { intervals: number[]; rh: [number, number] }> = {
  "": { intervals: [0, 4, 7], rh: [1, 2] },
  m: { intervals: [0, 3, 7], rh: [1, 2] },
  dim: { intervals: [0, 3, 6], rh: [1, 2] },
  aug: { intervals: [0, 4, 8], rh: [1, 2] },
  sus2: { intervals: [0, 2, 7], rh: [1, 2] },
  sus4: { intervals: [0, 5, 7], rh: [1, 2] },
  "6": { intervals: [0, 4, 7, 9], rh: [1, 3] },
  m6: { intervals: [0, 3, 7, 9], rh: [1, 3] },
  "7": { intervals: [0, 4, 7, 10], rh: [1, 3] },
  maj7: { intervals: [0, 4, 7, 11], rh: [1, 3] },
  m7: { intervals: [0, 3, 7, 10], rh: [1, 3] },
  m7b5: { intervals: [0, 3, 6, 10], rh: [1, 3] },
  dim7: { intervals: [0, 3, 6, 9], rh: [1, 3] },
  mMaj7: { intervals: [0, 3, 7, 11], rh: [1, 3] },
};

const CHORD = /^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/;

function pcOf(name: string): number {
  const acc = name[1] === "#" ? 1 : name[1] === "b" ? -1 : 0;
  return (LETTER_PC[name[0]] + acc + 12) % 12;
}

/**
 * The exploded voicing of a chord symbol, or undefined for anything outside the
 * table above (9ths, power chords, add chords, unparseable input) - and for a
 * quality chordl-core cannot spell, rather than inventing a spelling here.
 *
 * Over a slash bass that is a chord tone of a triad, the R.H. takes the two
 * triad tones the bass is not. On a quality with four tones (6ths, 7ths) a
 * chord-tone bass is not offered: the R.H. pair would drop the 6th/7th or the
 * root and so rename the chord (C7/E would print as C/E). Over a foreign bass
 * any quality keeps its normal pair and the bass is spelled as written.
 */
export function explodedVoicing(chord: string): ExplodedVoicing | undefined {
  const m = CHORD.exec(chord);
  if (!m) return undefined;
  const [, root, quality, slash] = m;
  const q = QUALITIES[quality];
  if (!q) return undefined;

  let spelled: string[];
  try {
    spelled = resolveChord(root + quality).notes;
  } catch {
    return undefined;
  }
  if (spelled.length !== q.intervals.length) return undefined;

  const tones = spelled.map((name) => ({ name, pc: pcOf(name) }));
  const bassPc = slash ? pcOf(slash) : tones[0].pc;
  const bassIdx = tones.findIndex((t) => t.pc === bassPc);
  const bass = bassIdx >= 0 ? tones[bassIdx] : { name: slash, pc: bassPc };

  // Only triads take a chord-tone slash bass; see the docstring.
  if (slash && bassIdx >= 0 && q.intervals.length === 4) return undefined;
  const rhTones = !slash || bassIdx < 0
    ? q.rh.map((i) => tones[i])
    : [0, 1, 2].filter((i) => i !== bassIdx).map((i) => tones[i]);

  const rh = rhTones
    .map((t) => {
      const semitone = (t.pc - bass.pc + 12) % 12;
      // The R.H. never doubles the bass's pitch class; 0 would be a unison.
      if (semitone === 0) throw new Error(`hands: R.H. tone ${t.name} doubles the bass ${bass.name}`);
      return { name: t.name, pc: SHARP_NAMES[t.pc], semitone };
    })
    .sort((a, b) => a.semitone - b.semitone);

  return { lh: [{ name: bass.name, pc: SHARP_NAMES[bass.pc], semitone: 0 }], rh };
}

/**
 * The keyboard window for a chord's exploded voicing, with the L.H. bass pinned
 * to the leftmost lit key and the R.H. tones placed above it by their semitone.
 *
 * Throws, naming the chord, when the chord has no exploded voicing: a card that
 * silently fell back to a plain chord would not be the face the deck asked for.
 */
export function handsWindow(chord: string): { window: KeyboardWindow; voicing: ExplodedVoicing } {
  const voicing = explodedVoicing(chord);
  if (!voicing) throw new Error(`face "keyboard-hands" cannot print "${chord}"`);
  const tones = [...voicing.lh, ...voicing.rh];
  const bass = voiceAscending([voicing.lh[0].pc])[0];
  const window = keyboardWindow(
    tones.map((t) => t.pc),
    chord,
    HANDS_WINDOW,
    tones.map((t) => bass + t.semitone),
  );
  return { window, voicing };
}
