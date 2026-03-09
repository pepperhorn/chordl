import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ChordSheet } from "../src/components/ChordSheet";
import type { ChordSheetData } from "@better-chord/core";

const SINGLE_SECTION: ChordSheetData = {
  v: "1.0",
  heading: "Jazz Shells",
  subheading: "Basic voicings",
  sections: [
    {
      heading: "Section A",
      subheading: "ii-V-I",
      textAbove: "Play slowly",
      textBelow: "Repeat 4x",
      chords: [
        { chord: "Dm7", chordHeading: "ii", annotationText: "shell voicing" },
        { chord: "G7", chordHeading: "V" },
        { chord: "Cmaj7", chordHeading: "I" },
      ],
    },
  ],
};

const MULTI_SECTION: ChordSheetData = {
  v: "1.0",
  heading: "Full Sheet",
  sections: [
    { chords: [{ chord: "Dm7" }, { chord: "G7" }] },
    { id: "B", chords: [{ chord: "Cmaj7" }] },
  ],
};

describe("ChordSheet", () => {
  it("renders heading and subheading", () => {
    const { container } = render(<ChordSheet data={SINGLE_SECTION} />);
    const heading = container.querySelector(".bc-chord-sheet__heading");
    const sub = container.querySelector(".bc-chord-sheet__subheading");
    expect(heading?.textContent).toBe("Jazz Shells");
    expect(sub?.textContent).toBe("Basic voicings");
  });

  it("renders section headings", () => {
    const { container } = render(<ChordSheet data={SINGLE_SECTION} />);
    const sectionHeading = container.querySelector(".bc-chord-sheet__section-heading");
    expect(sectionHeading?.textContent).toBe("Section A");
    const sectionSub = container.querySelector(".bc-chord-sheet__section-subheading");
    expect(sectionSub?.textContent).toBe("ii-V-I");
  });

  it("renders correct number of chord containers", () => {
    const { container } = render(<ChordSheet data={SINGLE_SECTION} />);
    const chords = container.querySelectorAll(".bc-chord-sheet__chord");
    expect(chords.length).toBe(3);
  });

  it("renders text above and below sections", () => {
    const { container } = render(<ChordSheet data={SINGLE_SECTION} />);
    const above = container.querySelector(".bc-chord-sheet__text--above");
    const below = container.querySelector(".bc-chord-sheet__text--below");
    expect(above?.textContent).toBe("Play slowly");
    expect(below?.textContent).toBe("Repeat 4x");
  });

  it("chordHeading overrides display", () => {
    const { container } = render(<ChordSheet data={SINGLE_SECTION} />);
    const headings = container.querySelectorAll(".bc-chord-sheet__chord-heading");
    expect(headings[0]?.textContent).toBe("ii");
    expect(headings[1]?.textContent).toBe("V");
  });

  it("annotationText renders per chord", () => {
    const { container } = render(<ChordSheet data={SINGLE_SECTION} />);
    const annotations = container.querySelectorAll(".bc-chord-sheet__annotation");
    expect(annotations.length).toBe(1);
    expect(annotations[0]?.textContent).toBe("shell voicing");
  });

  it("BEM class names present", () => {
    const { container } = render(<ChordSheet data={SINGLE_SECTION} />);
    expect(container.querySelector(".bc-chord-sheet")).toBeTruthy();
    expect(container.querySelector(".bc-chord-sheet__section")).toBeTruthy();
    expect(container.querySelector(".bc-chord-sheet__grid")).toBeTruthy();
    expect(container.querySelector(".bc-chord-sheet__chord")).toBeTruthy();
  });

  it("renders chord refs for single section (no letter prefix)", () => {
    const { container } = render(<ChordSheet data={SINGLE_SECTION} />);
    const refs = container.querySelectorAll(".bc-chord-sheet__chord-ref");
    expect(refs[0]?.textContent).toBe("1");
    expect(refs[2]?.textContent).toBe("3");
  });

  it("renders chord refs for multi-section (letter prefix)", () => {
    const { container } = render(<ChordSheet data={MULTI_SECTION} />);
    const refs = container.querySelectorAll(".bc-chord-sheet__chord-ref");
    expect(refs[0]?.textContent).toBe("A1");
    expect(refs[1]?.textContent).toBe("A2");
    expect(refs[2]?.textContent).toBe("B1");
  });

  it("hides chord refs in printMode", () => {
    const { container } = render(<ChordSheet data={SINGLE_SECTION} printMode />);
    const refs = container.querySelectorAll(".bc-chord-sheet__chord-ref");
    expect(refs.length).toBe(0);
  });

  it("error boundary isolates bad chord strings", () => {
    const badData: ChordSheetData = {
      v: "1.0",
      sections: [{
        chords: [
          { chord: "Cmaj7" },
          { chord: "ZZZZZ_not_a_chord_at_all!!!" },
          { chord: "G7" },
        ],
      }],
    };
    // Should not throw — bad chord is isolated
    const { container } = render(<ChordSheet data={badData} />);
    const chords = container.querySelectorAll(".bc-chord-sheet__chord");
    expect(chords.length).toBe(3);
  });
});
