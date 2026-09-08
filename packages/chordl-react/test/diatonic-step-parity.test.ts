import { describe, it, expect } from "vitest";
import { diatonicStep as reactDiatonicStep } from "../src/diatonic-step";
import { diatonicStep as voicingsDiatonicStep } from "@pepperhorn/chordl-voicings";

/*
 * `chordl-voicings`' `semitonesFromStack` needs the same letter-walk rule
 * `chordl-react`'s renderer stacks by, but the two packages cannot share the
 * function: `chordl-react` depends on `chordl-voicings`, so an import the
 * other way would be a cycle. `chordl-voicings` duplicates the small
 * `diatonicStep` helper instead — see its own copy's comment — and
 * `chordl-react` is the only package that depends on both, so this is where
 * the two copies get pinned together, the way `experience-ladder-parity`
 * pins `EXPERIENCE_LADDER`.
 *
 * If this fails, do not "fix" it by editing one side to match. Work out
 * which change was intended and apply it to both.
 */
describe("diatonicStep parity between chordl-react and chordl-voicings", () => {
  it("agrees on every natural, sharp and flat spelling", () => {
    const names = [
      "C", "C#", "Cb", "D", "D#", "Db", "E", "E#", "Eb",
      "F", "F#", "Fb", "G", "G#", "Gb", "A", "A#", "Ab",
      "B", "B#", "Bb",
    ];
    for (const name of names) {
      expect(voicingsDiatonicStep(name)).toBe(reactDiatonicStep(name));
    }
  });

  it("agrees that a flat keeps its own step rather than the letter below it", () => {
    // The bug both copies exist to prevent: Ab normalised to G# reads as step G.
    expect(voicingsDiatonicStep("Ab")).toBe(reactDiatonicStep("Ab"));
    expect(voicingsDiatonicStep("Ab")).not.toBe(voicingsDiatonicStep("G"));
  });
});
