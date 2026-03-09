export type Format = "compact" | "exact";
/** Tailwind-inspired text size scale for annotations. */
export type TextSize = "base" | "lg" | "xl" | "2xl";
export type WhiteNote = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export type NoteName = string;

export interface ColorTheme {
  name: string;
  whiteKey: (note: string, highlighted: boolean) => string;
  blackKey: (note: string, highlighted: boolean) => string;
}

export interface ParsedChordRequest {
  chordName: string;
  inversion?: number;
  /** When true, show all inversions side by side (root, 1st, 2nd, etc.) */
  allInversions?: boolean;
  startingNote?: string;
  startingDegree?: number;
  bassNote?: string;
  bassDegree?: number;
  spanFrom?: string;
  spanTo?: string;
  format?: Format;
  styleHint?: string;
  padding?: number;
  /** Octave shift for the chord: -1 = "down an octave", +1 = "up an octave" */
  chordOctaveShift?: number;
  /** Octave shift for the bass note: +1 = "up an octave", -1 = "down an octave" */
  bassOctaveShift?: number;
  /** Show note names below highlighted keys. */
  showNoteNames?: boolean;
  /** Text size for note name labels. */
  noteNameSize?: TextSize;
  /** Fingering values (aligned with chord notes). Numbers 1–5 plus extra symbols (0, -, x). Invalid entries become "?". */
  fingering?: (number | string)[];
  /** Auto-compute fingering when true (no explicit numbers given). */
  autoFingering?: boolean;
  /** Text size for fingering numbers. */
  fingeringSize?: TextSize;
}

export interface KeyDescriptor {
  note: string;
  /** Relative octave (0-based, increments each time C is crossed) */
  octave: number;
  isBlack: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HandBracket {
  label: string;
  /** Indices into the keys array for this hand's notes */
  keyIndices: number[];
}

// ─── ChordSheet types ──────────────────────────────────────────────────────

export type DisplayMode = "keyboard" | "staff" | "both";

export interface DisplayDefaults {
  display?: DisplayMode;
  format?: Format;
  theme?: ColorTheme | string;
  highlightColor?: string;
  padding?: number;
  scale?: number;
  glyphs?: "bravura" | "petaluma";
  showNoteNames?: boolean;
  noteNameSize?: TextSize;
  showFingering?: boolean;
  fingeringSize?: TextSize;
}

export interface ChordData {
  /** NL string — source of truth for chord resolution. */
  chord: string;
  /** Display override for the chord symbol heading. */
  chordHeading?: string;
  /** Text below fingering, inside the chord's bounding box. */
  annotationText?: string;
  /** Per-chord display mode override. */
  display?: DisplayMode;
  format?: Format;
  theme?: ColorTheme | string;
  highlightColor?: string;
  padding?: number;
}

export interface SectionData {
  /** Section letter ID (auto-assigned "A","B",... if omitted). */
  id?: string;
  heading?: string;
  subheading?: string;
  textAbove?: string;
  textBelow?: string;
  defaults?: DisplayDefaults;
  chords: ChordData[];
}

export interface ChordSheetData {
  /** Schema version. */
  v: string;
  heading?: string;
  subheading?: string;
  defaults?: DisplayDefaults;
  sections: SectionData[];
}
