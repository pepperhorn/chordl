import { describe, it, expect } from "vitest";
import { resolveChord } from "../src/resolver/chord-resolver";

describe("resolveChord", () => {
  it("resolves Cmaj7 to [C, E, G, B]", () => {
    const result = resolveChord("Cmaj7");
    expect(result.notes).toEqual(["C", "E", "G", "B"]);
  });

  it("resolves C major triad to [C, E, G]", () => {
    const result = resolveChord("C");
    expect(result.notes).toEqual(["C", "E", "G"]);
  });

  it("resolves Cm first inversion to [D#, G, C]", () => {
    const result = resolveChord("Cm", 1);
    expect(result.notes).toEqual(["D#", "G", "C"]);
  });

  it("resolves Cmaj7#5 to [C, E, G#, B]", () => {
    const result = resolveChord("Cmaj7#5");
    expect(result.notes).toEqual(["C", "E", "G#", "B"]);
  });

  it("resolves Dm7 to [D, F, A, C]", () => {
    const result = resolveChord("Dm7");
    expect(result.notes).toEqual(["D", "F", "A", "C"]);
  });

  it("normalizes flats to sharps", () => {
    const result = resolveChord("Bbmaj7");
    expect(result.notes).toContain("A#");
    expect(result.notes).not.toContain("Bb");
  });

  it("throws for unknown chords", () => {
    expect(() => resolveChord("Xmaj99")).toThrow("Unknown chord");
  });
});
