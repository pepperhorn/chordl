import { it, expect, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

const warm = vi.hoisted(() => ({ now: vi.fn(), idle: vi.fn() }));
const engraving = vi.hoisted(() => ({ finish: null as ((count: number) => void) | null }));
vi.mock("@pepperhorn/chordl-react", async () => {
  const actual = await vi.importActual<typeof import("@pepperhorn/chordl-react")>("@pepperhorn/chordl-react");
  const { useState } = await import("react");
  // The readiness contract is DOM-based. Control each staff's completion so
  // this test covers partial engraving without downloading/initialising WASM.
  function Staffs() {
    const [completed, setCompleted] = useState(0);
    engraving.finish = setCompleted;
    return <>{[0, 1].map(index => <svg className="bc-staff" key={index}>
      {index < completed
        ? <g className="bc-staff__engraving"><svg><path d="M0 0 L1 1" /></svg></g>
        : <g className="bc-staff__loading" role="status" />}
    </svg>)}</>;
  }
  return {
    ...actual,
    prefetchVerovio: warm.now,
    prefetchVerovioWhenIdle: warm.idle,
    PianoChord: (props: Parameters<typeof actual.PianoChord>[0]) =>
      props.display === "staff" || props.display === "both" ? <Staffs /> : <actual.PianoChord {...props} />,
  };
});
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
  await act(async () => engraving.finish!(1));
  expect(container.querySelectorAll('.bc-staff__engraving svg')).toHaveLength(1);
  expect(container.querySelector('[data-chordl-state="ready"]')).toBeNull();
  await act(async () => engraving.finish!(2));
  await waitFor(() => expect(container.querySelector('.chordl-board-card-notation[data-chordl-state="ready"]')).toBeTruthy());
  expect(container.querySelector('.bc-staff__engraving svg')).toBeTruthy();
  expect(container.querySelector('.chordl-board-card-loading')).toBeNull();
});
