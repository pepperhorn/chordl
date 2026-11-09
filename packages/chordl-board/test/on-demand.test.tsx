import { it, expect, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

const warm = vi.hoisted(() => ({ now: vi.fn(), idle: vi.fn() }));
type StaffState = "loading" | "ready" | "error" | undefined;
const engraving = vi.hoisted(() => ({ finish: null as ((states: StaffState[]) => void) | null }));
vi.mock("@pepperhorn/chordl-react", async () => {
  const actual = await vi.importActual<typeof import("@pepperhorn/chordl-react")>("@pepperhorn/chordl-react");
  const { useState } = await import("react");
  // The readiness contract is DOM-based. Control each staff's completion so
  // this test covers partial engraving without downloading/initialising WASM.
  function Staffs() {
    const [states, setStates] = useState<StaffState[]>(["loading", "loading"]);
    engraving.finish = setStates;
    // Keep DOM shape identical in every state: only markers convey readiness.
    return <>{states.map((state, index) => <svg className="bc-staff" key={index} data-chordl-state={state}>
      <g className="bc-staff__engraving"><svg><path d="M0 0 L1 1" /></svg></g>
    </svg>)}</>;
  }
  return {
    ...actual,
    prefetchVerovio: warm.now,
    prefetchVerovioWhenIdle: warm.idle,
    PianoChord: (props: Extract<Parameters<typeof actual.PianoChord>[0], { chord: string }>) =>
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
  expect(container.querySelector('.chordl-board-card-notation')?.getAttribute("data-chordl-state")).toBe("loading");
  await act(async () => engraving.finish!(["ready", "loading"]));
  expect(container.querySelectorAll('.bc-staff__engraving svg')).toHaveLength(2);
  expect(container.querySelector('.chordl-board-card-notation')?.getAttribute("data-chordl-state")).toBe("loading");
  await act(async () => engraving.finish!(["ready", "ready"]));
  await waitFor(() => expect(container.querySelector('.chordl-board-card-notation[data-chordl-state="ready"]')).toBeTruthy());
  expect(container.querySelector('.bc-staff__engraving svg')).toBeTruthy();
  expect(container.querySelector('.chordl-board-card-loading')).toBeNull();
});

it("a guitar board card without a shape settles on a ready notice with no loading marker", async () => {
  const { container } = render(<BoardCardContent item={{ id: "g", nl: "C/E", display: "guitar", instrument: "ukulele" }} />);
  await waitFor(() => expect(container.querySelector('.chordl-board-card-guitar[data-chordl-state="ready"]')?.textContent).toContain("No ukulele shape found"));
  expect(container.querySelector('[data-chordl-state="loading"]')).toBeNull();
  expect(container.querySelector('[data-chordl-state="error"]')).toBeNull();
});


it("a failed staff takes precedence over both pending and ready siblings", async () => {
  const { container } = render(<BoardCardContent item={{ id: "s", nl: "C", display: "both" }} />);
  const card = container.querySelector(".chordl-board-card-notation")!;
  await act(async () => engraving.finish!(["error", "loading"]));
  await waitFor(() => expect(card.getAttribute("data-chordl-state")).toBe("error"));
  expect(container.querySelector(".chordl-board-card-loading")).toBeNull();
  await act(async () => engraving.finish!(["error", "ready"]));
  expect(card.getAttribute("data-chordl-state")).toBe("error");
});

it("absent staff markers stay loading rather than inferring readiness from SVGs", async () => {
  const { container } = render(<BoardCardContent item={{ id: "s", nl: "C", display: "staff" }} />);
  await act(async () => engraving.finish!(["ready", undefined]));
  expect(container.querySelector(".chordl-board-card-notation")?.getAttribute("data-chordl-state")).toBe("loading");
  await act(async () => engraving.finish!([]));
  expect(container.querySelector(".chordl-board-card-notation")?.getAttribute("data-chordl-state")).toBe("loading");
});
