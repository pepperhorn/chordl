import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { ChordBoard, BoardPlayer } from "../src";
import type { BoardItem } from "../src";

const cardFills = (c: HTMLElement, id: string) =>
  Array.from(c.querySelectorAll(`[data-board-id="${id}"] rect`)).map((r) => r.getAttribute("fill"));

const nameFont = (c: HTMLElement, id: string) => {
  const el = c.querySelector<HTMLElement>(`[data-board-id="${id}"] .bc-note-name`);
  if (!el) throw new Error(`no .bc-note-name in ${id}`);
  return parseFloat(el.style.fontSize);
};

const board = (items: BoardItem[], cardStyle?: unknown) =>
  render(<ChordBoard items={items} cardStyle={cardStyle as never} />).container;

describe("cardStyle on ChordBoard", () => {
  it("draws every keyboard card with the board's theme", () => {
    const c = board([{ id: "a", nl: "C" }, { id: "b", nl: "F" }], { theme: "crf" });
    expect(cardFills(c, "a")).toContain("#f86e6e");
    expect(cardFills(c, "b")).toContain("#b3f888");
    expect(cardFills(c, "a")).not.toContain("#a0c6e8");
    expect(cardFills(c, "b")).not.toContain("#a0c6e8");
  });

  it("simple draws today's colours", () => {
    const c = board([{ id: "a", nl: "C" }], { theme: "simple" });
    expect(cardFills(c, "a")).toContain("#a0c6e8");
    expect(cardFills(c, "a")).not.toContain("#f86e6e");
  });

  it("draws note names at the board size", () => {
    const styled = board([{ id: "a", nl: "C" }], { showNoteNames: true, noteNameSize: "xl" });
    const plain = board([{ id: "a", nl: "C note names in xl" }]);
    expect(nameFont(styled, "a")).toBe(nameFont(plain, "a"));
  });

  it("a card's own settings win", () => {
    const nl = "C note names in base boomwhacker";
    const styled = board([{ id: "a", nl }], { theme: "crf", showNoteNames: true, noteNameSize: "xl" });
    const plain = board([{ id: "a", nl }]);
    expect(nameFont(styled, "a")).toBe(nameFont(plain, "a"));
    expect(cardFills(styled, "a")).toContain("#e81c1c");
  });

  it("leaves guitar and text cards alone", () => {
    const c = board(
      [{ id: "g", nl: "C", display: "guitar" }, { id: "t", kind: "text", title: "Intro" }],
      { theme: "crf", showNoteNames: true, noteNameSize: "xl", noteNameMode: "midi" },
    );
    expect(c.querySelector('[data-board-id="g"]')).not.toBeNull();
    expect(c.querySelector('[data-board-id="t"]')).not.toBeNull();
    expect(c.querySelector('[data-board-id="g"] .bc-note-name')).toBeNull();
    expect(c.querySelector('[data-board-id="t"] .bc-note-name')).toBeNull();
  });

  it("renders an invalid cardStyle like none", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const c = board([{ id: "a", nl: "C" }], { theme: "neon", showNoteNames: "yes" });
    expect(c.querySelector(".bc-note-name")).toBeNull();
    expect(cardFills(c, "a")).toContain("#a0c6e8");
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("cardStyle on BoardPlayer", () => {
  it("draws the same style", () => {
    const { container } = render(
      <BoardPlayer items={[{ id: "a", nl: "C" }]} playing={false} onPlayingChange={() => {}}
        cardStyle={{ theme: "crf", showNoteNames: true }} />,
    );
    expect(cardFills(container, "a")).toContain("#f86e6e");
    expect(container.querySelector(".bc-note-name")).not.toBeNull();
  });
});
