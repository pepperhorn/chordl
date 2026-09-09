import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { StaffNotation } from "../src/components/StaffNotation";

// The sibling staff-notation.test.tsx mocks Verovio with a promise that is
// already resolved, so none of its tests ever sees a slow load. This file owns
// the cold-start behaviour instead: a mock whose resolution we control, so the
// "engine is still downloading" window can be held open across fake timers.
const pending: { resolve: (svg: string) => void }[] = [];
let mode: "instant" | "held" = "instant";

const SVG =
  `<svg viewBox="0 0 140 120" overflow="visible"><g class="staff">` +
  `<g id="chordl-playback-note-0" class="note"><path /></g>` +
  `</g></svg>`;

vi.mock("../src/verovio", () => ({
  renderMeiToSvg: () =>
    mode === "instant"
      ? Promise.resolve(SVG)
      : new Promise<string>((resolve) => { pending.push({ resolve }); }),
}));

const LOADING = ".bc-staff__loading";
const SLOW_LABEL = ".bc-staff__loading-label";

afterEach(() => {
  vi.useRealTimers();
  pending.length = 0;
  mode = "instant";
});

describe("slow-load label", () => {
  it("does not appear on a fast resolve", async () => {
    mode = "instant";
    const { container } = render(<StaffNotation notes={["C", "E", "G"]} />);
    await waitFor(() => {
      expect(container.querySelector(".bc-staff__engraving svg")).toBeTruthy();
    });
    // Well past the threshold: a warm toolkit must never explain itself.
    vi.useFakeTimers();
    await act(async () => { vi.advanceTimersByTime(5_000); });
    expect(container.querySelector(SLOW_LABEL)).toBeNull();
    expect(container.querySelector(LOADING)).toBeNull();
  });

  it("appears once loading has continued past the threshold", async () => {
    mode = "held";
    vi.useFakeTimers();
    const { container } = render(<StaffNotation notes={["C", "E", "G"]} />);

    // Still inside the window a warm load would finish in: dots only.
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(container.querySelector(LOADING)).toBeTruthy();
    expect(container.querySelector(SLOW_LABEL)).toBeNull();

    await act(async () => { vi.advanceTimersByTime(1_200); });
    const label = container.querySelector(SLOW_LABEL);
    expect(label).toBeTruthy();
    expect(label!.textContent).toMatch(/loading notation engine/i);
    expect(label!.textContent).toMatch(/first time only/i);
    // The screen reader gets the same explanation, not just "Rendering".
    expect(container.querySelector(LOADING)!.getAttribute("aria-label")).toMatch(
      /loading notation engine/i,
    );
  });

  it("clears the label once the engraving arrives", async () => {
    mode = "held";
    vi.useFakeTimers();
    const { container } = render(<StaffNotation notes={["C", "E", "G"]} />);
    await act(async () => { vi.advanceTimersByTime(2_000); });
    expect(container.querySelector(SLOW_LABEL)).toBeTruthy();

    await act(async () => { pending.forEach((p) => p.resolve(SVG)); });
    expect(container.querySelector(SLOW_LABEL)).toBeNull();
    expect(container.querySelector(".bc-staff__engraving svg")).toBeTruthy();
  });
});

describe("a prop change mid-load does not restart the wait", () => {
  it("keeps the elapsed-loading clock running across a re-render", async () => {
    mode = "held";
    vi.useFakeTimers();
    const { container, rerender } = render(<StaffNotation notes={["C", "E", "G"]} />);

    await act(async () => { vi.advanceTimersByTime(1_000); });
    expect(container.querySelector(SLOW_LABEL)).toBeNull();

    // Same in-flight toolkit download, new request against it. The wait has
    // been going for a second already; it must not go back to zero.
    rerender(<StaffNotation notes={["D", "F#", "A"]} />);
    await act(async () => { vi.advanceTimersByTime(700); });

    expect(container.querySelector(SLOW_LABEL)).toBeTruthy();
  });

  it("shows no engraving from the superseded props while the new one renders", async () => {
    mode = "instant";
    const { container, rerender } = render(<StaffNotation notes={["C", "E", "G"]} />);
    await waitFor(() => {
      expect(container.querySelector(".bc-staff__engraving svg")).toBeTruthy();
    });
    mode = "held";
    rerender(<StaffNotation notes={["D", "F#", "A"]} />);
    // The stale engraving is not left on screen under the new chord's name.
    expect(container.querySelector(".bc-staff__engraving")).toBeNull();
    expect(container.querySelector(LOADING)).toBeTruthy();
  });
});
