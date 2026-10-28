import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PianoChord } from "../src/components/PianoChord";
import { VoicingVariantToggle } from "../src/components/VoicingVariantToggle";

/** Throws rather than returning null so two collapsed sizes cannot pass as equal. */
const fontOf = (container: HTMLElement, selector: string): number => {
  const el = container.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`no element matched ${selector}`);
  const size = parseFloat(el.style.fontSize);
  if (!Number.isFinite(size)) throw new Error(`${selector} has no font size`);
  return size;
};
const nameFont = (c: HTMLElement) => fontOf(c, ".bc-note-name");
const names = (c: HTMLElement) => c.querySelectorAll(".bc-note-name");
const fillsOf = (c: HTMLElement) => [...c.querySelectorAll("rect")].map((r) => r.getAttribute("fill"));

describe("PianoChord card-wide defaults", () => {
  it("draws no note names without props or NL", () => {
    const { container } = render(<PianoChord chord="C" />);
    expect(names(container)).toHaveLength(0);
  });

  it("draws default note names on a plain chord", () => {
    const { container } = render(<PianoChord chord="C" showNoteNames noteNameSize="xl" />);
    const ref = render(<PianoChord chord="C note names in xl" />);
    expect(names(container)).toHaveLength(3);
    expect(nameFont(container)).toBe(nameFont(ref.container));
  });

  it("the chord's own size wins", () => {
    const { container } = render(<PianoChord chord="C note names in base" showNoteNames noteNameSize="xl" />);
    const base = render(<PianoChord chord="C note names in base" />);
    const xl = render(<PianoChord chord="C note names in xl" />);
    expect(nameFont(container)).toBe(nameFont(base.container));
    expect(nameFont(container)).toBeLessThan(nameFont(xl.container));
  });

  it("an NL without a size takes the default size", () => {
    const { container } = render(<PianoChord chord="C with note names" noteNameSize="xl" />);
    const xl = render(<PianoChord chord="C note names in xl" />);
    expect(nameFont(container)).toBe(nameFont(xl.container));
  });

  it("default MIDI mode labels octaves", () => {
    const { container } = render(<PianoChord chord="C" showNoteNames noteNameMode="midi" />);
    const texts = [...names(container)].map((n) => n.textContent ?? "");
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toMatch(/\d$/);
  });

  it("the chord's MIDI request wins over a pitch-class default", () => {
    const { container } = render(<PianoChord chord="C midi note names" showNoteNames noteNameMode="pitch-class" />);
    const texts = [...names(container)].map((n) => n.textContent ?? "");
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t).toMatch(/\d$/);
  });

  it("adds the default note names under a degrees-only chord", () => {
    const { container } = render(<PianoChord chord="C with degrees" showNoteNames />);
    expect(names(container)).toHaveLength(3);
    expect(container.querySelectorAll(".bc-degree-label")).toHaveLength(3);
  });

  it("applies to scales", () => {
    const { container } = render(<PianoChord chord="C major scale" showNoteNames />);
    expect(names(container).length).toBeGreaterThanOrEqual(7);
  });

  it("applies to bass chords", () => {
    const { container } = render(<PianoChord chord="C/F" showNoteNames />);
    expect(names(container).length).toBeGreaterThan(0);
  });

  it("applies to hand groups", () => {
    const { container } = render(<PianoChord chord="Rh c d e LH c e" showNoteNames />);
    expect(names(container).length).toBeGreaterThan(0);
  });

  it("applies to the keyboard half of display=both", () => {
    const { container } = render(<PianoChord chord="C" display="both" showNoteNames />);
    expect(container.querySelector(".bc-display-both .bc-note-name")).not.toBeNull();
  });

  it("staff-only draws no note names", () => {
    const { container } = render(<PianoChord chord="C" display="staff" showNoteNames />);
    expect(names(container)).toHaveLength(0);
  });

  it("theme prop colours the keys and the NL theme still wins", () => {
    const themed = fillsOf(render(<PianoChord chord="C" theme="crf" />).container);
    expect(themed).toContain("#f86e6e");
    const boom = fillsOf(render(<PianoChord chord="C boomwhacker" theme="crf" />).container);
    expect(boom).toContain("#e81c1c");
    expect(boom).not.toContain("#f86e6e");
  });

  it("VoicingVariantToggle passes the defaults through", () => {
    const { container } = render(<VoicingVariantToggle chord="C" showNoteNames noteNameSize="xl" />);
    expect(container.querySelector(".bc-note-name")).not.toBeNull();
  });
});
