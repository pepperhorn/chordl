import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";

const loaded = vi.hoisted(() => ({ html2canvas: 0, jspdf: 0, saved: [] as string[] }));

const fakeCanvas = () => ({
  width: 200,
  height: 100,
  toDataURL: () => "data:image/png;base64,",
  toBlob: (cb: (b: Blob | null) => void) => cb(null),
});

// vi.mock factories run on first import of the module, so the counters say
// whether anything actually pulled the library in, not just whether it was called.
vi.mock("html2canvas", () => {
  loaded.html2canvas++;
  return { default: vi.fn(async () => fakeCanvas()) };
});
vi.mock("jspdf", () => {
  loaded.jspdf++;
  class FakePdf {
    addImage() {}
    save(name: string) {
      loaded.saved.push(name);
    }
  }
  return { jsPDF: FakePdf, default: FakePdf };
});

// ChordBoard and BoardPlayer are imported dynamically inside the tests so the
// first test's counters reflect BoardPlayer's module graph alone. Keep the
// order: the counters are module-level for this file.
describe("export libraries load on demand", () => {
  it("BoardPlayer renders without loading html2canvas or jspdf", async () => {
    const { BoardPlayer } = await import("../src/BoardPlayer.js");
    render(<BoardPlayer items={[{ id: "c", nl: "C" }]} meta={{}} playing={false} onPlayingChange={() => {}} />);
    expect(loaded).toMatchObject({ html2canvas: 0, jspdf: 0 });
  });

  it("ChordBoard renders without loading them either", async () => {
    const { ChordBoard } = await import("../src/ChordBoard.js");
    render(<ChordBoard items={[{ id: "c", nl: "C" }]} />);
    expect(loaded).toMatchObject({ html2canvas: 0, jspdf: 0 });
  });

  it("loads html2canvas only on the first PNG export", async () => {
    const { ChordBoard } = await import("../src/ChordBoard.js");
    const { container } = render(<ChordBoard items={[{ id: "c", nl: "C" }]} />);
    fireEvent.click(container.querySelector(".chordl-board-export-png")!);
    await waitFor(() => expect(loaded.html2canvas).toBe(1));
    expect(loaded.jspdf).toBe(0);
  });

  it("loads jspdf on PDF export and saves with the board's filename", async () => {
    const { ChordBoard } = await import("../src/ChordBoard.js");
    const { container } = render(<ChordBoard items={[{ id: "c", nl: "C" }]} meta={{ title: "Lesson One" }} />);
    fireEvent.click(container.querySelector(".chordl-board-export-pdf")!);
    await waitFor(() => expect(loaded.saved).toEqual(["lesson-one.pdf"]));
    expect(loaded.jspdf).toBe(1);
  });
});
