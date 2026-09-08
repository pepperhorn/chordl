import { describe, it, expect } from "vitest";
import { render, fireEvent, waitFor, within } from "@testing-library/react";
import { InteractiveInput } from "../dev/App";

/**
 * Coverage for the guitar experience-level radio group that moved into the
 * annotations row (previously GuitarChordPanel's own pill toggle, deleted in
 * this branch). Nothing exercised it directly before: `LevelControl` had no
 * test of its own, and the panel-level tests only drive the `level` prop by
 * hand.
 */

function levelRadio(container: HTMLElement, label: "Beginner" | "Emerging" | "Established") {
  const item = within(container)
    .getByText("Level", { selector: ".control-label" })
    .closest(".level-control") as HTMLElement;
  return within(item).getByLabelText(label) as HTMLInputElement;
}

function displayToggleButton(container: HTMLElement) {
  const item = within(container)
    .getByText("Display", { selector: ".control-label" })
    .closest(".control-item") as HTMLElement;
  return item.querySelector("button") as HTMLButtonElement;
}

describe("InteractiveInput level control", () => {
  it("renders with Emerging checked by default", () => {
    const { container } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );
    expect(levelRadio(container, "Beginner").checked).toBe(false);
    expect(levelRadio(container, "Emerging").checked).toBe(true);
    expect(levelRadio(container, "Established").checked).toBe(false);
  });

  it("is not disabled while the display mode is guitar, unlike its row-mates", async () => {
    // The exact contract InteractiveInput.annotation-disabled.test.tsx polices
    // for Note names/Degrees/Fingering — but this control is meaningful in
    // guitar mode (it's the guitar filter itself), so it must stay usable
    // rather than grey out with the keyboard/staff-only controls.
    const { container } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );
    const display = displayToggleButton(container);
    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Both"));
    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Notation"));
    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Guitar"));

    for (const label of ["Beginner", "Emerging", "Established"] as const) {
      const radio = levelRadio(container, label);
      expect(radio.matches(":disabled")).toBe(false);
      expect(radio.disabled).toBe(false);
    }
  });

  it("clicking a radio changes which guitar shapes are shown", async () => {
    // Am: one beginner-tier shape (so the position toggle disappears
    // entirely — it only renders for >1 visible placement), two emerging-or-
    // -below shapes, four established-or-below. A real, multi-tier chord.
    const { container, getByPlaceholderText } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );
    fireEvent.change(getByPlaceholderText(/tell me what chord/i), { target: { value: "Am" } });

    const display = displayToggleButton(container);
    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Both"));
    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Notation"));
    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Guitar"));

    await waitFor(() => {
      expect(container.querySelectorAll(".bc-guitar-position-btn").length).toBe(2);
    });

    fireEvent.click(levelRadio(container, "Beginner"));
    await waitFor(() => {
      expect(container.querySelectorAll(".bc-guitar-position-btn").length).toBe(0);
    });

    fireEvent.click(levelRadio(container, "Established"));
    await waitFor(() => {
      expect(container.querySelectorAll(".bc-guitar-position-btn").length).toBe(4);
    });
  });

  it("clicking a radio changes the piano voicings shown, in Keyboard mode too", async () => {
    // Proves the control is no longer inert on the piano side (Task 6 of the
    // piano-experience-levels plan) — until now this radio only ever drove
    // GuitarChordPanel. Default display mode is already "keyboard", so no
    // display toggling is needed here, unlike the guitar case above.
    //
    // "Cmaj7 rootless style" forces slot A to the Rootless Type A library
    // entry (level emerging) ahead of two plain inversions of the resolved
    // notes (level beginner — a core maj7 stays within the beginner span in
    // every rotation). That mix is what makes Beginner narrower than
    // Emerging/Established here; see VoicingVariantToggle.experience.test.tsx
    // for why a plain chord name like "C7" would not do this (every rotation
    // of a core-quality chord lands on the same rung).
    const { container, getByPlaceholderText } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );
    fireEvent.change(getByPlaceholderText(/tell me what chord/i), {
      target: { value: "Cmaj7 rootless style" },
    });

    // Default level is "emerging" (see the first test above), which already
    // matches all 3 generated variants (the library entry is itself emerging,
    // and beginner matches cumulatively within it).
    await waitFor(() => {
      expect(container.querySelectorAll(".variant-pill").length).toBe(3);
    });

    fireEvent.click(levelRadio(container, "Beginner"));
    await waitFor(() => {
      expect(container.querySelectorAll(".variant-pill").length).toBe(2);
    });

    fireEvent.click(levelRadio(container, "Established"));
    await waitFor(() => {
      expect(container.querySelectorAll(".variant-pill").length).toBe(3);
    });
  });
});
