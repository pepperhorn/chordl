import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VoicingVariantToggle } from "../src/components/VoicingVariantToggle";

/**
 * Coverage for the piano-side experience-level filter (Task 6 of the piano
 * experience levels plan). The plan's own draft used a placeholder
 * ".voicing-variant-btn" selector and a "C7alt" chord string; neither
 * survives contact with the real code:
 *
 * - The A/B/C buttons carry the class "variant-pill" (see
 *   VoicingVariantToggle.tsx's render), not "voicing-variant-btn".
 * - `parseChordDescription`'s CHORD_RE has no "alt" token
 *   (packages/chordl-core/src/parser/natural-language.ts), so "C7alt" parses
 *   to plain "C7" and silently drops the alteration — it does not produce an
 *   alt chord. "C7#5#9" does (digits/# are matched directly by CHORD_RE) and
 *   resolves to quality "alt", so it stands in for the plan's "C7alt".
 *
 * "Cmaj7 rootless style" is chosen for the count test because it is the
 * simplest real chord whose default three generated variants are NOT all the
 * same level: forcing slot A to the "Rootless Type A" library entry (level
 * emerging) ahead of two plain inversions of the resolved notes (level
 * beginner, since a core maj7 stays within the beginner span in every
 * rotation — see chordl-voicings/test/experience.test.ts). A plain chord
 * name like "C7" doesn't work here: its first three generated variants are
 * always the same three notes in different rotations, and every core-quality
 * rotation lands on the same rung (that's deliberate — see levelForVoicing's
 * "ranks every inversion of a core seventh beginner" test) — so a beginner
 * request and an established request select the identical set and the counts
 * never differ.
 */
describe("VoicingVariantToggle level filtering", () => {
  it("offers fewer variants at a lower rung", () => {
    const { container: est } = render(
      <VoicingVariantToggle chord="Cmaj7 rootless style" level="established" />,
    );
    const estCount = est.querySelectorAll(".variant-pill").length;
    const { container: beg } = render(
      <VoicingVariantToggle chord="Cmaj7 rootless style" level="beginner" />,
    );
    const begCount = beg.querySelectorAll(".variant-pill").length;
    expect(begCount).toBeLessThan(estCount);
  });

  it("says so when the level had to widen", () => {
    render(<VoicingVariantToggle chord="C7#5#9" level="beginner" />);
    expect(screen.getByText(/no beginner voicing/i)).toBeTruthy();
  });

  it("still shows a chord when no variant matches the rung", () => {
    const { container } = render(<VoicingVariantToggle chord="C7#5#9" level="beginner" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
