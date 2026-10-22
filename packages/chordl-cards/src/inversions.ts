/**
 * Inversions of a catalogue chord, with an optional sticky bass.
 *
 * A plain chord inverts by rotating its spelled tones: C -> C E G, E G C, G C E.
 * A slash chord keeps its bass in the bass (user decision, 2026-10-22: "define a
 * sticky root so only the rest of the chord is inverted"): only the upper chord
 * rotates above it, and the name stays the slash name.
 *
 *   Bb/C  0: C | Bb D F   "Bb/C (upper root position)"
 *         1: C | D F Bb   "Bb/C (upper 1st inv)"
 *         2: C | F Bb D   "Bb/C (upper 2nd inv)"
 *
 * Figured bass is the upper chord's (5/3 6/3 6/4; 7 6/5 4/3 4/2), not counted
 * from the sticky bass. Tones are the catalogue's printed spelling
 * (`spellChord`): dim7 keeps its 6th spelling (Cdim7 = C Eb Gb A, so its third
 * inversion is "Cdim7/A", not "/Bbb").
 *
 * crf-admin's "Chords — derive inversions" flow mirrors this rule in its
 * compute script (fields in snake_case there: bass_note, slash_name,
 * figured_bass, sticky_bass); keep the two in step.
 */
import { noteParts, spelledChord } from "./catalogue";

export interface ChordInversion {
  /** 0 = root position of the (upper) chord. */
  inversion: number;
  /** The lowest note: the sticky bass, else the rotated chord's first tone. */
  bassNote: string;
  /** Low to high: the sticky bass (if any), then the rotated upper chord. */
  notes: string[];
  /** The rotated upper chord (equal to `notes` without a sticky bass). */
  upper: string[];
  /** The bass held under every inversion, or null. */
  stickyBass: string | null;
  /** "C", "C/E", "C/G"; with a sticky bass always the slash name ("Bb/C"). */
  slashName: string;
  /** Of the upper chord: 5/3 6/3 6/4 for triads, 7 6/5 4/3 4/2 for sevenths, "" otherwise. */
  figuredBass: string;
  /** "C (root position)", "C/E (1st inv)", "Bb/C (upper 1st inv)". */
  label: string;
}

export interface InversionOptions {
  /**
   * The note held in the bass. Default: the chord's slash bass when it has one.
   * A note name sets one (Bb with stickyBass "C" is Bb/C); false ignores a
   * slash bass and inverts the upper chord on its own.
   */
  stickyBass?: string | false;
}

const FIG3 = ["5/3", "6/3", "6/4"];
const FIG4 = ["7", "6/5", "4/3", "4/2"];

/** "1st", "2nd", "3rd", "4th" ... */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export function figuredBassFor(size: number, inversion: number): string {
  return (size === 3 ? FIG3[inversion] : size === 4 ? FIG4[inversion] : undefined) ?? "";
}

/**
 * Every inversion of a chord symbol ("C", "Cdim7", "Bb/C", "D7/C"): one row per
 * tone of the (upper) chord. Throws on a symbol the catalogue does not hold.
 */
export function inversionsFor(chord: string, options: InversionOptions = {}): ChordInversion[] {
  const spelled = spelledChord(chord);
  const upperName = chord.trim();
  let sticky: string | null;
  if (options.stickyBass === false) sticky = null;
  else if (typeof options.stickyBass === "string") {
    if (!noteParts(options.stickyBass)) throw new Error(`stickyBass "${options.stickyBass}" is not a note`);
    sticky = options.stickyBass.replace(/♭/g, "b").replace(/♯/g, "#");
  } else sticky = spelled.bass ?? null;

  // The name the rows carry: with a sticky bass, the slash name; without one,
  // the upper chord's own name (a slash bass dropped by stickyBass: false).
  const base = spelled.bass ? upperName.replace(/\/\s*[^/]+$/, "") : upperName;
  const slash = sticky ? `${base}/${sticky}` : base;

  const tones = spelled.pitchClasses;
  const n = tones.length;
  return tones.map((_, i) => {
    const upper = [...tones.slice(i), ...tones.slice(0, i)];
    const bassNote = sticky ?? upper[0];
    const slashName = sticky ? slash : i === 0 ? base : `${base}/${upper[0]}`;
    const position = i === 0 ? "root position" : `${ordinal(i)} inv`;
    return {
      inversion: i,
      bassNote,
      notes: sticky ? [sticky, ...upper] : upper,
      upper,
      stickyBass: sticky,
      slashName,
      figuredBass: figuredBassFor(n, i),
      label: `${slashName} (${sticky ? "upper " : ""}${position})`,
    };
  });
}
