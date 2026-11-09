// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const downloads: Array<{ blob: Blob; filename: string }> = [];
const wavCalls: Array<{ notes: Array<string | number>; mode: string }> = [];

vi.mock("../src/audio/wav-export", () => ({
  generateWav: async (notes: Array<string | number>, mode: string) => {
    wavCalls.push({ notes, mode });
    return new Uint8Array([82, 73, 70, 70]);
  },
}));
vi.mock("../src/audio/zip-export", async () => {
  const actual = await vi.importActual<typeof import("../src/audio/zip-export")>("../src/audio/zip-export");
  return {
    ...actual,
    downloadBlob: (blob: Blob, filename: string) => { downloads.push({ blob, filename }); },
  };
});

import { GuitarChordPanel } from "../src/components/GuitarChordPanelImpl";

/** Note numbers of a Format 0 file's note-on events, in file order. */
function noteOns(midi: Uint8Array): number[] {
  const out: number[] = [];
  for (let i = 14; i < midi.length - 2; i++) {
    if (midi[i] === 0x90 && midi[i + 2] === 90 && midi[i + 1] < 128) out.push(midi[i + 1]);
  }
  return out;
}

async function exportZip(container: HTMLElement, mode: "This" | "All") {
  const before = downloads.length;
  fireEvent.click(container.querySelector(".variant-pill-zip")!);
  const btn = Array.from(container.querySelectorAll(".zip-menu-btn")).find((b) => b.textContent === mode)!;
  fireEvent.click(btn);
  await waitFor(() => expect(downloads.length).toBe(before + 1));
  const { blob, filename } = downloads[downloads.length - 1];
  return { zip: await JSZip.loadAsync(blob), filename };
}

beforeEach(() => {
  // jsdom has no SVGSVGElement.viewBox; the exporter reads it.
  if (!("viewBox" in SVGElement.prototype)) {
    Object.defineProperty(SVGElement.prototype, "viewBox", {
      configurable: true,
      get(this: Element) {
        const [x = 0, y = 0, width = 100, height = 100] = (this.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
        return { baseVal: { x, y, width, height } };
      },
    });
  }
  downloads.length = 0;
  wavCalls.length = 0;
  // jsdom rasterises nothing: make the PNG path succeed with fake bytes.
  // Node's TextEncoder returns a Node-realm Uint8Array, which JSZip (running
  // against jsdom's globals) refuses; hand back the realm's own.
  vi.stubGlobal("TextEncoder", class {
    encode(text: string) { return new Uint8Array(Buffer.from(text, "utf8")); }
  });
  vi.stubGlobal("Image", class {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) { setTimeout(() => this.onload?.(), 0); }
  });
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ scale: vi.fn(), drawImage: vi.fn() })) as never;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback) { // jsdom's Blob has no arrayBuffer(), which the exporter calls.
    cb({ arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer } as unknown as Blob); };
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("GuitarChordPanel zip export", () => {
  it.each(["guitar", "guitar-top3", "ukulele"] as const)("shows the .zip button for %s", (instrument) => {
    const { container } = render(<GuitarChordPanel chord="C" instrument={instrument} />);
    expect(container.querySelector(".zip-export-container .variant-pill-zip")).not.toBeNull();
  });

  it("is absent from board cards (showControls false)", () => {
    const { container } = render(<GuitarChordPanel chord="C" showControls={false} />);
    expect(container.querySelector(".variant-pill-zip")).toBeNull();
  });

  it("This: zips svg, png, mid and both wavs for the displayed guitar position", async () => {
    const { container } = render(<GuitarChordPanel chord="C" />);
    await waitFor(() => expect(container.querySelector(".bc-guitar-chord__canvas svg")).not.toBeNull());
    const { zip, filename } = await exportZip(container, "This");
    expect(filename).toBe("C.zip");
    expect(Object.keys(zip.files).sort()).toEqual(["C.mid", "C.png", "C.svg", "C_arpeggio.wav", "C_chord.wav"]);
    expect(await zip.file("C.svg")!.async("string")).toContain("<svg");
    // Open C: x32010 → C3 E3 G3 C4 E4, the real sounding pitches.
    expect(noteOns(await zip.file("C.mid")!.async("uint8array"))).toEqual([48, 52, 55, 60, 64]);
    expect(wavCalls.map((c) => c.notes)).toEqual([[48, 52, 55, 60, 64], [48, 52, 55, 60, 64]]);
    expect(wavCalls.map((c) => c.mode)).toEqual(["block", "arpeggio"]);
  });

  it("This: writes the ukulele's re-entrant pitches (G4 C4 E4 C5), not a collapsed octave", async () => {
    const { container } = render(<GuitarChordPanel chord="C" instrument="ukulele" />);
    await waitFor(() => expect(container.querySelector(".bc-guitar-chord__canvas svg")).not.toBeNull());
    const { zip } = await exportZip(container, "This");
    expect(noteOns(await zip.file("C.mid")!.async("uint8array"))).toEqual([67, 60, 64, 72]);
    expect(wavCalls[0].notes).toEqual([67, 60, 64, 72]);
  });

  it("This: exports the position that is displayed after switching", async () => {
    const { container } = render(<GuitarChordPanel chord="C" />);
    const buttons = container.querySelectorAll(".bc-guitar-position-btn");
    expect(buttons.length).toBeGreaterThan(1);
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(container.querySelector(".bc-guitar-chord__canvas svg")).not.toBeNull());
    const { zip } = await exportZip(container, "This");
    const midi = noteOns(await zip.file("C.mid")!.async("uint8array"));
    expect(midi).not.toEqual([48, 52, 55, 60, 64]);
    expect(midi.length).toBeGreaterThan(2);
  });

  it("All: one A_/B_… subfolder per visible position, each with all five files", async () => {
    const { container } = render(<GuitarChordPanel chord="C" />);
    const positions = container.querySelectorAll(".bc-guitar-position-btn").length;
    expect(positions).toBeGreaterThan(1);
    const { zip, filename } = await exportZip(container, "All");
    expect(filename).toBe("C_all.zip");
    const folders = Object.keys(zip.files).filter((n) => n.endsWith("/"));
    expect(folders).toHaveLength(positions);
    expect(folders[0]).toMatch(/^A_fret /);
    for (const folder of folders) {
      for (const file of ["C.svg", "C.png", "C.mid", "C_chord.wav", "C_arpeggio.wav"]) {
        expect(zip.file(`${folder}${file}`), `${folder}${file}`).not.toBeNull();
      }
    }
    expect(container.querySelector(".bc-guitar-export-frames")).toBeNull();
  });
});
