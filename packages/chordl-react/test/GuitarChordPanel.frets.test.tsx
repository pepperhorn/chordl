import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { lookupGuitarChord } from "@pepperhorn/chordl-guitar";
import { GuitarChordPanel } from "../src/components/GuitarChordPanel";

// GuitarChord draws through svguitar into real SVG, but its internal markup
// (line/.fret nodes) is a library implementation detail, not part of this
// panel's contract. Stubbing GuitarChord lets these tests assert exactly what
// the panel promises — the `frets` value it hands down — without pinning
// svguitar's DOM shape.
vi.mock("../src/components/GuitarChord", () => ({
  GuitarChord: (props: { frets?: number }) => (
    <div data-testid="mock-guitar-chord" data-frets={props.frets} />
  ),
}));

/** C's guitar shapes, used to derive an expected floor independently of the
 * component under test. Position 0 (open C) uses relative frets up to 3;
 * position 2 (baseFret 5) uses relative frets up to 4 but would read as 8 if
 * a bug added `baseFret` back in — exactly the absolute/relative mix-up this
 * task calls out as the most common bug in this codebase. */
const cShapes = lookupGuitarChord("C", "guitar")!;

function passedFrets(container: HTMLElement): number {
  return Number(container.querySelector<HTMLElement>("[data-testid='mock-guitar-chord']")!.dataset.frets);
}

describe("GuitarChordPanel fret window", () => {
  it("defaults to the displayed shape's floor when no frets prop is given", () => {
    const { container } = render(
      <GuitarChordPanel chord="C" showControls={false} position={0} />,
    );
    expect(cShapes.positions[0].frets.filter((f) => f > 0)).toEqual([3, 2, 1]);
    expect(passedFrets(container)).toBe(3);
  });

  it("raises a request below the floor instead of cropping the shape", () => {
    const { container } = render(
      <GuitarChordPanel chord="C" showControls={false} position={0} frets={1} />,
    );
    // The floor for this shape is 3 (see above) — a request of 1 must not win.
    expect(passedFrets(container)).toBe(3);
  });

  it("honours a request above the floor", () => {
    const { container } = render(
      <GuitarChordPanel chord="C" showControls={false} position={0} frets={7} />,
    );
    expect(passedFrets(container)).toBe(7);
  });

  it("computes the floor in window-relative terms, not by adding baseFret back in", () => {
    // Position 2 sits at baseFret 5 with relative frets up to 4. A bug that
    // treated the stored frets as absolute (or re-added baseFret) would ask
    // for 8 or 9 here instead of 4.
    expect(cShapes.positions[2].baseFret).toBe(5);
    expect(cShapes.positions[2].frets.filter((f) => f > 0)).toEqual([1, 1, 1, 4]);
    const { container } = render(
      <GuitarChordPanel chord="C" showControls={false} position={2} frets={1} />,
    );
    expect(passedFrets(container)).toBe(4);
  });
});
