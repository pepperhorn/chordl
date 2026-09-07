import { describe, it, expect } from "vitest";
import { render, fireEvent, waitFor, within } from "@testing-library/react";
import { InteractiveInput } from "../dev/App";

/**
 * GuitarChordPanel ignores note names, degrees and fingering entirely — they
 * are keyboard/staff concerns. Before this fix the three annotation controls
 * sat fully enabled next to a guitar frame and did nothing when clicked. This
 * pins the fix: the toggle button and size <select> for each control must be
 * disabled while the display mode is guitar, and re-enabled otherwise.
 */

function annotationParts(container: HTMLElement, label: string) {
  // `.control-label` disambiguates from a same-named <legend> inside the
  // control's own options menu (e.g. Fingering's fieldset legend is also
  // "Fingering" once the control is switched on).
  const control = within(container)
    .getByText(label, { selector: ".control-label" })
    .closest(".annotation-control") as HTMLElement;
  const toggle = control.querySelector("button.annotation-toggle") as HTMLButtonElement;
  const select = control.querySelector("select.annotation-size") as HTMLSelectElement | null;
  return { control, toggle, select };
}

function displayToggleButton(container: HTMLElement) {
  const item = within(container)
    .getByText("Display", { selector: ".control-label" })
    .closest(".control-item") as HTMLElement;
  return item.querySelector("button") as HTMLButtonElement;
}

describe("InteractiveInput annotation controls on guitar display", () => {
  it("disables Note names, Degrees and Fingering only while the display mode is guitar", async () => {
    const { container } = render(
      <InteractiveInput uiTheme="light" showOptions={false} onToggleOptions={() => {}} />,
    );

    // Turn all three on first, while still in keyboard mode, so their size
    // selects mount — a disabled toggle can't be clicked later to reveal them.
    const noteNames = annotationParts(container, "Note names");
    const degrees = annotationParts(container, "Degrees");
    const fingering = annotationParts(container, "Fingering");
    fireEvent.click(noteNames.toggle);
    fireEvent.click(degrees.toggle);
    fireEvent.click(fingering.toggle);

    // Baseline: enabled in keyboard mode (the default), with selects visible.
    for (const label of ["Note names", "Degrees", "Fingering"]) {
      const { toggle, select, control } = annotationParts(container, label);
      expect(toggle.disabled).toBe(false);
      expect(toggle.getAttribute("aria-disabled")).toBe("false");
      expect(select).not.toBeNull();
      expect(select!.disabled).toBe(false);
      expect(control.className).not.toContain("annotation-control--disabled");
    }

    // Cycle Diagram (keyboard) -> Both -> Notation (staff) -> Guitar.
    const display = displayToggleButton(container);
    fireEvent.click(display);
    fireEvent.click(display);
    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Guitar"));

    for (const label of ["Note names", "Degrees", "Fingering"]) {
      const { toggle, select, control } = annotationParts(container, label);
      expect(toggle.disabled).toBe(true);
      expect(toggle.getAttribute("aria-disabled")).toBe("true");
      expect(select).not.toBeNull();
      expect(select!.disabled).toBe(true);
      expect(control.className).toContain("annotation-control--disabled");
    }

    // Cycle back around to Diagram (keyboard) and confirm re-enabling.
    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Diagram"));

    for (const label of ["Note names", "Degrees", "Fingering"]) {
      const { toggle, select, control } = annotationParts(container, label);
      expect(toggle.disabled).toBe(false);
      expect(toggle.getAttribute("aria-disabled")).toBe("false");
      expect(select!.disabled).toBe(false);
      expect(control.className).not.toContain("annotation-control--disabled");
    }
  });
});
