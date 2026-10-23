/**
 * One guitar position for any spelled chord: chords-db when it has a shape
 * that actually spells the chord, the regular power-chord shape for "5", and
 * the voicing generator for everything else.
 *
 * chords-db is checked, not trusted blindly: its first C9 position has no b7
 * and one of its C13 positions stacks the 11 on the major 3rd. A position is
 * taken only if `positionSpellsChord` accepts it under the same rule table the
 * generator obeys; otherwise the next position is tried, then the generator.
 */
import guitarDb from "./generated/guitar.slim.json" with { type: "json" };
import type { ChordsDb, ChordsDbPosition } from "./instruments.js";
import { powerChordPosition } from "./powerChords.js";
import {
  analyzeChordTones,
  generateGuitarVoicings,
  positionSpellsChord,
} from "./voicingGenerator.js";
import type { GeneratedPosition } from "./voicingGenerator.js";

const GUITAR_DB = guitarDb as unknown as ChordsDb;

export interface SpelledChord {
  /** Root, spelled: "C", "F#", "Bb". */
  root: string;
  /** Chord tones, spelled; letters decide degrees (D# is #9, Eb is b3). */
  pitchClasses: string[];
  /** Slash bass, spelled. Omit (or equal the root) for root position. */
  bass?: string;
}

export interface LibraryPosition extends ChordsDbPosition {
  generated: false;
  source: "chords-db" | "power-chord";
  /** chords-db suffix the shape came from. */
  suffix?: string;
}

export type GuitarPosition = LibraryPosition | GeneratedPosition;

// chords-db suffix → pitch classes above the root (the chord's definition, not
// any one position's subset).
const DB_SUFFIX_PCS: Record<string, number[]> = {
  major: [0, 4, 7], minor: [0, 3, 7], dim: [0, 3, 6], dim7: [0, 3, 6, 9],
  sus2: [0, 2, 7], sus4: [0, 5, 7], "7sus4": [0, 5, 7, 10], aug: [0, 4, 8],
  "6": [0, 4, 7, 9], "69": [0, 2, 4, 7, 9], "7": [0, 4, 7, 10], "7b5": [0, 4, 6, 10],
  aug7: [0, 4, 8, 10], "9": [0, 2, 4, 7, 10], "9b5": [0, 2, 4, 6, 10], aug9: [0, 2, 4, 8, 10],
  "7b9": [0, 1, 4, 7, 10], "7#9": [0, 3, 4, 7, 10], "11": [0, 2, 4, 5, 7, 10],
  "9#11": [0, 2, 4, 6, 7, 10], "13": [0, 2, 4, 7, 9, 10], maj7: [0, 4, 7, 11],
  maj7b5: [0, 4, 6, 11], "maj7#5": [0, 4, 8, 11], maj9: [0, 2, 4, 7, 11],
  maj11: [0, 2, 4, 5, 7, 11], maj13: [0, 2, 4, 7, 9, 11], m6: [0, 3, 7, 9],
  m69: [0, 2, 3, 7, 9], m7: [0, 3, 7, 10], m7b5: [0, 3, 6, 10], m9: [0, 2, 3, 7, 10],
  m11: [0, 2, 3, 5, 7, 10], mmaj7: [0, 3, 7, 11], mmaj7b5: [0, 3, 6, 11],
  mmaj9: [0, 2, 3, 7, 11], mmaj11: [0, 2, 3, 5, 7, 11], add9: [0, 2, 4, 7], madd9: [0, 2, 3, 7],
};

const DB_KEY_BY_PC = ["C", "Csharp", "D", "Eb", "E", "F", "Fsharp", "G", "Ab", "A", "Bb", "B"];
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function pcOf(note: string): number {
  let v = LETTER_PC[note.charAt(0).toUpperCase()];
  for (const ch of note.slice(1)) v += ch === "#" ? 1 : ch === "b" ? -1 : 0;
  return ((v % 12) + 12) % 12;
}

const sameSet = (a: number[], b: number[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

function relativeSet(chord: SpelledChord): number[] {
  const r = pcOf(chord.root);
  return [...new Set([chord.root, ...chord.pitchClasses].map((n) => (pcOf(n) - r + 12) % 12))];
}

function isSlash(chord: SpelledChord): boolean {
  return chord.bass !== undefined && pcOf(chord.bass) !== pcOf(chord.root);
}

/** The chords-db suffix carrying exactly this chord, or null. */
export function chordsDbSuffixFor(chord: SpelledChord): string | null {
  const set = relativeSet(chord);
  const entries = GUITAR_DB.chords[DB_KEY_BY_PC[pcOf(chord.root)]] ?? [];
  if (isSlash(chord)) {
    const quality = sameSet(set, [0, 4, 7]) ? "" : sameSet(set, [0, 3, 7]) ? "m" : null;
    if (quality === null) return null;
    const bassPc = pcOf(chord.bass!);
    const hit = entries.find(
      (e) => e.suffix.startsWith(`${quality}/`) && e.suffix.indexOf("/") === quality.length &&
        pcOf(e.suffix.slice(quality.length + 1)) === bassPc,
    );
    return hit ? hit.suffix : null;
  }
  for (const [suffix, pcs] of Object.entries(DB_SUFFIX_PCS)) {
    if (sameSet(set, pcs) && entries.some((e) => e.suffix === suffix)) return suffix;
  }
  return null;
}

/**
 * Every chords-db six-string position that spells the chord (see
 * `positionSpellsChord`), in chords-db's order — the alternatives elsewhere on
 * the neck. The first is the one `guitarPositionFor` prints. Empty when
 * chords-db has no entry for the chord or none of its positions spells it.
 */
export function guitarLibraryPositionsFor(chord: SpelledChord): LibraryPosition[] {
  const bass = isSlash(chord) ? chord.bass : undefined;
  const analysis = analyzeChordTones(chord.root, chord.pitchClasses, bass);
  const suffix = chordsDbSuffixFor(chord);
  if (!suffix) return [];
  const entry = GUITAR_DB.chords[DB_KEY_BY_PC[pcOf(chord.root)]].find((e) => e.suffix === suffix)!;
  return entry.positions
    .filter((p) => positionSpellsChord(p, analysis))
    .map((p) => ({ ...p, generated: false as const, source: "chords-db" as const, suffix }));
}

/**
 * The best guitar position for a spelled chord, or null if none is playable
 * under the generator's constraints.
 */
export function guitarPositionFor(chord: SpelledChord): GuitarPosition | null {
  const bass = isSlash(chord) ? chord.bass : undefined;

  const library = guitarLibraryPositionsFor(chord)[0];
  if (library) return library;

  if (!bass && sameSet(relativeSet(chord), [0, 7])) {
    const pos = powerChordPosition(pcOf(chord.root), { stringSet: "E" });
    if (pos) return { ...pos, generated: false, source: "power-chord" };
  }

  return generateGuitarVoicings(chord.pitchClasses, { root: chord.root, bass, limit: 1 })[0] ?? null;
}
