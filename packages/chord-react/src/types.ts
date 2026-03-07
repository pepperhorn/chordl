import type { CSSProperties } from "react";
import type { UIThemeMode } from "./config";

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

export interface KeyboardProps {
  format?: Format;
  size?: number;
  startFrom?: WhiteNote;
  highlightKeys?: NoteName[];
  /** All notes for playback (e.g. LH bass + RH chord). Falls back to highlightKeys. */
  allNotes?: NoteName[];
  /** Left-hand bass notes (for MIDI export with separate clefs). */
  lhNotes?: NoteName[];
  /** Right-hand playback octave (default 4). */
  rhOctave?: number;
  /** Left-hand bass playback octave (default 3). */
  lhOctave?: number;
  theme?: ColorTheme | string;
  highlightColor?: string;
  showPlayback?: boolean;
  chordLabel?: string;
  /** Bracket annotations below the keyboard (e.g. L.H. / R.H.) */
  handBrackets?: HandBracket[];
  /** Display scale factor (0.5 = 50%, 1 = 100%). Controls maxWidth of the SVG. */
  scale?: number;
  /** Show note names (capital letters) below highlighted keys. */
  showNoteNames?: boolean;
  /** Text size for note name labels (default "base"). */
  noteNameSize?: TextSize;
  /** Fingering numbers to display below keys (and below note names if present).
   *  Array aligned with highlightKeys — one number per highlighted note. */
  fingering?: number[];
  /** Text size for fingering numbers (default "base"). */
  fingeringSize?: TextSize;
  /** UI chrome theme: "light" (default) or "dark". */
  uiTheme?: UIThemeMode;
  className?: string;
  style?: CSSProperties;
}

export interface ChordProps {
  chord: string;
  format?: Format;
  theme?: ColorTheme | string;
  highlightColor?: string;
  padding?: number;
  /** Display scale factor (0.5 = 50%, 1 = 100%). Controls maxWidth of the SVG. */
  scale?: number;
  /** UI chrome theme: "light" (default) or "dark". */
  uiTheme?: UIThemeMode;
  className?: string;
  style?: CSSProperties;
}

export type PianoChordProps = ChordProps | KeyboardProps;

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
  /** Fingering numbers (aligned with chord notes). */
  fingering?: number[];
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
