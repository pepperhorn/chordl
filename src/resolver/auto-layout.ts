import type { WhiteNote } from "../types";
import { WHITE_NOTE_ORDER } from "../engine/svg-constants";

const NOTE_TO_SEMITONE: Record<string, number> = {
  C: 0, "C#": 1,
  D: 2, "D#": 3,
  E: 4,
  F: 5, "F#": 6,
  G: 7, "G#": 8,
  A: 9, "A#": 10,
  B: 11,
};

// Map a note to its nearest white key (the white key it sits on or just below)
function nearestWhiteKey(note: string): WhiteNote {
  const base = note.replace("#", "");
  if (WHITE_NOTE_ORDER.includes(base as WhiteNote)) {
    return base as WhiteNote;
  }
  // For sharps, return the white key they belong to
  return base as WhiteNote;
}

// Count white keys from one white note to another (inclusive of start, exclusive of end)
function whiteKeySpan(from: WhiteNote, to: WhiteNote): number {
  const fromIdx = WHITE_NOTE_ORDER.indexOf(from);
  let toIdx = WHITE_NOTE_ORDER.indexOf(to);
  if (toIdx <= fromIdx) toIdx += 7;
  return toIdx - fromIdx;
}

export interface LayoutOptions {
  padding?: number;
  spanFrom?: string;
  spanTo?: string;
}

export interface LayoutResult {
  startFrom: WhiteNote;
  size: number;
}

export function calculateLayout(
  notes: string[],
  options: LayoutOptions = {}
): LayoutResult {
  const { padding = 1, spanFrom, spanTo } = options;

  if (spanFrom && spanTo) {
    const from = nearestWhiteKey(spanFrom);
    const to = nearestWhiteKey(spanTo);
    const span = whiteKeySpan(from, to);
    return {
      startFrom: from,
      size: span === 0 ? 8 : span + 1,
    };
  }

  if (notes.length === 0) {
    return { startFrom: "C", size: 8 };
  }

  // Find semitone positions
  const semitones = notes.map((n) => NOTE_TO_SEMITONE[n] ?? 0);

  // Find bounding white keys
  const whiteKeys = notes.map(nearestWhiteKey);
  const indices = whiteKeys.map((w) => WHITE_NOTE_ORDER.indexOf(w));

  // Find min and max, accounting for wrapping
  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);

  // Check if the chord wraps around (e.g., B to C)
  const span = maxIdx - minIdx;

  let startIdx = minIdx - padding;
  let endIdx = maxIdx + padding;

  // Ensure we don't go below 0
  if (startIdx < 0) startIdx += 7;
  if (endIdx >= 7) {
    // Need extra keys to wrap
  }

  const startNote = WHITE_NOTE_ORDER[((startIdx % 7) + 7) % 7] as WhiteNote;
  const keyCount = (endIdx - minIdx + padding) + 1;

  return {
    startFrom: startNote,
    size: Math.max(keyCount, notes.length + 2),
  };
}
