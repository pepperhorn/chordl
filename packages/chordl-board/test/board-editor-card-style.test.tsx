import { useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { BoardEditor } from "../src/BoardEditor.js";
import { useChordBoard } from "../src/ChordBoard.js";
import { memoryStorageAdapter } from "../src/storage.js";
import type { BoardCardStyle } from "../src/cardStyle.js";
import type { BoardState } from "../src/types.js";

const initial: BoardState = {
  items: [{ id: "saved", nl: "C", display: "keyboard", title: "Original" }],
  meta: { title: "Lesson" },
};

const STYLE: BoardCardStyle = { theme: "crf", showNoteNames: true, noteNameSize: "xl" };

function Host({ onSave = () => {}, initialState = initial, cardStyle }: {
  onSave?: (state: BoardState) => void;
  initialState?: BoardState;
  cardStyle?: BoardCardStyle;
}) {
  const [draft, setDraft] = useState(initialState);
  const storage = useMemo(() => memoryStorageAdapter(initialState), [initialState]);
  const board = useChordBoard({
    initialItems: initialState.items,
    initialMeta: initialState.meta,
    storage,
    onChange(state) { onSave(state); setDraft(state); },
  });
  return <>
    <output data-testid="draft">{JSON.stringify(draft)}</output>
    <BoardEditor board={board} enableListening={false} cardStyle={cardStyle} />
  </>;
}

const control = (c: HTMLElement, label: string) => {
  const el = [...c.querySelectorAll<HTMLElement>(".control-item")]
    .find((item) => item.querySelector(".control-label")?.textContent === label);
  if (!el) throw new Error(`no control labelled ${label}`);
  return el;
};
const themePill = (c: HTMLElement) =>
  control(c, "Theme").querySelector('.pill-btn[data-active="true"]')?.textContent;
const namesToggle = (c: HTMLElement) =>
  control(c, "Note names").querySelector<HTMLButtonElement>(".annotation-toggle")!;
const namesSize = (c: HTMLElement) =>
  within(c).getByLabelText("Note names size") as HTMLSelectElement;
const chordBox = (c: HTMLElement) =>
  within(c).getByPlaceholderText(/tell me what chord/i) as HTMLInputElement;
const draft = (c: HTMLElement) => JSON.parse(within(c).getByTestId("draft").textContent!) as BoardState;

// Storage hydration is async and replaces items with the stored copy.
const mount = async (node: React.ReactElement) => {
  const view = render(node);
  await act(async () => { await Promise.resolve(); });
  return view;
};

const addChord = async (c: HTMLElement, chord: string) => {
  fireEvent.change(chordBox(c), { target: { value: chord } });
  await waitFor(() => expect(c.querySelector(".btn-add-to-board")).toBeTruthy());
  fireEvent.click(c.querySelector(".btn-add-to-board")!);
  await waitFor(() => expect(draft(c).items).toHaveLength(2));
};

describe("BoardEditor cardStyle", () => {
  it("starts the Theme pill and note names from cardStyle", async () => {
    const { container } = await mount(<Host cardStyle={STYLE} />);
    expect(themePill(container)).toBe("CRF");
    const toggle = namesToggle(container);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.disabled).toBe(true);
    expect(toggle.title).toBe("This board shows note names on every card");
    expect(namesSize(container).value).toBe("xl");
  });

  it("adds a card without baking the board's note names into its chord", async () => {
    const { container } = await mount(<Host cardStyle={STYLE} />);
    await addChord(container, "G");
    expect(draft(container).items[1].nl).toBe("G");
  });

  it("keeps a per-card note-name size the board does not use", async () => {
    const { container } = await mount(<Host cardStyle={STYLE} />);
    fireEvent.change(namesSize(container), { target: { value: "base" } });
    await addChord(container, "G");
    expect(draft(container).items[1].nl).toBe("G note names in base");
  });

  it("opening a card on a styled board leaves its chord text alone", async () => {
    const save = vi.fn();
    const { container } = await mount(<Host onSave={save} cardStyle={STYLE} />);
    fireEvent.click(container.querySelector('[data-board-id="saved"]')!);
    fireEvent.click(document.querySelector(".chordl-board-action-edit")!);
    await waitFor(() => expect(chordBox(container).value).toBe("C"));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    // Opening any card already saves once it backfills level and playback
    // notes (true without a style too), so the claim is about the chord text:
    // no save may write the board's names into it.
    for (const [state] of save.mock.calls as [BoardState][]) expect(state.items[0].nl).toBe("C");
    expect(draft(container).items[0].nl).toBe("C");
    expect(namesToggle(container).getAttribute("aria-pressed")).toBe("true");
  });

  it("board cards draw the style", async () => {
    const { container } = await mount(<Host cardStyle={STYLE} />);
    expect(container.querySelector('[data-board-id="saved"] .bc-note-name')).not.toBeNull();
    const fills = [...container.querySelectorAll('[data-board-id="saved"] rect')].map((r) => r.getAttribute("fill"));
    expect(fills).toContain("#f86e6e");
  });

  it("picks up a cardStyle that arrives after mount", async () => {
    const { container, rerender } = await mount(<Host />);
    rerender(<Host cardStyle={STYLE} />);
    expect(themePill(container)).toBe("CRF");
    expect(namesToggle(container).getAttribute("aria-pressed")).toBe("true");
  });

  it("a new cardStyle object with the same values leaves the form alone", async () => {
    const { container, rerender } = await mount(<Host cardStyle={STYLE} />);
    const boom = [...control(container, "Theme").querySelectorAll<HTMLButtonElement>(".pill-btn")]
      .find((b) => b.textContent === "Boom")!;
    fireEvent.click(boom);
    rerender(<Host cardStyle={{ ...STYLE }} />);
    expect(themePill(container)).toBe("Boom");
  });

  it("without cardStyle nothing changes", async () => {
    const { container } = await mount(<Host />);
    expect(themePill(container)).toBe("Simple");
    expect(namesToggle(container).getAttribute("aria-pressed")).toBe("false");
    expect(namesToggle(container).disabled).toBe(false);
  });

  describe("opening a card keeps its own note-name text", () => {
    const NAMES = { showNoteNames: true, noteNameSize: "xl" } as const;
    const withCard = (nl: string): BoardState => ({ items: [{ id: "saved", nl, display: "keyboard" }], meta: {} });
    const open = async (c: HTMLElement) => {
      fireEvent.click(c.querySelector('[data-board-id="saved"]')!);
      fireEvent.click(document.querySelector(".chordl-board-action-edit")!);
      await waitFor(() => expect(chordBox(c).value).toBe("C"));
      await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    };
    const lastNl = (save: ReturnType<typeof vi.fn>) => (save.mock.lastCall?.[0] as BoardState).items[0].nl;

    it("a card whose names match the board still saves them on open", async () => {
      const save = vi.fn();
      const state = withCard("C note names in xl");
      const { container } = await mount(<Host onSave={save} initialState={state} cardStyle={NAMES} />);
      await open(container);
      for (const [s] of save.mock.calls as [BoardState][]) expect(s.items[0].nl).toBe("C note names in xl");
      expect(draft(container).items[0].nl).toBe("C note names in xl");

      // Touching a note-name control hands the card back to the normal rule:
      // save only what differs from the board.
      fireEvent.change(namesSize(container), { target: { value: "lg" } });
      await waitFor(() => expect(lastNl(save)).toBe("C note names in lg"));
    });

    it("a plain card on the same board stays plain on open", async () => {
      const save = vi.fn();
      const { container } = await mount(<Host onSave={save} initialState={withCard("C")} cardStyle={NAMES} />);
      await open(container);
      for (const [s] of save.mock.calls as [BoardState][]) expect(s.items[0].nl).toBe("C");
      expect(draft(container).items[0].nl).toBe("C");
    });
  });

  it("re-seeds the note-name form from a style that changed mid-edit once editing ends", async () => {
    const { container, rerender } = await mount(<Host />);
    fireEvent.click(container.querySelector('[data-board-id="saved"]')!);
    fireEvent.click(document.querySelector(".chordl-board-action-edit")!);
    await waitFor(() => expect(chordBox(container).value).toBe("C"));
    rerender(<Host cardStyle={{ showNoteNames: true }} />);
    fireEvent.click(within(container).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(namesToggle(container).getAttribute("aria-pressed")).toBe("true"));
    expect(namesToggle(container).disabled).toBe(true);
  });
});
