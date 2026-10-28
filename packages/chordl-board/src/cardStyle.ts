import type { NoteNameMode, TextSize } from "@pepperhorn/chordl-core";
import { isTextCard } from "./types.js";
import type { BoardItem } from "./types.js";

export const BOARD_CARD_THEMES = ["simple", "crf", "boomwhacker"] as const;
export type BoardCardTheme = (typeof BOARD_CARD_THEMES)[number];

/**
 * Board-wide look for keyboard cards. Owned by the host, never stored in board
 * JSON; `noteNameMode` is narrowed because degrees stay a per-card choice.
 */
export interface BoardCardStyle {
  theme?: BoardCardTheme;
  showNoteNames?: boolean;
  noteNameSize?: TextSize;
  noteNameMode?: "pitch-class" | "midi";
}

/** `PianoKeyboard`'s own default, so the editor can tell when a card's size matches what the board draws. */
export const DEFAULT_NOTE_NAME_SIZE: TextSize = "lg";

const NOTE_NAME_SIZES: readonly TextSize[] = ["base", "lg", "xl", "2xl"];
const NOTE_NAME_MODES = ["pitch-class", "midi"] as const;

/** Untrusted host input in, a fresh object with only recognised, defined keys out. */
export function normalizeCardStyle(value: unknown): BoardCardStyle {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const v = value as Record<string, unknown>;
  const out: BoardCardStyle = {};
  if (typeof v.theme === "string" && (BOARD_CARD_THEMES as readonly string[]).includes(v.theme)) {
    out.theme = v.theme as BoardCardTheme;
  }
  if (typeof v.showNoteNames === "boolean") out.showNoteNames = v.showNoteNames;
  if (typeof v.noteNameSize === "string" && (NOTE_NAME_SIZES as readonly string[]).includes(v.noteNameSize)) {
    out.noteNameSize = v.noteNameSize as TextSize;
  }
  if (typeof v.noteNameMode === "string" && (NOTE_NAME_MODES as readonly string[]).includes(v.noteNameMode)) {
    out.noteNameMode = v.noteNameMode as "pitch-class" | "midi";
  }
  return out;
}

export function cardStyleChordProps(style: BoardCardStyle): {
  theme?: string;
  showNoteNames?: boolean;
  noteNameSize?: TextSize;
  noteNameMode?: NoteNameMode;
} {
  const out: { theme?: string; showNoteNames?: boolean; noteNameSize?: TextSize; noteNameMode?: NoteNameMode } = {};
  // "simple" is today's look, which is what passing no theme draws.
  if (style.theme !== undefined && style.theme !== "simple") out.theme = style.theme;
  if (style.showNoteNames !== undefined) out.showNoteNames = style.showNoteNames;
  if (style.noteNameSize !== undefined) out.noteNameSize = style.noteNameSize;
  if (style.noteNameMode !== undefined) out.noteNameMode = style.noteNameMode;
  return out;
}

/** What of the style a card's rendered image actually depends on. */
export function cardStyleRenderConfig(item: BoardItem, style: BoardCardStyle): Partial<BoardCardStyle> {
  // Guitar frames have no theme/note-name props; staff-only cards draw no keyboard.
  if (isTextCard(item) || item.display === "guitar" || item.display === "staff") return {};
  return cardStyleChordProps(style) as Partial<BoardCardStyle>;
}
