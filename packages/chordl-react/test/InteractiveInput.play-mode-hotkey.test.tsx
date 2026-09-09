import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { InteractiveInput } from "../dev/App";

/**
 * Entering play mode with `p`.
 *
 * The spec has play mode "entered with `p` on a keyboard or a button on
 * touch". `BoardPlayer` owns a `p` handler, but it only exists while play mode
 * is already on — so the key could only ever *leave*. Entering decides which
 * component renders, which is the host's job, so the listener that turns play
 * mode on lives here in the dev app.
 *
 * The interesting half of these tests is the three ways it must stay quiet: a
 * bare letter key bound on the document sits on top of every text field on the
 * page, and a mode that flips while someone types "phrygian" into the chord
 * box is a worse bug than the one being fixed.
 */

const BOARD_KEY = "chordl-board";

/** A board with one chord card — the condition that shows the Play button. */
const seedBoard = () => {
  localStorage.setItem(BOARD_KEY, JSON.stringify({
    items: [{ id: "a", kind: "chord", nl: "C", display: "keyboard" }],
    meta: {},
  }));
};

const renderApp = () =>
  render(<InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />);

const playButton = () => document.querySelector<HTMLButtonElement>("button.btn-board-play");
const player = () => document.querySelector(".board-player");
const chordBox = (c: HTMLElement) =>
  c.querySelector<HTMLInputElement>("input[placeholder*='chord' i]")!;

/** The Play button only exists once the board has hydrated from storage. */
const waitForBoard = async () => {
  await waitFor(() => expect(playButton()).toBeTruthy());
};

describe("dev app — p enters play mode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("enters play mode on a bare p while the editing board is shown", async () => {
    seedBoard();
    renderApp();
    await waitForBoard();
    expect(player()).toBeNull();

    fireEvent.keyDown(document, { key: "p" });

    await waitFor(() => expect(player()).toBeTruthy());
  });

  it("ignores p typed into the chord input", async () => {
    seedBoard();
    const { container } = renderApp();
    await waitForBoard();

    const box = chordBox(container);
    box.focus();
    fireEvent.keyDown(box, { key: "p", bubbles: true });

    await waitFor(() => expect(playButton()).toBeTruthy());
    expect(player()).toBeNull();
  });

  it("ignores p with a modifier held", async () => {
    seedBoard();
    renderApp();
    await waitForBoard();

    fireEvent.keyDown(document, { key: "p", ctrlKey: true });
    fireEvent.keyDown(document, { key: "p", metaKey: true });
    fireEvent.keyDown(document, { key: "p", altKey: true });

    await waitFor(() => expect(playButton()).toBeTruthy());
    expect(player()).toBeNull();
  });

  it("does nothing on an empty board, where there is no Play button", async () => {
    renderApp();
    await waitFor(() => expect(chordBox(document.body as HTMLElement)).toBeTruthy());
    expect(playButton()).toBeNull();

    fireEvent.keyDown(document, { key: "p" });

    expect(player()).toBeNull();
  });

  /**
   * The overlays render *over* the board, so a `p` typed while one is up is
   * not aimed at the board at all. Entering play mode behind a modal swaps the
   * component underneath it, and `BoardPlayer`'s focus effect then pulls focus
   * straight out of the open dialog — the user is left typing into a board
   * they cannot see. The chord box is already excluded by tag name; a dialog
   * is excluded by there being a dialog.
   */
  it("ignores p while the Listen overlay is open", async () => {
    seedBoard();
    renderApp();
    await waitForBoard();

    fireEvent.click(document.querySelector<HTMLButtonElement>(".listen-mic-btn")!);
    await waitFor(() => expect(document.querySelector("[role='dialog']")).toBeTruthy());

    fireEvent.keyDown(document, { key: "p" });

    expect(player()).toBeNull();
  });

  it("ignores p while the Follow along overlay is open", async () => {
    // Two cards: the Follow along button only appears from two up.
    localStorage.setItem(BOARD_KEY, JSON.stringify({
      items: [
        { id: "a", kind: "chord", nl: "C", display: "keyboard" },
        { id: "b", kind: "chord", nl: "G", display: "keyboard" },
      ],
      meta: {},
    }));
    renderApp();
    await waitForBoard();

    fireEvent.click(document.querySelector<HTMLButtonElement>(".btn-follow-along")!);
    await waitFor(() => expect(document.querySelector("[role='dialog']")).toBeTruthy());

    fireEvent.keyDown(document, { key: "p" });

    expect(player()).toBeNull();
  });

  /**
   * A text card's editor is a panel of text fields, but the `p` guard only
   * stands down for the field that has focus — a click on the card's icon
   * picker, or anywhere in the panel that is not an input, leaves the key live
   * over a form the user is plainly in the middle of.
   */
  it("ignores p while a text card is being edited", async () => {
    seedBoard();
    renderApp();
    await waitForBoard();

    fireEvent.click(document.querySelector<HTMLButtonElement>(".chordl-board-add-text")!);
    // The text-card editor has taken over the panel — "+ Add to board" only
    // renders for a chord card, so its absence is the mode having changed.
    await waitFor(() => expect(document.querySelector(".btn-add-to-board")).toBeNull());

    fireEvent.keyDown(document, { key: "p" });

    expect(player()).toBeNull();
  });

  it("removes the listener on unmount", async () => {
    seedBoard();
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderApp();
    await waitForBoard();

    const added = add.mock.calls.filter(([type]) => type === "keydown").map(([, fn]) => fn);
    expect(added.length).toBeGreaterThan(0);

    unmount();

    const removed = remove.mock.calls.filter(([type]) => type === "keydown").map(([, fn]) => fn);
    for (const fn of added) expect(removed).toContain(fn);

    add.mockRestore();
    remove.mockRestore();

    fireEvent.keyDown(document, { key: "p" });
    expect(player()).toBeNull();
  });
});
