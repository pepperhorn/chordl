import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GuitarChordPanel } from "../src/components/GuitarChordPanel";

describe("GuitarChordPanel experience controls", () => {
  it("honours the level prop, without drawing its own control", () => {
    // The panel no longer renders a level toggle of its own — a host drives
    // `level` — but the prop must still change what's on screen. C has one
    // beginner-or-below shape (an open C) and four established-or-below
    // shapes, so the position toggle (only shown for >1 visible shape) is
    // absent at "beginner" and shows all four at "established".
    const { unmount } = render(<GuitarChordPanel chord="C" level="beginner" />);
    expect(screen.queryAllByRole("button", { name: /Beginner|Emerging|Established/ })).toHaveLength(0);
    expect(document.querySelectorAll(".bc-guitar-position-btn")).toHaveLength(0);
    unmount();

    render(<GuitarChordPanel chord="C" level="established" />);
    expect(document.querySelectorAll(".bc-guitar-position-btn")).toHaveLength(4);
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
