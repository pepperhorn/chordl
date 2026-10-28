import { createRef, useMemo, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { BoardEditor } from "../src/BoardEditor.js";
import type { BoardEditorHandle } from "../src/BoardEditor.js";
import { useChordBoard } from "../src/ChordBoard.js";
import { memoryStorageAdapter } from "../src/storage.js";
import type { BoardState } from "../src/types.js";

const initial: BoardState = {
  items: [{ id: "saved", nl: "C", display: "keyboard", title: "Original" }],
  meta: { title: "Lesson" },
};

const REF = { source: "chords", id: "3f2a9c1e-7b4d-4e8a-9f00-1c2d3e4f5a6b" };

function Host({ onSave = () => {}, editorRef, initialState = initial }: {
  onSave?: (state: BoardState) => void;
  editorRef?: React.Ref<BoardEditorHandle>;
  initialState?: BoardState;
}) {
  const [draft, setDraft] = useState(initialState);
  const storage = useMemo(() => memoryStorageAdapter(initialState), [initialState]);
  const board = useChordBoard({
    initialItems: initialState.items,
    initialMeta: initialState.meta,
    storage,
    // Deliberately inline: updating the parent's draft must not cause a
    // notify/render loop or save again merely because this identity changed.
    onChange(state) { onSave(state); setDraft(state); },
  });
  return <>
    <output data-testid="draft">{JSON.stringify(draft)}</output>
    <BoardEditor ref={editorRef} board={board} enableListening={false} />
  </>;
}

const chordBox = (container: HTMLElement) =>
  within(container).getByPlaceholderText(/tell me what chord/i) as HTMLInputElement;

describe("BoardEditor embedded in a message draft", () => {
  it("loads the host's board, saves edits back once, and leaves playground storage alone", async () => {
    localStorage.setItem("chordl-board", JSON.stringify({ items: [{ id: "other", nl: "F" }] }));
    const untouched = localStorage.getItem("chordl-board");
    const save = vi.fn();
    const { container } = render(<Host onSave={save} />);
    expect(container.querySelectorAll("[data-board-id]")).toHaveLength(1);

    fireEvent.change(chordBox(container), { target: { value: "G" } });
    await waitFor(() => expect(container.querySelector(".btn-add-to-board")).toBeTruthy());
    fireEvent.click(container.querySelector(".btn-add-to-board")!);

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const draft = JSON.parse(within(container).getByTestId("draft").textContent!);
    expect(draft.meta.title).toBe("Lesson");
    expect(draft.items).toHaveLength(2);
    expect(draft.items[1].nl).toBe("G");
    expect(localStorage.getItem("chordl-board")).toBe(untouched);
    expect(container.querySelector(".listen-mic-btn")).toBeNull();
    expect(container.querySelector(".btn-follow-along")).toBeNull();
  });

  it("opens a catalogue chord without overwriting the card being edited", async () => {
    const ref = createRef<BoardEditorHandle>();
    const save = vi.fn();
    const { container } = render(<Host onSave={save} editorRef={ref} />);
    fireEvent.click(container.querySelector("[data-board-id]")!);
    fireEvent.click(document.querySelector(".chordl-board-action-edit")!);
    await waitFor(() => expect(chordBox(container).value).toBe("C"));

    act(() => ref.current!.setChord("Dm7"));
    expect(chordBox(container).value).toBe("Dm7");
    fireEvent.click(container.querySelector(".btn-add-to-board")!);

    await waitFor(() => {
      const state = save.mock.lastCall?.[0] as BoardState;
      expect(state.items).toHaveLength(2);
      expect(state.items[0].nl).toBe("C");
      expect(state.items[0].title).toBe("Original");
      expect(state.items[1].nl).toBe("Dm7");
      expect(state.items[1].title).toBeUndefined();
    });
  });

  it("does not submit a surrounding message form when its controls are clicked", () => {
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { container } = render(<form onSubmit={submit}><Host /></form>);
    fireEvent.change(chordBox(container), { target: { value: "G" } });
    fireEvent.click(container.querySelector(".btn-add-to-board")!);
    expect(submit).not.toHaveBeenCalled();
    expect(container.querySelectorAll('button:not([type="button"])')).toHaveLength(0);
  });

  it("keeps p shortcuts and labelled controls local when two boards share a page", async () => {
    const { container } = render(<><Host /><Host /><button>Host action</button></>);
    const editors = [...container.querySelectorAll<HTMLElement>(".chordl-board-editor")];
    const sliders = editors.map((editor) => within(editor).getByLabelText("Arpeggio speed"));
    expect(sliders[0].id).not.toBe(sliders[1].id);

    fireEvent.keyDown(within(container).getByRole("button", { name: "Host action" }), { key: "p" });
    expect(container.querySelector(".board-player")).toBeNull();

    fireEvent.keyDown(editors[0], { key: "p" });
    await waitFor(() => expect(editors[0].querySelector(".board-player")).toBeTruthy());
    expect(editors[1].querySelector(".board-player")).toBeNull();
  });

  describe("host ref", () => {
    const last = (save: ReturnType<typeof vi.fn>) => (save.mock.lastCall?.[0] as BoardState).items;
    // Storage hydration is async and replaces items with the stored copy; act
    // before it settles and the board snaps back, dropping what was just added.
    const mount = async (node: React.ReactElement) => {
      const view = render(node);
      await act(async () => { await Promise.resolve(); });
      return view;
    };
    const add = (container: HTMLElement) => fireEvent.click(container.querySelector(".btn-add-to-board")!);
    const openFirst = async (container: HTMLElement) => {
      fireEvent.click(container.querySelector("[data-board-id]")!);
      fireEvent.click(document.querySelector(".chordl-board-action-edit")!);
      await waitFor(() => expect(chordBox(container).value).not.toBe(""));
    };
    const seeded: BoardState = {
      items: [{ id: "saved", nl: "C", display: "keyboard", ref: REF }],
      meta: {},
    };

    it("attaches a host ref to the next added card only", async () => {
      const ref = createRef<BoardEditorHandle>();
      const save = vi.fn();
      const { container } = await mount(<Host onSave={save} editorRef={ref} />);
      act(() => ref.current!.setChord("Dm7", { ref: REF }));
      add(container);
      await waitFor(() => expect(last(save)).toHaveLength(2));
      expect(last(save)[1].nl).toBe("Dm7");
      expect(last(save)[1].ref).toEqual(REF);
      expect(chordBox(container).value).toBe("Dm7");
      add(container);

      await waitFor(() => expect(last(save)).toHaveLength(3));
      expect(last(save)[2].ref).toBeUndefined();
    });

    it("drops the ref when the chord box is edited before adding", async () => {
      const ref = createRef<BoardEditorHandle>();
      const save = vi.fn();
      const { container } = await mount(<Host onSave={save} editorRef={ref} />);
      act(() => ref.current!.setChord("Dm7", { ref: REF }));
      fireEvent.change(chordBox(container), { target: { value: "Dm9" } });
      add(container);
      await waitFor(() => expect(last(save)).toHaveLength(2));
      expect(last(save)[1].nl).toBe("Dm9");
      expect(last(save)[1].ref).toBeUndefined();
    });

    it("drops a pending ref when setChord is called again without one", async () => {
      const ref = createRef<BoardEditorHandle>();
      const save = vi.fn();
      const { container } = await mount(<Host onSave={save} editorRef={ref} />);
      act(() => ref.current!.setChord("Dm7", { ref: REF }));
      act(() => ref.current!.setChord("G7"));
      add(container);
      await waitFor(() => expect(last(save)).toHaveLength(2));
      expect(last(save)[1].ref).toBeUndefined();
    });

    it("attaches the ref to the new card, not the card that was being edited", async () => {
      const ref = createRef<BoardEditorHandle>();
      const save = vi.fn();
      const { container } = await mount(<Host onSave={save} editorRef={ref} />);
      await openFirst(container);
      act(() => ref.current!.setChord("Dm7", { ref: REF }));
      add(container);
      await waitFor(() => expect(last(save)).toHaveLength(2));
      expect(last(save)[0].ref).toBeUndefined();
      expect(last(save)[0].title).toBe("Original");
      expect(last(save)[1].ref).toEqual(REF);
    });

    it("keeps a card's ref while it is open for editing and only annotations change", async () => {
      const save = vi.fn();
      const { container } = await mount(<Host onSave={save} initialState={seeded} />);
      await openFirst(container);
      fireEvent.click(within(container).getByText("Note names").parentElement!.querySelector("button")!);
      await waitFor(() => expect(last(save)[0].nl).not.toBe("C"));
      expect(last(save)[0].ref).toEqual(REF);
    });

    it("clears a card's ref when its chord text is retyped", async () => {
      const save = vi.fn();
      const { container } = await mount(<Host onSave={save} initialState={seeded} />);
      await openFirst(container);
      fireEvent.change(chordBox(container), { target: { value: "Am" } });
      await waitFor(() => expect(last(save)[0].nl).toBe("Am"));
      expect(last(save)[0].ref).toBeUndefined();
    });
  });
});
