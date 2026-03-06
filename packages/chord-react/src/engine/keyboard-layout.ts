import type { Format, WhiteNote, KeyDescriptor } from "../types";
import {
  WHITE_KEY_WIDTH,
  WHITE_KEY_HEIGHT_COMPACT,
  WHITE_KEY_HEIGHT_EXACT,
  BLACK_KEY_WIDTH,
  BLACK_KEY_HEIGHT_COMPACT,
  BLACK_KEY_HEIGHT_EXACT,
  BLACK_KEY_OFFSETS,
  WHITE_NOTES_WITH_SHARPS,
  WHITE_NOTE_ORDER,
} from "./svg-constants";

const SHARP_SUFFIX: Record<string, string> = {
  C: "C#",
  D: "D#",
  F: "F#",
  G: "G#",
  A: "A#",
};

export function computeKeyboard(
  startFrom: WhiteNote = "C",
  size: number = 8,
  format: Format = "compact"
): KeyDescriptor[] {
  const whiteHeight =
    format === "compact" ? WHITE_KEY_HEIGHT_COMPACT : WHITE_KEY_HEIGHT_EXACT;
  const blackHeight =
    format === "compact" ? BLACK_KEY_HEIGHT_COMPACT : BLACK_KEY_HEIGHT_EXACT;

  const keys: KeyDescriptor[] = [];
  const startIndex = WHITE_NOTE_ORDER.indexOf(startFrom);
  let whiteX = 0;

  for (let i = 0; i < size; i++) {
    const noteIndex = (startIndex + i) % 7;
    const whiteNote = WHITE_NOTE_ORDER[noteIndex];

    // Add white key
    keys.push({
      note: whiteNote,
      isBlack: false,
      x: whiteX,
      y: 0,
      width: WHITE_KEY_WIDTH,
      height: whiteHeight,
    });

    // Add black key if this white note has one
    if (WHITE_NOTES_WITH_SHARPS.has(whiteNote)) {
      const offset = BLACK_KEY_OFFSETS[whiteNote];
      keys.push({
        note: SHARP_SUFFIX[whiteNote],
        isBlack: true,
        x: whiteX + offset,
        y: 0,
        width: BLACK_KEY_WIDTH,
        height: blackHeight,
      });
    }

    whiteX += WHITE_KEY_WIDTH;
  }

  return keys;
}

export function computeSvgDimensions(
  size: number,
  format: Format = "compact"
): { width: number; height: number } {
  const height =
    format === "compact" ? WHITE_KEY_HEIGHT_COMPACT : WHITE_KEY_HEIGHT_EXACT;
  return {
    width: size * WHITE_KEY_WIDTH,
    height,
  };
}
