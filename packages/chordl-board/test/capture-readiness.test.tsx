import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";

const pending = vi.hoisted(() => ({ resolve: null as ((module: { default: ComponentType }) => void) | null }));
const capture = vi.hoisted(() => vi.fn());
const saved = vi.hoisted(() => vi.fn());
vi.mock("@pepperhorn/chordl-react", async () => {
  const actual = await vi.importActual<typeof import("@pepperhorn/chordl-react")>("@pepperhorn/chordl-react");
  const { lazy, Suspense, useState } = await import("react");
  function DeferredGuitar() {
    const [Panel] = useState(() => lazy(() => new Promise<{ default: ComponentType }>((resolve) => { pending.resolve = resolve; })));
    return <Suspense fallback={<div className="chordl-board-card-loading" data-chordl-state="loading">Loading guitar shapes…</div>}><Panel /></Suspense>;
  }
  return { ...actual, GuitarChordPanel: DeferredGuitar };
});
vi.mock("html2canvas", () => ({ default: async (node: HTMLElement) => {
  capture({ loading: !!node.querySelector('[data-chordl-state="loading"]'), content: node.textContent });
  return { width: 200, height: 100, toBlob: (cb: (blob: Blob | null) => void) => cb(null), toDataURL: () => "data:image/png;base64," };
} }));
vi.mock("jspdf", () => ({ jsPDF: class { addImage() {} save(name: string) { saved(name); } } }));
import { ChordBoard } from "../src/ChordBoard";

beforeEach(() => { capture.mockClear(); saved.mockClear(); pending.resolve = null; });

describe("capture waits for pending card rendering", () => {
  it.each(["png", "pdf"])("%s waits for a suspended guitar card before capturing", async (format) => {
    const { container } = render(<ChordBoard items={[{ id: "g", nl: "C", display: "guitar" }]} />);
    expect(container.querySelector('[data-chordl-state="loading"]')).toBeTruthy();
    fireEvent.click(container.querySelector(`.chordl-board-export-${format}`)!);
    // Cross the same animation-frame boundary captureBoard uses. It must then
    // wait for the still-pending lazy module, not capture the fallback.
    await act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
    expect(capture).not.toHaveBeenCalled();
    await act(async () => pending.resolve!({ default: () => <div data-chordl-state="ready">Finished guitar</div> }));
    await waitFor(() => expect(capture).toHaveBeenCalledOnce());
    expect(capture.mock.calls[0][0]).toMatchObject({ loading: false, content: expect.stringContaining("Finished guitar") });
    if (format === "pdf") await waitFor(() => expect(saved).toHaveBeenCalledWith("chord-board.pdf"));
  });

  it("warns after 15 seconds and captures pending content rather than hanging", async () => {
    vi.useFakeTimers();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container, unmount } = render(<ChordBoard items={[{ id: "g", nl: "C", display: "guitar" }]} />);
    try {
      fireEvent.click(container.querySelector('.chordl-board-export-pdf')!);
      await act(async () => { await vi.advanceTimersByTimeAsync(16); });
      await act(async () => { await vi.advanceTimersByTimeAsync(14_999); });
      expect(capture).not.toHaveBeenCalled();
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      await vi.dynamicImportSettled();
      expect(warning).toHaveBeenCalledWith(expect.stringContaining("timed out after 15s"));
      expect(capture).toHaveBeenCalledOnce();
      expect(capture.mock.calls[0][0].loading).toBe(true);
      expect(saved).toHaveBeenCalledWith("chord-board.pdf");
    } finally {
      unmount();
      warning.mockRestore();
      vi.useRealTimers();
    }
  });
});
