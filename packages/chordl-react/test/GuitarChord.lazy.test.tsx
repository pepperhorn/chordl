import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";

const loaded = vi.hoisted(() => ({ panel: 0, renderer: 0 }));
vi.mock("../src/components/GuitarChordPanelImpl", async () => {
  loaded.panel++;
  return await vi.importActual("../src/components/GuitarChordPanelImpl");
});
vi.mock("../src/components/GuitarChordImpl", async () => {
  loaded.renderer++;
  return await vi.importActual("../src/components/GuitarChordImpl");
});

it("does not import guitar implementations until rendered, and marks loading then ready", async () => {
  const { GuitarChordPanel } = await import("../src/components/GuitarChordPanel");
  const { GuitarChord } = await import("../src/components/GuitarChord");
  expect(loaded).toEqual({ panel: 0, renderer: 0 });
  // React 18's synchronous SSR emits the Suspense fallback without browser APIs.
  const html = renderToString(<GuitarChord chord={{ fingers: [], barres: [] }} />);
  expect(html).toContain('data-chordl-state="loading"');
  expect(html).not.toContain("<svg");
  const { container } = render(<GuitarChordPanel chord="C" showPlayback={false} />);
  const fallback = container.querySelector('.chordl-board-card-loading')!;
  expect(fallback.getAttribute("data-chordl-state")).toBe("loading");
  expect(fallback.querySelector("svg")).toBeNull();
  expect(container.querySelector('[data-chordl-state="ready"]')).toBeNull();
  await waitFor(() => expect(container.querySelector('.bc-guitar-chord[data-chordl-state="ready"] svg')).toBeTruthy());
  expect(loaded).toEqual({ panel: 1, renderer: 1 });
  expect(container.querySelector('.chordl-board-card-loading')).toBeNull();
});

describe("standalone guitar", () => {
  it("marks actual draw failure as error rather than ready", async () => {
    const { GuitarChord } = await import("../src/components/GuitarChord");
    const { container } = render(<GuitarChord chord={{ fingers: null as never }} />);
    await waitFor(() => expect(container.querySelector('[data-chordl-state="error"]')).toBeTruthy());
    expect(container.querySelector('[data-chordl-state="ready"]')).toBeNull();
  });
});

it.each([
  { chord: "C major scale", message: "switch off scale mode" },
  { chord: "", message: "Enter a chord" },
  { chord: "C/E", instrument: "ukulele" as const, message: "No ukulele shape found" },
])("notice for '$chord' is finished content with a ready marker", async ({ chord, instrument, message }) => {
  const { GuitarChordPanel } = await import("../src/components/GuitarChordPanel");
  const { container } = render(<GuitarChordPanel chord={chord} instrument={instrument} />);
  await waitFor(() => expect(container.querySelector('.bc-guitar-panel[data-chordl-state="ready"]')?.textContent).toContain(message));
  expect(container.querySelector('[data-chordl-state="loading"]')).toBeNull();
  expect(container.querySelector('[data-chordl-state="error"]')).toBeNull();
});
