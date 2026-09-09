import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ChordBoard, BOARD_CARD_SIZES } from "../src";
import type { BoardItem, BoardCardSize } from "../src";

const card = (id: string, size?: BoardCardSize, breakAfter = false): BoardItem =>
  ({ id, nl: "C", size, breakAfter });

/**
 * The size controls moved out of the card into the floating toolbar, which
 * exists only for the selected card — so every test here selects first, and
 * the query is scoped to the toolbar's own `data-toolbar-for` rather than to a
 * card that no longer contains any buttons.
 */
const sizeBtn = (id: string, size: BoardCardSize) =>
  document.body.querySelector<HTMLButtonElement>(
    `.chordl-board-card-toolbar[data-toolbar-for="${id}"] .chordl-board-action-size--${size}`,
  )!;

const spanOf = (container: HTMLElement, id: string) =>
  Number(
    container
      .querySelector<HTMLElement>(`[data-board-id="${id}"]`)!
      .style.gridColumn.replace(/^.*span /, ""),
  );

/**
 * A size decides two things at once: how much of the row a card takes, and how
 * big its diagram draws. They cannot come apart — extra width with a diagram
 * the old size is just empty paper.
 */
describe("card size", () => {
  it("offers every size on a card", () => {
    render(
      <ChordBoard items={[card("a")]} selectedId="a" onResize={() => {}} />,
    );
    const labels = [...document.body.querySelectorAll(".chordl-board-action-size")].map((b) => b.textContent);
    expect(labels).toEqual([...BOARD_CARD_SIZES]);
  });

  it("omits the control when the host wires no handler", () => {
    // Selected, so the toolbar is up and the absence is the missing handler
    // rather than the missing toolbar.
    render(<ChordBoard items={[card("a")]} selectedId="a" />);
    expect(document.body.querySelector(".chordl-board-card-toolbar")).toBeTruthy();
    expect(document.body.querySelector(".chordl-board-action-size")).toBeNull();
  });

  it("offers them only for the card that is selected", () => {
    render(
      <ChordBoard items={[card("a"), card("b")]} selectedId="a" onResize={() => {}} />,
    );
    expect(sizeBtn("a", "lg")).toBeTruthy();
    expect(sizeBtn("b", "lg")).toBeFalsy();
  });

  it("marks the card's current size, defaulting to rg", () => {
    const items = [card("a"), card("b", "xl")];
    const { rerender } = render(
      <ChordBoard items={items} meta={{ columns: 4 }} selectedId="a" onResize={() => {}} />,
    );
    expect(sizeBtn("a", "rg").getAttribute("aria-pressed")).toBe("true");

    rerender(<ChordBoard items={items} meta={{ columns: 4 }} selectedId="b" onResize={() => {}} />);
    expect(sizeBtn("b", "xl").getAttribute("aria-pressed")).toBe("true");
    expect(sizeBtn("b", "rg").getAttribute("aria-pressed")).toBe("false");
  });

  it("reports the size the user picked", () => {
    const onResize = vi.fn();
    render(
      <ChordBoard items={[card("a")]} meta={{ columns: 4 }} selectedId="a" onResize={onResize} />,
    );
    fireEvent.click(sizeBtn("a", "lg"));
    expect(onResize).toHaveBeenCalledWith("a", "lg");
  });

  it("gives a bigger card more of the row", () => {
    const { container } = render(
      <ChordBoard items={[card("a", "rg"), card("b", "sm"), card("c", "xl")]} meta={{ columns: 4 }} onResize={() => {}} />,
    );
    const rg = spanOf(container, "a");
    expect(spanOf(container, "b")).toBe(rg / 2);
    expect(spanOf(container, "c")).toBe(rg * 2);
  });

  /**
   * A size that does not fit is shown greyed rather than hidden: which sizes
   * exist should not depend on where a card happens to sit.
   */
  it("greys out a size the row cannot hold", () => {
    // Three regular cards already fill three of four columns, so the fourth
    // card can be sm, md or rg — never lg, xl or 2xl.
    const items = [card("a"), card("b"), card("c"), card("d")];
    render(
      <ChordBoard items={items} meta={{ columns: 4 }} selectedId="d" onResize={() => {}} />,
    );

    for (const size of ["sm", "md", "rg"] as const) {
      expect(sizeBtn("d", size).disabled, size).toBe(false);
    }
    for (const size of ["lg", "xl", "2xl"] as const) {
      expect(sizeBtn("d", size).disabled, size).toBe(true);
    }
  });

  it("offers a size that exactly fills what the row has left", () => {
    render(
      <ChordBoard items={[card("a"), card("b", undefined, true)]} meta={{ columns: 4 }} selectedId="a" onResize={() => {}} />,
    );
    // One neighbour on a four-column row, so this card can take the other
    // three — 2xl exactly fills what is left.
    expect(sizeBtn("a", "xl").disabled).toBe(false);
    expect(sizeBtn("a", "2xl").disabled).toBe(false);
  });

  it("never disables the size a card already is", () => {
    // A board narrowed to 2 columns cannot hold a 2xl card, but one already
    // set to 2xl must still show which size it is.
    render(
      <ChordBoard items={[card("a", "2xl")]} meta={{ columns: 2 }} selectedId="a" onResize={() => {}} />,
    );
    expect(sizeBtn("a", "2xl").disabled).toBe(false);
    expect(sizeBtn("a", "2xl").getAttribute("aria-pressed")).toBe("true");
  });

  it("offers every size when the board has no column count", () => {
    // Without columns there is no row budget to overflow.
    render(
      <ChordBoard items={[card("a")]} selectedId="a" onResize={() => {}} />,
    );
    for (const size of BOARD_CARD_SIZES) {
      expect(sizeBtn("a", size).disabled, size).toBe(false);
    }
  });

  it("wraps a card that no longer fits onto the next row", () => {
    // 3 regular + 1 xl on a 4-column board: the xl cannot share, so it starts
    // its own row and is centred there.
    const items = [card("a"), card("b"), card("c"), card("d", "xl")];
    const { container } = render(<ChordBoard items={items} meta={{ columns: 4 }} onResize={() => {}} />);

    const placed = container
      .querySelector<HTMLElement>('[data-board-id="d"]')!
      .style.gridColumn;
    expect(placed).toContain("/");
  });
});
