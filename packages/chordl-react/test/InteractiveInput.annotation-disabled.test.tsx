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

const EXPECTED_TITLE = "Applies to the keyboard and staff, not to guitar frames";

/**
 * Asserts the full disabled/enabled contract for one control: the button and
 * select's `disabled`/`aria-disabled`, the `annotation-control--disabled`
 * class, and the explanatory `title` — present with the exact wording when
 * disabled, absent otherwise. Checked at every display mode the test passes
 * through, not just the keyboard/guitar endpoints, so a condition like
 * `displayMode !== "keyboard"` (which would also grey out Both and Notation)
 * cannot slip past on the intermediate modes.
 */
function expectAnnotationState(container: HTMLElement, label: string, disabled: boolean) {
  const { toggle, select, control } = annotationParts(container, label);
  expect(toggle.disabled).toBe(disabled);
  expect(toggle.getAttribute("aria-disabled")).toBe(String(disabled));
  expect(select).not.toBeNull();
  expect(select!.disabled).toBe(disabled);
  // The Options menu's radio groups (Note names' "Names" group, Fingering's
  // mode group) must be disabled in lockstep with the toggle/select above —
  // greying the container while leaving its radios clickable was the bug.
  // Degrees has no Options menu, so this is an empty (harmless) check there.
  //
  // `<fieldset disabled>` cascades to descendant form controls via the
  // `:disabled` CSS pseudo-class, not the `.disabled` IDL property — a
  // radio's own `.disabled` reflects only its own content attribute in both
  // real browsers and jsdom, and stays `false` even when an ancestor
  // fieldset disables it. `matches(":disabled")` is the correct check for
  // "is this control actually disabled right now".
  const radios = control.querySelectorAll('input[type="radio"]');
  for (const radio of Array.from(radios) as HTMLInputElement[]) {
    expect(radio.matches(":disabled")).toBe(disabled);
  }
  if (disabled) {
    expect(control.className).toContain("annotation-control--disabled");
    expect(control.getAttribute("title")).toBe(EXPECTED_TITLE);
  } else {
    expect(control.className).not.toContain("annotation-control--disabled");
    expect(control.getAttribute("title")).toBeNull();
  }
}

const LABELS = ["Note names", "Degrees", "Fingering"];

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

    // DISPLAY_MODES cycles Diagram (keyboard) -> Both -> Notation (staff) ->
    // Guitar -> back to Diagram. Assert after *every* step: the point isn't
    // just that guitar disables the controls, it's that nothing else does.
    const display = displayToggleButton(container);

    // Baseline: keyboard mode (the default), all enabled.
    for (const label of LABELS) expectAnnotationState(container, label, false);

    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Both"));
    for (const label of LABELS) expectAnnotationState(container, label, false);

    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Notation"));
    for (const label of LABELS) expectAnnotationState(container, label, false);

    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Guitar"));
    for (const label of LABELS) expectAnnotationState(container, label, true);

    // Cycle back around to Diagram (keyboard) and confirm re-enabling.
    fireEvent.click(display);
    await waitFor(() => expect(display.textContent).toContain("Diagram"));
    for (const label of LABELS) expectAnnotationState(container, label, false);
  });
});
