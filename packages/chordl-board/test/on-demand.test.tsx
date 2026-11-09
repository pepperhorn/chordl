import { it, expect, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

const warm = vi.hoisted(() => ({ now: vi.fn(), idle: vi.fn() }));
vi.mock("@pepperhorn/chordl-react", async () => ({
  ...await vi.importActual("@pepperhorn/chordl-react"),
  prefetchVerovio: warm.now,
  prefetchVerovioWhenIdle: warm.idle,
}));
import { BoardEditor } from "../src/BoardEditor";
import { BoardCardContent, useChordBoard } from "../src/ChordBoard";
import { memoryStorageAdapter } from "../src/storage";

it("piano mount does not warm notation; Display intent still does", () => {
  function Editor() {
    const board = useChordBoard({ storage: memoryStorageAdapter() });
    return <BoardEditor board={board} initialChord="C" />;
  }
  const { container } = render(<Editor />);
  expect(warm.now).not.toHaveBeenCalled();
  expect(warm.idle).not.toHaveBeenCalled();
  const display = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Diagram'))!;
  expect(display).toBeTruthy();
  fireEvent.focus(display);
  expect(warm.now).toHaveBeenCalledOnce();
  fireEvent.pointerEnter(display);
  expect(warm.now).toHaveBeenCalledTimes(2);
  expect(warm.idle).not.toHaveBeenCalled();
});

it("existing staff cards request notation immediately", () => {
  warm.now.mockClear();
  function Editor() {
    const board = useChordBoard({ initialItems: [{ id: "s", nl: "C", display: "staff" }], storage: memoryStorageAdapter() });
    return <BoardEditor board={board} initialChord="C" />;
  }
  render(<Editor />);
  expect(warm.now).toHaveBeenCalled();
  expect(warm.idle).not.toHaveBeenCalled();
});

it("piano and text cards have additive ready markers", () => {
  const { container } = render(<><BoardCardContent item={{ id: "c", nl: "C" }} /><BoardCardContent item={{ id: "t", kind: "text", title: "Verse" }} /></>);
  expect(container.querySelectorAll('[data-chordl-state="ready"]')).toHaveLength(2);
});

it("staff SVG placeholders cannot satisfy readiness; engraving must complete", async () => {
  const { container } = render(<BoardCardContent item={{ id: "s", nl: "C", display: "both" }} />);
  const fallback = container.querySelector('.chordl-board-card-loading')!;
  expect(fallback).toBeTruthy();
  expect(fallback.querySelector('svg')).toBeNull();
  expect(container.querySelector('[data-chordl-state="ready"]')).toBeNull();
  await waitFor(() => expect(container.querySelector('.chordl-board-card-notation[data-chordl-state="ready"]')).toBeTruthy());
  expect(container.querySelector('.bc-staff__engraving svg')).toBeTruthy();
  expect(container.querySelector('.chordl-board-card-loading')).toBeNull();
});
