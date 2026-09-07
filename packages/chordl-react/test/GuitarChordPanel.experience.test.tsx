import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuitarChordPanel } from "../src/components/GuitarChordPanel";

describe("GuitarChordPanel experience controls", () => {
  it("offers the three levels", () => {
    render(<GuitarChordPanel chord="C" />);
    for (const level of ["Beginner", "Emerging", "Established"]) {
      expect(screen.getByRole("button", { name: level })).toBeTruthy();
    }
  });

  it("has no hide-barres checkbox any more", () => {
    render(<GuitarChordPanel chord="C" />);
    expect(screen.queryByLabelText(/barre/i)).toBeNull();
  });

  it("says so when a level had to widen", () => {
    // F has no open shape, so a beginner request must widen and admit it.
    render(<GuitarChordPanel chord="F" level="beginner" />);
    expect(screen.getByText(/no beginner shape/i)).toBeTruthy();
  });

  it("still renders a diagram when the level is empty", () => {
    const { container } = render(<GuitarChordPanel chord="F" level="beginner" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
