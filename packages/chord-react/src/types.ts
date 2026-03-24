import type { CSSProperties } from "react";
import type { UIThemeMode } from "./config";
// Re-export shared types from core
export type {
  Format, TextSize, NoteNameMode, WhiteNote, NoteName, ColorTheme,
  ParsedChordRequest, KeyDescriptor, HandBracket,
  DisplayMode, DisplayDefaults, ChordData, SectionData, ChordSheetData,
} from "@better-chord/core";
// Import for use in local types
import type { Format, ColorTheme, TextSize, NoteNameMode, WhiteNote, NoteName, HandBracket, DisplayMode, ChordSheetData } from "@better-chord/core";

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
  /** Display-friendly note names aligned with highlightKeys (e.g. "Bb" instead of "A#").
   *  When omitted, names are derived from highlightKeys (sharp-normalized). */
  displayNoteNames?: string[];
  /** Text size for note name labels (default "base"). */
  noteNameSize?: TextSize;
  /** Note name display mode: "pitch-class" (default, e.g. "C") or "midi" (e.g. "C4"). */
  noteNameMode?: NoteNameMode;
  /** Base MIDI octave for the keyboard's first octave (default 4). Used when noteNameMode="midi". */
  midiBaseOctave?: number;
  /** Fingering values to display below keys (and below note names if present).
   *  Array aligned with highlightKeys — numbers 1–5, extra symbols (0, -, x), or "?" for invalid. */
  fingering?: (number | string)[];
  /** Text size for fingering numbers (default "base"). */
  fingeringSize?: TextSize;
  /** UI chrome theme: "light" (default) or "dark". */
  uiTheme?: UIThemeMode;
  /** Crop half a white key on the left edge (black-key context padding). */
  clipLeft?: boolean;
  /** Crop half a white key on the right edge (black-key context padding). */
  clipRight?: boolean;
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
  /** Display mode: keyboard (default), staff notation, or both side-by-side. */
  display?: DisplayMode;
  /** UI chrome theme: "light" (default) or "dark". */
  uiTheme?: UIThemeMode;
  className?: string;
  style?: CSSProperties;
}

export type PianoChordProps = ChordProps | KeyboardProps;

export interface ChordSheetProps {
  data: ChordSheetData;
  /** Hide chord reference IDs (for print / PDF). */
  printMode?: boolean;
  /** UI chrome theme: "light" (default) or "dark". */
  uiTheme?: UIThemeMode;
  className?: string;
  style?: CSSProperties;
}
