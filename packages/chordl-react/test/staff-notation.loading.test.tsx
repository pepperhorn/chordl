import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { StaffNotation } from "../src/components/StaffNotation";

// The sibling staff-notation.test.tsx mocks Verovio with a promise that is
// already resolved, so none of its tests ever sees a slow load. This file owns
// the cold-start behaviour instead: a mock whose resolution we control, so the
// "engine is still downloading" window can be held open across fake timers.
const pending: { resolve: (svg: string) => void }[] = [];
let mode: "instant" | "held" = "instant";
// Whether the toolkit itself has finished loading. A held render with a READY
// toolkit is the board case: 20 cards queued through one main-thread engraver,
// so a late card waits seconds with nothing left to download.
let toolkitReady = false;

const SVG =
  `<svg viewBox="0 0 140 120" overflow="visible"><g class="staff">` +
  `<g id="chordl-playback-note-0" class="note"><path /></g>` +
  `</g></svg>`;

vi.mock("../src/verovio", () => ({
  renderMeiToSvg: () =>
    mode === "instant"
      ? Promise.resolve(SVG)
      : new Promise<string>((resolve) => { pending.push({ resolve }); }),
  isVerovioReady: () => toolkitReady,
}));

const LOADING = ".bc-staff__loading";
const SLOW_LABEL = ".bc-staff__loading-label";

afterEach(() => {
  vi.useRealTimers();
  pending.length = 0;
  mode = "instant";
  toolkitReady = false;
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

describe("the label is about the download, not about the wait", () => {
  it("stays away however long a warm engine takes", async () => {
    // Nothing to download: this card is just queued behind others on the one
    // main-thread toolkit. "first time only" would be a lie.
    toolkitReady = true;
    mode = "held";
    vi.useFakeTimers();
    const { container } = render(<StaffNotation notes={["C", "E", "G"]} />);

    await act(async () => { vi.advanceTimersByTime(10_000); });
    expect(container.querySelector(LOADING)).toBeTruthy();
    expect(container.querySelector(SLOW_LABEL)).toBeNull();
  });

  it("still appears while the engine is genuinely still loading", async () => {
    toolkitReady = false;
    mode = "held";
    vi.useFakeTimers();
    const { container } = render(<StaffNotation notes={["C", "E", "G"]} />);

    await act(async () => { vi.advanceTimersByTime(2_000); });
    expect(container.querySelector(SLOW_LABEL)).toBeTruthy();
  });
});

describe("the slow-load explanation reaches a screen reader", () => {
  it("puts real text inside the live region", async () => {
    mode = "held";
    vi.useFakeTimers();
    const { container } = render(<StaffNotation notes={["C", "E", "G"]} />);
    await act(async () => { vi.advanceTimersByTime(2_000); });

    const region = container.querySelector(LOADING)!;
    const label = region.querySelector(SLOW_LABEL)!;
    expect(label).toBeTruthy();
    // A role="status" region announces content mutations, not aria-label
    // changes on itself — so the text that appears has to be readable.
    expect(label.getAttribute("aria-hidden")).toBeNull();
    expect(label.closest('[role="status"]')).toBe(region);
    // The two lines have to read as one sentence, not run together.
    expect(region.textContent).toMatch(/Loading notation engine\s+first time only/i);
    // The region's static name is unchanged; the content carries the news.
    expect(region.getAttribute("aria-label")).toBe("Rendering notation");
  });
});
