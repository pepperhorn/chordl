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

  /**
   * The reported string used to be rebuilt from the parsed chord name plus a
   * hand-kept list of clauses to re-emit. Every clause missing from that list
   * was dropped on the first pill click — and once the host writes the report
   * onto a board card, dropped for good. These two were never on the list.
   */
  it.each([
    ["C 2 octaves", /2 octaves/],
    ["C spanning C to B", /spanning C to B/],
    ["C with 2 notes on either side", /2 notes on either side/],
    ["C over E", /over E/],
  ])("keeps %s intact when a variant pill is clicked", (chord, clause) => {
    const onVariantChange = vi.fn();
    const { container } = render(
      <VoicingVariantToggle chord={chord} onVariantChange={onVariantChange} />,
    );

    const pills = [...container.querySelectorAll<HTMLButtonElement>("button.variant-pill")];
    expect(pills.length).toBeGreaterThan(1);
    fireEvent.click(pills[1]);

    const reported = onVariantChange.mock.calls.at(-1)?.[0] as string;
    expect(reported).toMatch(/starting on/);
    expect(reported).toMatch(clause);
  });

  /**
   * The other half of the swap: a clause that *does* name a voicing has to be
   * replaced rather than accumulated, or two rotations end up in one string and
   * the second one wins over the variant the user actually clicked.
   */
  it("replaces an existing starting-on clause rather than appending to it", () => {
    const onVariantChange = vi.fn();
    const { container } = render(
      <VoicingVariantToggle chord="C starting on G with note names" onVariantChange={onVariantChange} />,
    );

    const pills = [...container.querySelectorAll<HTMLButtonElement>("button.variant-pill")];
    fireEvent.click(pills[1]);

    const reported = onVariantChange.mock.calls.at(-1)?.[0] as string;
    expect(reported.match(/starting on/g)).toHaveLength(1);
    expect(reported).toMatch(/note names/);
  });
});
