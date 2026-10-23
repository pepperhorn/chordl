import { describe, it, expect } from "vitest";
import { fingeringFor, guitarLibraryPositionsFor, guitarPositionFor, positionSpellsChord, analyzeChordTones } from "../src/index";

describe("fingeringFor", () => {
  it("fingers an open C with individual fingers", () => {
    expect(fingeringFor([-1, 3, 2, 0, 1, 0])).toEqual({ fingers: [0, 3, 2, 0, 1, 0], barre: null, count: 3 });
  });

  it("barres an E-shape at the lowest fret", () => {
    const f = fingeringFor([8, 10, 10, 9, 8, 8]);
    expect(f?.barre).toBe(8);
    expect(f?.count).toBeLessThanOrEqual(4);
    expect(f?.fingers[0]).toBe(1);
  });

  it("refuses a stretch past the four-fret box low on the neck", () => {
    expect(fingeringFor([1, -1, 5, -1, -1, -1])).toBeNull();
  });

  it("allows a five-fret box above the 5th fret", () => {
    expect(fingeringFor([-1, 8, -1, 10, 12, -1])).not.toBeNull();
  });

  it("refuses a partial barre with a lower string reaching back over it (x-15-14-12-13-12)", () => {
    expect(fingeringFor([-1, 15, 14, 12, 13, 12])).toBeNull();
  });

  it("works on four strings (ukulele C up an octave)", () => {
    expect(fingeringFor([12, 12, 12, 15])).not.toBeNull();
  });
});

describe("guitarLibraryPositionsFor", () => {
  it("lists every chords-db C position that spells C, the first being guitarPositionFor's", () => {
    const c = { root: "C", pitchClasses: ["C", "E", "G"] };
    const all = guitarLibraryPositionsFor(c);
    expect(all.length).toBeGreaterThan(1);
    const first = guitarPositionFor(c)!;
    expect(all[0].frets).toEqual(first.frets);
    expect(all[0].baseFret).toBe(first.baseFret);
    const analysis = analyzeChordTones("C", ["C", "E", "G"]);
    for (const p of all) {
      expect(p.generated).toBe(false);
      expect(p.source).toBe("chords-db");
      expect(positionSpellsChord(p, analysis)).toBe(true);
    }
  });

  it("drops chords-db positions that do not spell the chord (C9's first has no b7)", () => {
    const c9 = { root: "C", pitchClasses: ["C", "E", "G", "Bb", "D"] };
    const analysis = analyzeChordTones("C", c9.pitchClasses);
    for (const p of guitarLibraryPositionsFor(c9)) expect(positionSpellsChord(p, analysis)).toBe(true);
  });

  it("is empty for a chord chords-db does not carry", () => {
    expect(guitarLibraryPositionsFor({ root: "C", pitchClasses: ["C", "E", "G#", "B", "D", "F#"] })).toEqual([]);
  });
});
