import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { BoardEditor, type BoardEditorHandle } from "../src/BoardEditor.js";
import { useChordBoard } from "../src/ChordBoard.js";
import { memoryStorageAdapter } from "../src/storage.js";
import type { BoardState, StorageAdapter } from "../src/types.js";

// Render the real editor and real instrument panel: a stub would not prove
// that the controlled instrument actually reaches its selected button/frame.
function Host({ storage, editorRef }: { storage: StorageAdapter; editorRef: React.RefObject<BoardEditorHandle | null> }) {
  const board = useChordBoard({ storage });
  return <BoardEditor ref={editorRef} board={board} enableListening={false} />;
}

async function mount(initialState: BoardState = { items: [], meta: {} }) {
  const memory = memoryStorageAdapter(initialState);
  const saves: BoardState[] = [];
  const storage: StorageAdapter = {
    load: memory.load,
    save: (state) => { saves.push(state); return memory.save(state); },
  };
  const editorRef = createRef<BoardEditorHandle>();
  const view = render(<Host storage={storage} editorRef={editorRef} />);
  await act(async () => { await Promise.resolve(); });
  const enter = (value: string) => fireEvent.change(
    within(view.container).getByPlaceholderText(/tell me what chord/i), { target: { value } },
  );
  const selectedInstrument = () => view.container.querySelector('.bc-guitar-instrument-btn[data-active="true"]')?.textContent;
  const display = () => view.container.querySelector('.btn-display-toggle')?.textContent;
  const level = (name: string) => within(view.container).getByRole('radio', { name }) as HTMLInputElement;
  return { ...view, enter, selectedInstrument, display, level, storage, saves, editorRef };
}

describe("BoardEditor instrument and level input words", () => {
  it("switches to the real ukulele controls and Beginner, then back to piano", async () => {
    const { enter, selectedInstrument, display, level, container } = await mount();
    enter("ukulele am beginner");
    await waitFor(() => expect(selectedInstrument()).toBe("Ukulele"));
    expect(display()).toContain("Guitar");
    expect(level("Beginner").checked).toBe(true);
    await waitFor(() => expect(container.querySelector('.bc-guitar-chord__canvas svg')).not.toBeNull());
    enter("piano C");
    await waitFor(() => expect(display()).toContain("Diagram"));
    expect(selectedInstrument()).toBeUndefined();
    expect(level("Beginner").checked).toBe(true);
  });

  it("leaves manual choices alone while parsed words stay the same or disappear", async () => {
    const { enter, selectedInstrument, display, level, container } = await mount();
    enter("uke Am beginner");
    await waitFor(() => expect(selectedInstrument()).toBe("Ukulele"));
    fireEvent.click(level("Established"));
    fireEvent.click(within(container.querySelector('.bc-guitar-instrument-toggle') as HTMLElement).getByRole("button", { name: "Guitar", exact: true }));
    enter("uke Dm beginner");
    expect(level("Established").checked).toBe(true);
    expect(selectedInstrument()).toBe("Guitar");
    // A new instrument request must not reapply the unchanged level word.
    enter("guitar Dm beginner");
    await waitFor(() => expect(selectedInstrument()).toBe("Guitar"));
    expect(level("Established").checked).toBe(true);
    // A new level request must not reapply an unchanged instrument word.
    fireEvent.click(container.querySelector('.btn-display-toggle')!); // guitar -> keyboard
    enter("guitar Dm emerging");
    expect(display()).toContain("Diagram");
    expect(level("Emerging").checked).toBe(true);
    enter("G7");
    expect(display()).toContain("Diagram");
    expect(level("Emerging").checked).toBe(true);
    enter("uke G7");
    await waitFor(() => expect(selectedInstrument()).toBe("Ukulele"));
    enter("Am");
    expect(display()).toContain("Guitar");
    expect(selectedInstrument()).toBe("Ukulele");
    expect(level("Emerging").checked).toBe(true);
  // This integration case redraws several real SVG frames; under the full
  // parallel suite it measured 7.4s, exceeding Vitest's default 5s budget.
  }, 15_000);

  it.each(["guitar", "keyboard"] as const)("opening a saved %s card preserves stored controls and values", async (savedDisplay) => {
    const item = { id: "saved", nl: "uke Am beginner", display: savedDisplay,
      instrument: savedDisplay === "guitar" ? "guitar" : undefined, level: "established" } as const;
    const { container, selectedInstrument, display, level, storage, saves, enter } = await mount({ items: [item], meta: {} });
    fireEvent.click(container.querySelector('[data-board-id="saved"]')!);
    fireEvent.click(document.querySelector('.chordl-board-action-edit')!);
    await waitFor(() => {
      expect(display()).toContain(savedDisplay === "guitar" ? "Guitar" : "Diagram");
      expect(level("Established").checked).toBe(true);
      if (savedDisplay === "guitar") expect(selectedInstrument()).toBe("Guitar");
    });
    // Flush the panel playback report and the live edit/storage mirror, then
    // assert every saved version as well as the actual adapter's readback.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
    const unchanged = { nl: item.nl, display: item.display, instrument: item.instrument, level: item.level };
    for (const state of saves) expect(state.items[0]).toMatchObject(unchanged);
    expect((await storage.load())?.items[0]).toMatchObject(unchanged);
    enter("uke Dm beginner");
    expect(level("Established").checked).toBe(true);
    expect(display()).toContain(savedDisplay === "guitar" ? "Guitar" : "Diagram");
    enter("piano Dm easy");
    expect(display()).toContain("Diagram");
    // The alias still parses to beginner: its value hasn't changed yet.
    expect(level("Established").checked).toBe(true);
    enter("piano Dm emerging");
    expect(level("Emerging").checked).toBe(true);
  });

  it("host setChord does not apply instrument or level words", async () => {
    const { editorRef, display, level } = await mount();
    act(() => editorRef.current!.setChord("uke Am beginner"));
    expect(display()).toContain("Diagram");
    expect(level("Emerging").checked).toBe(true);
  });

  it("applies a level-only request without switching the display", async () => {
    const { enter, display, level } = await mount();
    enter("advanced Am");
    expect(level("Established").checked).toBe(true);
    expect(display()).toContain("Diagram");
  });
});
