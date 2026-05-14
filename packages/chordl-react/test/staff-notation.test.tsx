import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StaffNotation } from "../src/components/StaffNotation";

describe("StaffNotation", () => {
  it("renders an SVG element", () => {
    const { container } = render(<StaffNotation notes={["C", "E", "G"]} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders 5 staff lines for treble-only", () => {
    const { container } = render(<StaffNotation notes={["E", "G", "B"]} />);
    const lines = container.querySelectorAll(".bc-staff__line");
    expect(lines.length).toBe(5);
  });

  it("renders 10 staff lines for grand staff", () => {
    const { container } = render(
      <StaffNotation notes={["C", "E", "G"]} lhNotes={["C"]} lhOctave={3} rhOctave={4} />,
    );
    const lines = container.querySelectorAll(".bc-staff__line");
    expect(lines.length).toBe(10);
  });

  it("renders correct number of noteheads", () => {
    const { container } = render(<StaffNotation notes={["C", "E", "G", "B"]} />);
    const noteheads = container.querySelectorAll(".bc-staff__notehead");
    expect(noteheads.length).toBe(4);
  });

  it("renders ledger line for middle C", () => {
    const { container } = render(<StaffNotation notes={["C"]} rhOctave={4} />);
    const ledgers = container.querySelectorAll(".bc-staff__ledger");
    expect(ledgers.length).toBeGreaterThan(0);
  });

  it("renders chord label", () => {
    const { container } = render(<StaffNotation notes={["C", "E", "G"]} chordLabel="Cmaj" />);
    const label = container.querySelector(".bc-staff__label");
    expect(label).toBeTruthy();
    expect(label?.textContent).toBe("Cmaj");
  });

  it("has data-controls attribute for export compatibility", () => {
    const { container } = render(<StaffNotation notes={["C", "E", "G"]} showPlayback />);
    const controls = container.querySelector("[data-controls]");
    expect(controls).toBeTruthy();
  });

  it("renders treble-only for high notes", () => {
    const { container } = render(<StaffNotation notes={["E", "G", "B"]} rhOctave={4} />);
    const treble = container.querySelector(".bc-staff__treble");
    const bass = container.querySelector(".bc-staff__bass");
    expect(treble).toBeTruthy();
    expect(bass).toBeFalsy();
  });

  it("renders accidentals for sharped notes", () => {
    const { container } = render(<StaffNotation notes={["C#", "E", "G#"]} />);
    const accidentals = container.querySelectorAll(".bc-staff__accidental");
    expect(accidentals.length).toBe(2);
  });

  it("renders with bc-staff class", () => {
    const { container } = render(<StaffNotation notes={["C"]} />);
    const svg = container.querySelector(".bc-staff");
    expect(svg).toBeTruthy();
  });
});
