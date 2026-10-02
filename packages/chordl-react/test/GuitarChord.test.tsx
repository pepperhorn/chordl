import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { GuitarChord } from "../src/components/GuitarChord";
import { lookupGuitarChord } from "@pepperhorn/chordl-guitar";

const amShape = lookupGuitarChord("Am")!.shapes[0];

describe("GuitarChord", () => {
  it("draws a diagram into its container", () => {
    const { container } = render(<GuitarChord chord={amShape} />);
    const host = container.querySelector(".bc-guitar-chord")!;
    expect(host).toBeTruthy();
    expect(host.querySelector("svg")).toBeTruthy();
    expect(host.querySelector('[aria-label="Rendering chord frame"]')).toBeTruthy();
  });

  it("redraws in place instead of appending when the chord changes", () => {
    const cShape = lookupGuitarChord("C")!.shapes[0];
    const { container, rerender } = render(<GuitarChord chord={amShape} />);
    rerender(<GuitarChord chord={cShape} />);
    // The effect clears the node before drawing, so exactly one diagram remains.
    expect(container.querySelectorAll(".bc-guitar-chord svg").length).toBe(1);
  });

  it("renders a 4-string diagram when given ukulele settings", () => {
    const ukeShape = lookupGuitarChord("Am", "ukulele")!.shapes[0];
    const { container } = render(
      <GuitarChord chord={ukeShape} settings={{ strings: 4, tuning: ["G", "C", "E", "A"] }} />,
    );
    expect(container.querySelector(".bc-guitar-chord svg")).toBeTruthy();
  });

  it("does not throw on a shape with no fingers", () => {
    expect(() =>
      render(<GuitarChord chord={{ fingers: [], barres: [] }} />),
    ).not.toThrow();
  });

  it("does not re-raise the loading veil when a parent re-render leaves the chord unchanged", async () => {
    // A consumer that rebuilds the chord object every render — exactly what
    // GuitarChordPanel does when it strips the shape's title, and what any
    // caller passing an object literal does.
    function Parent({ tick }: { tick: number }) {
      return (
        <div data-tick={tick}>
          <GuitarChord chord={{ ...amShape, fingers: [...amShape.fingers] }} />
        </div>
      );
    }
    const { container, rerender } = render(<Parent tick={0} />);
    const veil = () => container.querySelector('[aria-label="Rendering chord frame"]');
    await waitFor(() => { expect(veil() === null).toBe(true); });

    rerender(<Parent tick={1} />);
    // Nothing the diagram draws changed, so the veil must stay down.
    expect(veil() === null).toBe(true);
    expect(container.querySelectorAll(".bc-guitar-chord svg").length).toBe(1);
  });

  it("raises the veil again when the chord actually changes", async () => {
    const cShape = lookupGuitarChord("C")!.shapes[0];
    const { container, rerender } = render(<GuitarChord chord={amShape} />);
    const veil = () => container.querySelector('[aria-label="Rendering chord frame"]');
    await waitFor(() => { expect(veil() === null).toBe(true); });
    rerender(<GuitarChord chord={cShape} />);
    expect(veil() === null).toBe(false);
  });

  it("keeps a diagram that drew fine when requestAnimationFrame throws", () => {
    const raf = vi
      .spyOn(globalThis, "requestAnimationFrame")
      .mockImplementation(() => { throw new Error("no rAF"); });
    try {
      const { container } = render(<GuitarChord chord={amShape} />);
      // The catch around draw() wipes the container; rAF failing must not.
      expect(container.querySelectorAll(".bc-guitar-chord svg").length).toBe(1);
      // ...and the veil comes down rather than sticking forever.
      expect(container.querySelector('[aria-label="Rendering chord frame"]') === null).toBe(true);
    } finally {
      raf.mockRestore();
    }
  });
});

describe("frame appearance", () => {
  it.each(["guitar", "ukulele"] as const)("lays out %s strings horizontally and keeps text upright", (instrument) => {
    const shape = lookupGuitarChord("Am", instrument)!.shapes[0];
    const strings = instrument === "ukulele" ? 4 : 6;
    const { container, rerender } = render(<GuitarChord chord={shape} settings={{ strings }} />);
    const vertical = container.querySelector("line.bc-frame-string")!;
    expect(vertical.getAttribute("x1")).toBe(vertical.getAttribute("x2"));
    rerender(<GuitarChord chord={shape} settings={{ strings }} orientation="horizontal" />);
    const horizontal = container.querySelector("line.bc-frame-string")!;
    expect(horizontal.getAttribute("y1")).toBe(horizontal.getAttribute("y2"));
    expect(horizontal.getAttribute("x1")).not.toBe(horizontal.getAttribute("x2"));
    expect(container.querySelectorAll("line.bc-frame-string")).toHaveLength(strings);
    expect(container.querySelector(".bc-guitar-chord__canvas")?.getAttribute("style")).toBeNull();
  });

  it.each(["vertical", "horizontal"] as const)("sketches only grid lines in %s frames and stays deterministic", (orientation) => {
    const { container, rerender } = render(<GuitarChord chord={amShape} orientation={orientation} />);
    const gridCount = container.querySelectorAll("line.bc-frame-string, line.bc-frame-fret").length;
    const fingers = () => Array.from(container.querySelectorAll(".finger")).map(el => el.outerHTML);
    const originalFingers = fingers();
    rerender(<GuitarChord chord={amShape} orientation={orientation} lineStyle="handdrawn" />);
    expect(container.querySelectorAll("path.bc-frame-string, path.bc-frame-fret")).toHaveLength(gridCount);
    expect(container.querySelectorAll("line.bc-frame-string, line.bc-frame-fret")).toHaveLength(0);
    expect(fingers()).toEqual(originalFingers);
    const paths = () => Array.from(container.querySelectorAll("path.bc-frame-string, path.bc-frame-fret")).map(el => el.getAttribute("d"));
    const sketch = paths();
    rerender(<GuitarChord chord={amShape} orientation={orientation} />);
    rerender(<GuitarChord chord={amShape} orientation={orientation} lineStyle="handdrawn" />);
    expect(paths()).toEqual(sketch);
    const svg = container.querySelector("svg");
    rerender(<GuitarChord chord={{ ...amShape }} orientation={orientation} lineStyle="handdrawn" activeString={1} />);
    expect(container.querySelector("svg")).toBe(svg);
  });
});
