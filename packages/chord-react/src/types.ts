import type { CSSProperties } from "react";
import type { UIThemeMode } from "./config";
// Re-export shared types from core
export type {
  Format, TextSize, WhiteNote, NoteName, ColorTheme,
  ParsedChordRequest, KeyDescriptor, HandBracket,
} from "@better-chord/core";
// Import for use in local types
import type { Format, ColorTheme, TextSize, WhiteNote, NoteName, HandBracket } from "@better-chord/core";

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
