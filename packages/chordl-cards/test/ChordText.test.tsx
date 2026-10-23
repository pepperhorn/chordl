// @vitest-environment jsdom
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChordText } from "../src/ChordText";
import { ACCIDENTAL_METRICS, RAISED_SCALE, accidentalGlyphs, glyphBounds } from "../src/accidentals";

describe("ChordText", () => {
  it("draws accidentals as inline glyphs, never the letter b", () => {
    const { container } = render(<ChordText text="Abm7b5" />);
    const visual = container.querySelector(".chord-text-visual")!;
    expect(visual.getAttribute("aria-hidden")).toBe("true");
    expect(visual.textContent).toBe("Am75");
    expect(visual.querySelectorAll("svg.chord-accidental-flat")).toHaveLength(2);
  });

  it("gives each glyph its advance as an em width, at the weight asked for", () => {
    const { container } = render(<ChordText text="F#" weight={700} />);
    const svg = container.querySelector<SVGElement>("svg.chord-accidental-sharp")!;
    expect(svg.style.width).toBe(`${accidentalGlyphs[700].sharp.advance / 1000}em`);
    expect(svg.querySelector("path")!.getAttribute("fill")).toBe("currentColor");
  });

  it("says the accidental in words to a screen reader", () => {
    const { container, getByText } = render(<ChordText text="Eb" />);
    expect(getByText("E flat")).toBeTruthy();
    expect(container.querySelector(".chord-text-sr")!.textContent).toBe("E flat");
  });

  it("takes a full name for the accessible text when given one", () => {
    const { container } = render(<ChordText text="Ebmaj7" label="e flat major seventh" />);
    expect(container.querySelector(".chord-text-sr")!.textContent).toBe("e flat major seventh");
  });

  it("sets accidentals raised when asked: 62%, the glyph's top on the cap line", () => {
    const { container } = render(<ChordText text="Eb" weight={700} accidentals="raised" />);
    const svg = container.querySelector<SVGElement>("svg.chord-accidental-flat")!;
    const g = accidentalGlyphs[700].flat;
    const em = (v: string) => Number(v.replace(/em$/, ""));
    expect(em(svg.style.width)).toBeCloseTo((g.advance * RAISED_SCALE) / 1000, 5);
    expect(em(svg.style.height)).toBeCloseTo((1050 * RAISED_SCALE) / 1000, 5);
    // The svg's bottom sits 250*s under the glyph's baseline; the glyph's top
    // (yMax*s above its baseline) lands on cap height.
    const lift = ACCIDENTAL_METRICS.capHeight[700] - glyphBounds(g).yMax * RAISED_SCALE;
    expect(em(svg.style.verticalAlign)).toBeCloseTo((lift - 250 * RAISED_SCALE) / 1000, 5);
    expect(container.querySelector(".chord-text")!.getAttribute("data-accidentals")).toBe("raised");
  });

  it("keeps full-size accidentals by default", () => {
    const { container } = render(<ChordText text="Eb" weight={700} />);
    const svg = container.querySelector<SVGElement>("svg.chord-accidental-flat")!;
    expect(svg.style.width).toBe(`${accidentalGlyphs[700].flat.advance / 1000}em`);
    expect(svg.style.verticalAlign).toBe("-0.25em");
  });

  it("is plain text when there is nothing to draw", () => {
    const { container } = render(<ChordText text="Cmaj7" className="chord-title" />);
    expect(container.querySelector(".chord-text")!.className).toContain("chord-title");
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    expect(container.textContent).toContain("Cmaj7");
  });
});
