import { describe, it, expect } from "vitest";
import { solvePolychord, solveSlashChord } from "../src/index";

describe("solvePolychord", () => {
  it("places upper triad in RH, bass in LH for non-dom lower", () => {
    // D triad over C bass
    const result = solvePolychord(
      { root: "D", quality: "maj" },
      { root: "C", quality: "maj" }
    );
    expect(result.length).toBeGreaterThanOrEqual(2);
    const lhNotes = result.filter((n) => n.hand === "LH");
    const rhNotes = result.filter((n) => n.hand === "RH");
    expect(lhNotes.length).toBe(1); // just bass note
    expect(lhNotes[0].pitchClass).toBe("C");
    expect(rhNotes.length).toBeGreaterThanOrEqual(3); // triad
  });

  it("uses tritone shell for dom7 lower chord", () => {
    // D triad over C7
    const result = solvePolychord(
      { root: "D", quality: "maj" },
      { root: "C", quality: "dom7" }
    );
    const lhNotes = result.filter((n) => n.hand === "LH");
    expect(lhNotes.length).toBe(2); // 3rd + b7th
    // C7 tritone shell: E (3rd) and Bb (b7th)
    const lhPCs = lhNotes.map((n) => n.pitchClass);
    expect(lhPCs).toContain("E");
  });

  it("sorts all notes by MIDI ascending", () => {
    const result = solvePolychord(
      { root: "E", quality: "m" },
      { root: "G", quality: "7" }
    );
    for (let i = 1; i < result.length; i++) {
      expect(result[i].midi).toBeGreaterThanOrEqual(result[i - 1].midi);
    }
  });
});

describe("solveSlashChord", () => {
  it("puts bass note in LH octave 3", () => {
    const result = solveSlashChord(["C", "E", "G"], "E");
    const lh = result.filter((n) => n.hand === "LH");
    expect(lh.length).toBe(1);
    expect(lh[0].pitchClass).toBe("E");
    expect(lh[0].note).toContain("3"); // octave 3
  });

  it("avoids doubling bass note in RH", () => {
    const result = solveSlashChord(["C", "E", "G"], "E");
    const rh = result.filter((n) => n.hand === "RH");
    // E removed from RH since it's in LH — C and G remain
    expect(rh.length).toBe(2);
    const rhPCs = rh.map((n) => n.pitchClass);
    expect(rhPCs).toContain("C");
    expect(rhPCs).toContain("G");
  });

  it("keeps all chord notes if bass note is not in chord", () => {
    const result = solveSlashChord(["C", "E", "G"], "F");
    const rh = result.filter((n) => n.hand === "RH");
    expect(rh.length).toBe(3); // all original notes
  });

  it("sorts by MIDI ascending", () => {
    const result = solveSlashChord(["C", "E", "G", "B"], "G");
    for (let i = 1; i < result.length; i++) {
      expect(result[i].midi).toBeGreaterThanOrEqual(result[i - 1].midi);
    }
  });
});
