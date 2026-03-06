import { describe, it, expect } from "vitest";
import { generateLockedHands } from "../src/index";

describe("generateLockedHands", () => {
  it("returns 5 notes for a 4-note chord", () => {
    // G4 over Cmaj7 (C, E, G, B)
    const result = generateLockedHands("G4", "Cmaj7");
    expect(result.length).toBe(5);
  });

  it("has melody on top and doubled one octave below", () => {
    const result = generateLockedHands("G4", "Cmaj7");
    const midiValues = result.map((n) => n.midi);
    // Highest should be G4 (67), lowest should be G3 (55)
    expect(midiValues[midiValues.length - 1]).toBe(67); // G4
    expect(midiValues[0]).toBe(55); // G3
  });

  it("assigns bottom note to LH and rest to RH", () => {
    const result = generateLockedHands("G4", "Cmaj7");
    expect(result[0].hand).toBe("LH");
    for (let i = 1; i < result.length; i++) {
      expect(result[i].hand).toBe("RH");
    }
  });

  it("inner voices are chord tones in close position", () => {
    // B4 over Cmaj7 (C, E, G, B)
    const result = generateLockedHands("B4", "Cmaj7");
    // B4=71, close position below: G4=67, E4=64, C4=60, doubled: B3=59
    const midiValues = result.map((n) => n.midi);
    expect(midiValues).toContain(59); // B3 (doubled)
    expect(midiValues).toContain(60); // C4
    expect(midiValues).toContain(64); // E4
    expect(midiValues).toContain(67); // G4
    expect(midiValues).toContain(71); // B4
  });

  it("works with minor chords", () => {
    // Eb4 over Cm7 (C, Eb, G, Bb)
    const result = generateLockedHands("Eb4", "Cm7");
    expect(result.length).toBe(5);
    // Should not throw
  });

  it("throws for melody note not in chord", () => {
    expect(() => generateLockedHands("F4", "Cmaj7")).toThrow();
  });

  it("throws for invalid melody note", () => {
    expect(() => generateLockedHands("XYZ", "Cmaj7")).toThrow();
  });

  it("throws for unknown chord symbol", () => {
    expect(() => generateLockedHands("C4", "Xunknown")).toThrow();
  });
});
