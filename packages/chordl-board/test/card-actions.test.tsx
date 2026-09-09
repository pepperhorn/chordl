import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ChordBoard } from "../src";
import type { BoardItem } from "../src";

const items: BoardItem[] = [{ id: "a", nl: "C" }, { id: "b", nl: "Am" }];

/*
 * The toolbar portals to <body>, so it is a sibling of Testing Library's
 * container rather than inside it — any `transform` on an ancestor (the host
 * app's fade-in wrapper has one) captures `position: fixed`, so it cannot stay
 * in the board's own tree. Queries for it go through the document.
 */
const actionsRow = () =>
  document.body.querySelector<HTMLElement>(".chordl-board-actions")!;

const labels = () =>
  Array.from(actionsRow().querySelectorAll("button")).map((b) => b.textContent);

/**
 * These controls used to sit inside the card, revealed on hover or selection.
 * Eleven of them do not fit across a card: the wrapping row that kept them
 * inside the border turned the overflow into height instead, and at four
 * columns it was 191px of a 287px `sm` card. They live in one floating toolbar
 * now, which exists only while a card is selected — so getting at a card's
 * controls is select first, then act.
 */
describe("card action row", () => {
  it("leaves the card itself with nothing but its diagram", () => {
    const { container } = render(<ChordBoard items={items} selectedId="a" onResize={() => {}} />);
    const card = container.querySelector('[data-board-id="a"]')!;
    expect(card.querySelector(".chordl-board-actions")).toBeNull();
    expect(card.querySelectorAll("button")).toHaveLength(0);
  });

  it("fits every control on one row rather than wrapping into height", () => {
    const { container } = render(<ChordBoard items={items} selectedId="a" onResize={() => {}} />);
    expect(actionsRow(container).style.flexWrap).toBe("nowrap");
  });

  it("has no controls at all until a card is selected", () => {
    const { container } = render(<ChordBoard items={items} onResize={() => {}} />);
    expect(document.body.querySelector(".chordl-board-actions")).toBeNull();
  });

  /**
   * "copy" only filled a clipboard the user then had to paste; "repeat" did the
   * same job in one click. One control named for what it does replaces both.
   */
  it("offers duplicate in place of copy and repeat", () => {
    const { container } = render(
      <ChordBoard items={items} selectedId="a" onDuplicate={() => {}} />,
    );
    expect(labels()).toEqual(["edit", "duplicate", "cut", "break", "delete"]);
  });

  it("duplicates the card the control belongs to", () => {
    const onDuplicate = vi.fn();
    const { container, rerender } = render(
      <ChordBoard items={items} selectedId="a" onDuplicate={onDuplicate} />,
    );
    fireEvent.click(document.body.querySelector(".chordl-board-action-duplicate")!);
    expect(onDuplicate).toHaveBeenCalledWith("a");

    // The toolbar is shared now, so "the card it belongs to" is a live binding
    // rather than a card that owns its own copy of the button.
    rerender(<ChordBoard items={items} selectedId="b" onDuplicate={onDuplicate} />);
    fireEvent.click(document.body.querySelector(".chordl-board-action-duplicate")!);
    expect(onDuplicate).toHaveBeenLastCalledWith("b");
  });
});

/**
 * A selection is how the app says "your edits land here". Getting into one is a
 * click; getting out of one used to need the strip of board background around
 * the grid, which a full board barely has.
 */
describe("deselecting a card", () => {
  it("selects an unselected card", () => {
    const onSelect = vi.fn();
    const { container } = render(<ChordBoard items={items} onSelect={onSelect} />);
    fireEvent.click(container.querySelector('[data-board-id="b"]')!);
    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("deselects when the selected card is clicked again", () => {
    const onSelect = vi.fn();
    const { container } = render(<ChordBoard items={items} selectedId="b" onSelect={onSelect} />);
    fireEvent.click(container.querySelector('[data-board-id="b"]')!);
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("still moves the selection to a different card", () => {
    const onSelect = vi.fn();
    const { container } = render(<ChordBoard items={items} selectedId="b" onSelect={onSelect} />);
    fireEvent.click(container.querySelector('[data-board-id="a"]')!);
    expect(onSelect).toHaveBeenCalledWith("a");
  });

  it("clears the selection on Escape", () => {
    const onClearSelection = vi.fn();
    render(<ChordBoard items={items} selectedId="b" onClearSelection={onClearSelection} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  /**
   * A card can be open for editing without being selected, and the host wires
   * "leave edit mode" into the same handler. Ignoring Escape there left the
   * keyboard no way out of an edit.
   */
  it("clears on Escape while a card is being edited, selected or not", () => {
    const onClearSelection = vi.fn();
    render(<ChordBoard items={items} editingId="b" onClearSelection={onClearSelection} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("leaves Escape alone when nothing is selected or being edited", () => {
    const onClearSelection = vi.fn();
    render(<ChordBoard items={items} onClearSelection={onClearSelection} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it("gives Escape to the new-board overlay while it is open", () => {
    const onClearSelection = vi.fn();
    const { container } = render(
      <ChordBoard items={items} selectedId="b" onNew={() => {}} onClearSelection={onClearSelection} />,
    );
    fireEvent.click(container.querySelector(".chordl-board-new")!);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClearSelection).not.toHaveBeenCalled();
  });

  it("keeps a click on the action row off the card's own handler", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ChordBoard items={items} selectedId="a" onSelect={onSelect} onDelete={() => {}} />,
    );
    fireEvent.click(document.body.querySelector(".chordl-board-action-delete")!);
    expect(onSelect).not.toHaveBeenCalled();
  });

  /**
   * The toolbar sits outside the export root, whose click handler is what
   * clears a selection for clicks that miss a card. Acting on the selected card
   * must not be read as a click away from it.
   */
  it("keeps a click on the action row from clearing the selection", () => {
    const onClearSelection = vi.fn();
    const { container } = render(
      <ChordBoard items={items} selectedId="a" onClearSelection={onClearSelection} onDelete={() => {}} />,
    );
    fireEvent.click(document.body.querySelector(".chordl-board-action-delete")!);
    expect(onClearSelection).not.toHaveBeenCalled();
  });
});
