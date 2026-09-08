import { describe, it, expect } from "vitest";
import { EXPERIENCE_LADDER as GUITAR_LADDER } from "@pepperhorn/chordl-guitar";
import { EXPERIENCE_LADDER as PIANO_LADDER } from "@pepperhorn/chordl-voicings";

describe("the experience ladder", () => {
  /*
   * The two packages declare this type separately and must never disagree.
   * They cannot share it: chordl-guitar depends on no workspace package and
   * must keep publishing standalone, and chordl-core already depends on
   * chordl-voicings, so importing back is a cycle. Duplication pinned by a
   * test is the house pattern for exactly this — see build-top3.mjs and
   * DIAGRAM_FRETS.
   *
   * If this fails, do not "fix" it by editing one side to match. Work out
   * which change was intended and apply it to both.
   */
  it("is identical in chordl-guitar and chordl-voicings", () => {
    expect(PIANO_LADDER).toEqual(GUITAR_LADDER);
  });

  it("runs easiest first, which indexOf-based widening depends on", () => {
    expect(GUITAR_LADDER).toEqual(["beginner", "emerging", "established"]);
  });
});
