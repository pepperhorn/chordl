import { useMemo } from "react";
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, waitFor, within } from "@testing-library/react";
import { BoardEditor } from "../src/BoardEditor.js";
import { useChordBoard } from "../src/ChordBoard.js";
import { memoryStorageAdapter } from "../src/storage.js";

// Render the real editor and real instrument panel: a stub would not prove
// that the controlled instrument actually reaches its selected button/frame.
function Host() {
  const storage = useMemo(() => memoryStorageAdapter({ items: [], meta: {} }), []);
  const board = useChordBoard({ storage });
  return <BoardEditor board={board} enableListening={false} />;
}

async function mount() {
  const view = render(<Host />);
  await act(async () => { await Promise.resolve(); });
  const enter = (value: string) => fireEvent.change(
    within(view.container).getByPlaceholderText(/tell me what chord/i), { target: { value } },
  );
  const selectedInstrument = () => view.container.querySelector('.bc-guitar-instrument-btn[data-active="true"]')?.textContent;
  const display = () => view.container.querySelector('.btn-display-toggle')?.textContent;
  const level = (name: string) => within(view.container).getByRole('radio', { name }) as HTMLInputElement;
  return { ...view, enter, selectedInstrument, display, level };
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
  });

  it("applies a level-only request without switching the display", async () => {
    const { enter, display, level } = await mount();
    enter("advanced Am");
    expect(level("Established").checked).toBe(true);
    expect(display()).toContain("Diagram");
  });
});
