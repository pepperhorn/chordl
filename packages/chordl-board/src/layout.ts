import type { BoardItem } from "./types.js";
import { BOARD_CARD_SIZE_FACTORS } from "./types.js";

/**
 * Track count for the fixed-column grid.
 *
 * Every card width has to land on a whole track, at every column count the
 * board offers (1–4) and every card size (½, ¾, 1, 1½, 2 and 3 columns) — and
 * so does *half* the width left over at the end of a row, which is what centres
 * a short row exactly. 480 is the smallest count that satisfies all three:
 * `480 · size / columns` and `240 · size / columns` are whole for every pair.
 */
export const GRID_TRACKS = 480;

/**
 * Where each card sits on the track grid, and how big it draws.
 *
 * A row holds one board-width of cards. Sizes make cards wider, so a row is
 * packed by width rather than by count: cards join the current row until the
 * next one would not fit, and a break ends a row wherever it falls. Whatever
 * width is left over is split evenly either side, so a row that does not fill
 * the board is centred rather than hugging the left edge.
 */
export const trackWidth = (item: BoardItem, columns: number) =>
  (GRID_TRACKS * BOARD_CARD_SIZE_FACTORS[item.size ?? "rg"]) / columns;

export interface RowSpans {
  /** Tracks each card spans. */
  spans: number[];
  /** Starting track of the first card on a short row, keyed by its index. */
  rowStarts: Record<number, number>;
  /** Tracks used by every card sharing a row with this one, itself excluded. */
  rowOthers: number[];
}

/** Packs `items` into rows of `GRID_TRACKS` tracks. See `trackWidth`. */
export function computeRowSpans(items: BoardItem[], columns: number): RowSpans {
  const spans: number[] = [];
  const rowStarts: Record<number, number> = {};
  /** Tracks used by every card sharing a row with this one, itself excluded. */
  const rowOthers: number[] = [];
  let rowStart = 0;
  let used = 0;
  const closeRow = (endIndex: number) => {
    const leftover = GRID_TRACKS - used;
    if (leftover > 0) rowStarts[rowStart] = leftover / 2 + 1;
    for (let j = rowStart; j <= endIndex; j++) rowOthers[j] = used - spans[j];
    rowStart = endIndex + 1;
    used = 0;
  };

  for (let i = 0; i < items.length; i++) {
    spans[i] = Math.min(trackWidth(items[i], columns), GRID_TRACKS);
    // A card too wide for what is left starts the row it fits in.
    if (used > 0 && used + spans[i] > GRID_TRACKS) closeRow(i - 1);
    used += spans[i];
    if (items[i].breakAfter || used >= GRID_TRACKS || i === items.length - 1) closeRow(i);
  }

  return { spans, rowStarts, rowOthers };
}

/**
 * A size is offered only if the card's row can hold it. Growing past the row
 * would push a neighbour onto the next line — a size control that silently
 * reflowed the board is not a size control, so the ones that do not fit are
 * shown greyed instead.
 */
export const sizeFits = (
  rowOthers: number[],
  index: number,
  factor: number,
  columns: number,
): boolean => {
  const width = (GRID_TRACKS * factor) / columns;
  return width <= GRID_TRACKS && (rowOthers[index] ?? 0) + width <= GRID_TRACKS;
};
