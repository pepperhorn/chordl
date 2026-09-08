import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { ChordBoard } from "../src";
import type { BoardItem } from "../src";
import { MAX_COLUMNS } from "../src/types.js";

const items: BoardItem[] = [
  { id: "a", nl: "C" },
  { id: "b", nl: "Am" },
];

const meta = { title: "Practice sheet" };

const openOverlay = (container: HTMLElement) => {
  const btn = container.querySelector(".chordl-board-new") as HTMLButtonElement;
  fireEvent.click(btn);
  return document.querySelector(".chordl-board-new-overlay") as HTMLElement;
};

beforeEach(() => {
  // The JSON path builds a Blob URL and clicks an anchor; jsdom has neither.
  URL.createObjectURL = vi.fn(() => "blob:new-board");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

/**
 * Clearing a board is destructive and unrecoverable — there is no undo and the
 * only copy lives in localStorage. So the button never clears on its own: it
 * opens an overlay whose default focus is Cancel, and the only paths out are
 * explicit.
 */
describe("New board", () => {
  it("edits board text in place, above the toolbar", () => {
    const { container } = render(<ChordBoard items={items} onNew={() => {}} />);
    const controls = container.querySelector(".chordl-board-controls")!;
    const settings = controls.querySelector(".chordl-board-settings")!;
    const toolbar = controls.querySelector(".chordl-board-toolbar")!;
    const inputs = settings.querySelectorAll<HTMLInputElement>(".chordl-board-inline-input");

    expect(settings.closest("details")).toBeNull();
    expect(settings.nextElementSibling).toBe(toolbar);

    // Three fields, no fourth: "per row" changes layout, not wording, so it
    // moved to the toolbar.
    expect(inputs).toHaveLength(3);

    // The label is a visible sibling, not the placeholder: a placeholder
    // vanishes as soon as there is text, and a filled-in field then stopped
    // saying what it was for.
    const labels = settings.querySelectorAll(".chordl-board-inline-label");
    expect([...labels].map((l) => l.textContent)).toEqual([
      "Board title:",
      "Subtitle:",
      "Footer text:",
    ]);

    // Wrapping <label> gives each input its accessible name, so no field
    // relies on a placeholder for one.
    for (const input of inputs) {
      expect(input.closest("label.chordl-board-inline-field")).toBeTruthy();
      expect(input.placeholder).toBe("");
    }
    expect(settings.querySelectorAll(".chordl-board-inline-separator")).toHaveLength(2);
  });

  it("puts the per-row control in the toolbar, after Import", () => {
    const { container } = render(<ChordBoard items={items} onNew={() => {}} />);
    const primary = container.querySelector(".chordl-board-toolbar-primary")!;
    const importLabel = primary.querySelector(".chordl-board-import")!;
    const columns = primary.querySelector(".chordl-board-columns")!;

    expect(columns).toBeTruthy();
    // Import sits before it in document order; the hidden file input is the
    // only thing allowed between them.
    expect(
      importLabel.compareDocumentPosition(columns) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // auto, plus one per allowed count.
    expect(columns.querySelectorAll(".chordl-board-columns-option")).toHaveLength(MAX_COLUMNS + 1);
    expect(container.querySelector(".chordl-board-settings-grid")).toBeNull();
  });

  it("separates board actions from the labelled export options", () => {
    const { container } = render(
      <ChordBoard items={items} onNew={() => {}} onAddTextCard={() => {}} />,
    );
    const primary = container.querySelector(".chordl-board-toolbar-primary")!;
    const exports = container.querySelector(".chordl-board-toolbar-export")!;

    expect(primary.querySelector(".chordl-board-new")).toBeTruthy();
    expect(primary.querySelector(".chordl-board-add-text")).toBeTruthy();
    expect(primary.querySelector("label.chordl-board-import")?.textContent).toBe("Import");
    expect(exports.querySelector(".chordl-board-export-label")?.textContent).toBe("Export:");
    expect(exports.querySelectorAll("button")).toHaveLength(3);
  });

  it("offers the button in the toolbar beside the export controls", () => {
    const { container } = render(<ChordBoard items={items} onNew={() => {}} />);
    const btn = container.querySelector(".chordl-board-new");
    expect(btn).toBeTruthy();
    expect(btn!.closest(".chordl-board-toolbar")).toBeTruthy();
  });

  it("disables the button when the board is already empty", () => {
    const { container } = render(<ChordBoard items={[]} onNew={() => {}} />);
    const btn = container.querySelector(".chordl-board-new") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("names the board settings rather than a title it does not have", () => {
    // A column count is a setting, not content the user wrote. Saying "title"
    // for a board with none promises something the clear cannot deliver.
    const { container } = render(
      <ChordBoard items={items} meta={{ columns: 4 }} onNew={() => {}} />,
    );
    const overlay = openOverlay(container);
    expect(overlay.textContent).toContain("2 cards and the board settings");
    expect(overlay.textContent).not.toContain("board title");
  });

  it("enables the button when a board title is the only thing to clear", () => {
    // Meta is part of the board: a titled but cardless board is not blank.
    const { container } = render(<ChordBoard items={[]} meta={meta} onNew={() => {}} />);
    const btn = container.querySelector(".chordl-board-new") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("omits the button entirely when the host wires no handler", () => {
    const { container } = render(<ChordBoard items={items} />);
    expect(container.querySelector(".chordl-board-new")).toBeNull();
  });

  it("counts the live cards in the warning, so the message never lies", () => {
    const { container } = render(<ChordBoard items={items} meta={meta} onNew={() => {}} />);
    const overlay = openOverlay(container);
    expect(overlay.textContent).toContain("2 cards");
    expect(overlay.textContent).toContain("board title");
  });

  it("gives Cancel default focus, so a stray Enter never wipes a board", () => {
    const { container } = render(<ChordBoard items={items} onNew={() => {}} />);
    openOverlay(container);
    expect(document.activeElement).toBe(
      document.querySelector(".chordl-board-new-cancel"),
    );
  });

  it("clears without saving when that button is chosen", () => {
    const onNew = vi.fn();
    const { container } = render(<ChordBoard items={items} meta={meta} onNew={onNew} />);
    const overlay = openOverlay(container);
    fireEvent.click(overlay.querySelector(".chordl-board-new-clear")!);
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".chordl-board-new-overlay")).toBeNull();
  });

  it("downloads the board as JSON before clearing when asked to", async () => {
    const onNew = vi.fn();
    const { container } = render(<ChordBoard items={items} meta={meta} onNew={onNew} />);
    const overlay = openOverlay(container);
    fireEvent.click(overlay.querySelector(".chordl-board-new-save")!);
    await waitFor(() => expect(onNew).toHaveBeenCalledTimes(1));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("leaves the board untouched on Cancel", () => {
    const onNew = vi.fn();
    const { container } = render(<ChordBoard items={items} onNew={onNew} />);
    const overlay = openOverlay(container);
    fireEvent.click(overlay.querySelector(".chordl-board-new-cancel")!);
    expect(onNew).not.toHaveBeenCalled();
    expect(document.querySelector(".chordl-board-new-overlay")).toBeNull();
  });

  it("cancels on Escape and on a backdrop click", () => {
    const onNew = vi.fn();
    const { container } = render(<ChordBoard items={items} onNew={onNew} />);

    const overlay = openOverlay(container);
    fireEvent.keyDown(overlay, { key: "Escape" });
    expect(document.querySelector(".chordl-board-new-overlay")).toBeNull();

    const reopened = openOverlay(container);
    fireEvent.click(reopened);
    expect(document.querySelector(".chordl-board-new-overlay")).toBeNull();
    expect(onNew).not.toHaveBeenCalled();
  });

  it("says one card, not 1 cards", () => {
    const { container } = render(<ChordBoard items={[items[0]]} onNew={() => {}} />);
    const overlay = openOverlay(container);
    expect(overlay.textContent).toContain("1 card");
    expect(overlay.textContent).not.toContain("1 cards");
  });
});

describe("New board — when the download fails", () => {
  it("keeps the board and the overlay", async () => {
    // The point of this path is that the board leaves with a copy of itself.
    URL.createObjectURL = vi.fn(() => { throw new Error("no blob urls here"); });
    const onNew = vi.fn();
    const { container } = render(<ChordBoard items={items} meta={meta} onNew={onNew} />);
    const overlay = openOverlay(container);
    fireEvent.click(overlay.querySelector(".chordl-board-new-save")!);

    await new Promise((r) => setTimeout(r, 0));
    expect(onNew).not.toHaveBeenCalled();
    expect(document.querySelector(".chordl-board-new-overlay")).toBeTruthy();
  });
});

describe("Board text fields without an onMetaChange handler", () => {
  it("presents them read-only rather than pretending to accept typing", () => {
    const { container } = render(<ChordBoard items={items} meta={meta} onNew={() => {}} />);
    const inputs = container.querySelectorAll<HTMLInputElement>(".chordl-board-inline-input");
    expect(inputs).toHaveLength(3);
    for (const input of inputs) expect(input.readOnly).toBe(true);
    // The value is still shown — this is the only place the board's own text
    // appears in the controls.
    expect(inputs[0].value).toBe("Practice sheet");
    // Per row is driven by the same no-op patch, so it is disabled too.
    for (const btn of container.querySelectorAll<HTMLButtonElement>(".chordl-board-columns-option")) {
      expect(btn.disabled).toBe(true);
    }
  });

  it("is writable again as soon as a handler is supplied", () => {
    const onMetaChange = vi.fn();
    const { container } = render(
      <ChordBoard items={items} meta={meta} onNew={() => {}} onMetaChange={onMetaChange} />,
    );
    const inputs = container.querySelectorAll<HTMLInputElement>(".chordl-board-inline-input");
    for (const input of inputs) expect(input.readOnly).toBe(false);
    fireEvent.change(inputs[0], { target: { value: "Set list" } });
    expect(onMetaChange).toHaveBeenCalledWith({ title: "Set list" });

    const perRow = container.querySelector<HTMLButtonElement>(".chordl-board-columns-option")!;
    expect(perRow.disabled).toBe(false);
  });
});

describe("Import control", () => {
  it("is a single tab stop that announces as a button", () => {
    const { container } = render(<ChordBoard items={items} onNew={() => {}} />);
    const label = container.querySelector<HTMLLabelElement>("label.chordl-board-import")!;
    const input = container.querySelector<HTMLInputElement>(".chordl-board-import-input")!;

    expect(label.getAttribute("role")).toBe("button");
    expect(label.tabIndex).toBe(0);
    // The input is only visually hidden, so without this it keeps its own tab
    // stop right beside the label — two stops for one action.
    expect(input.tabIndex).toBe(-1);
    // The label still drives it.
    expect(label.htmlFor).toBe(input.id);
  });
});
