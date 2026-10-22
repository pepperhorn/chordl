// @vitest-environment jsdom
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChordText } from "../src/ChordText";
import { accidentalGlyphs } from "../src/accidentals";

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

  it("is plain text when there is nothing to draw", () => {
    const { container } = render(<ChordText text="Cmaj7" className="chord-title" />);
    expect(container.querySelector(".chord-text")!.className).toContain("chord-title");
    expect(container.querySelectorAll("svg")).toHaveLength(0);
    expect(container.textContent).toContain("Cmaj7");
  });
});
