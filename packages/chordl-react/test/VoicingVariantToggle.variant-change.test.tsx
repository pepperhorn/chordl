import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { VoicingVariantToggle } from "../src/components/VoicingVariantToggle";

/**
 * The toggle rebuilds a chord string for the variant on screen and hands it to
 * `PianoChord`. Until `onVariantChange` existed that string was unreachable
 * from outside, so a host could draw the right voicing and still have no idea
 * what it was — which is how "+ Add to board" kept storing the default one.
 */
describe("VoicingVariantToggle onVariantChange", () => {
  it("reports the rebuilt chord string when a variant pill is clicked", () => {
    const onVariantChange = vi.fn();
    const { container } = render(
      <VoicingVariantToggle chord="C" onVariantChange={onVariantChange} />,
    );

    const pills = [...container.querySelectorAll<HTMLButtonElement>("button.variant-pill")];
    expect(pills.length).toBeGreaterThan(1);
    fireEvent.click(pills[1]);

    const reported = onVariantChange.mock.calls.at(-1)?.[0] as string;
    expect(reported).toMatch(/starting on/);
  });
});
