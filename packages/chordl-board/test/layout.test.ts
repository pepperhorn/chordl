import { describe, it, expect } from "vitest";
import { GRID_TRACKS, trackWidth, computeRowSpans, sizeFits } from "../src/layout";
import type { BoardItem } from "../src/types";

const card = (size: BoardItem["size"], breakAfter = false): BoardItem =>
  ({ id: Math.random().toString(36).slice(2), kind: "chord", nl: "C", size, breakAfter });

describe("board layout", () => {
  it("gives a regular card one column's worth of tracks", () => {
    expect(trackWidth(card("rg"), 4)).toBe(GRID_TRACKS / 4);
  });

  it("halves that for sm and triples it for 2xl", () => {
    expect(trackWidth(card("sm"), 4)).toBe(GRID_TRACKS / 8);
    expect(trackWidth(card("2xl"), 4)).toBe((GRID_TRACKS * 3) / 4);
  });

  it("packs four regular cards onto one row at four columns", () => {
    const { rowOthers } = computeRowSpans([card("rg"), card("rg"), card("rg"), card("rg")], 4);
    // Every card shares a row with three others of the same width.
    expect(rowOthers[0]).toBe((GRID_TRACKS / 4) * 3);
  });

  it("starts a new row after a card with breakAfter", () => {
    const { rowOthers } = computeRowSpans([card("rg", true), card("rg")], 4);
    expect(rowOthers[0]).toBe(0);
    expect(rowOthers[1]).toBe(0);
  });

  it("refuses a size that would overflow the row it is on", () => {
    const items = [card("rg"), card("rg"), card("rg"), card("rg")];
    const { rowOthers } = computeRowSpans(items, 4);
    expect(sizeFits(rowOthers, 0, 1, 4)).toBe(true);
    expect(sizeFits(rowOthers, 0, 2, 4)).toBe(false);
  });
});
