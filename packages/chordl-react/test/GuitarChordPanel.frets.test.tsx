import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { lookupGuitarChord, INSTRUMENTS } from "@pepperhorn/chordl-guitar";
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
    // The shape needs 3, but MIN_FRET_WINDOW keeps the window at 4 so there
    // is an empty fret to read the hand against.
    expect(passedFrets(container)).toBe(4);
  });

  it("never draws fewer than four frets, however little the shape needs", () => {
    // Most ukulele shapes reach no further than the first fret. Sized to the
    // shape, this drew a one-fret sliver with no neck around it.
    const a = lookupGuitarChord("A", "ukulele")!;
    const used = a.positions[0].frets.filter((f) => f > 0);
    expect(Math.max(...used)).toBeLessThan(4);
    const { container } = render(
      <GuitarChordPanel chord="A" instrument="ukulele" showControls={false} position={0} />,
    );
    expect(passedFrets(container)).toBe(4);
  });

  it("raises a request below the floor instead of cropping the shape", () => {
    const { container } = render(
      <GuitarChordPanel chord="C" showControls={false} position={0} frets={1} />,
    );
    // The floor for this shape is 4 — the shape needs 3, MIN_FRET_WINDOW
    // raises it — and a request of 1 must not win against either.
    expect(passedFrets(container)).toBe(4);
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

  // C2 from the whole-branch review: a shape with no fretted string at all
  // (every string open or muted) has nothing to floor `Math.max(...)` on.
  // Ukulele Am7's first position is exactly this — [0,0,0,0] — and it's what
  // the panel shows by default (established includes every rung, and the
  // default `position` is 0). Falling back to 1 there drew a single-fret
  // sliver; the fix floors on the instrument's own default width instead.
  it("floors an all-open shape on the instrument's default width, not a single fret", () => {
    const am7 = lookupGuitarChord("Am7", "ukulele")!;
    expect(am7.positions[0].frets).toEqual([0, 0, 0, 0]);
    const { container } = render(
      <GuitarChordPanel chord="Am7" instrument="ukulele" showControls={false} position={0} />,
    );
    expect(passedFrets(container)).toBe(INSTRUMENTS.ukulele.frets);
  });
});
