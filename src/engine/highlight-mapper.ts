import type { KeyDescriptor, ColorTheme } from "../types";
import { FLAT_TO_SHARP, DEFAULT_WHITE_FILL, DEFAULT_BLACK_FILL } from "./svg-constants";

export function normalizeNote(note: string): string {
  return FLAT_TO_SHARP[note] ?? note;
}

export function mapHighlights(
  keys: KeyDescriptor[],
  highlightKeys: string[],
  theme?: ColorTheme
): string[] {
  const normalized = highlightKeys.map(normalizeNote);
  const remaining = [...normalized];

  return keys.map((key) => {
    const keyNote = normalizeNote(key.note);
    const matchIndex = remaining.indexOf(keyNote);
    const isHighlighted = matchIndex !== -1;

    if (isHighlighted) {
      remaining.splice(matchIndex, 1);
    }

    if (theme) {
      return key.isBlack
        ? theme.blackKey(keyNote, isHighlighted)
        : theme.whiteKey(keyNote, isHighlighted);
    }

    if (isHighlighted) {
      return key.isBlack ? "#5a8ab5" : "#a0c6e8";
    }

    return key.isBlack ? DEFAULT_BLACK_FILL : DEFAULT_WHITE_FILL;
  });
}
