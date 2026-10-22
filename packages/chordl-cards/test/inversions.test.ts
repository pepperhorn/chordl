import { describe, expect, it } from "vitest";
import { inversionsFor } from "../src/inversions";
import { inversionsFor as fromModel } from "../src/model";

const rows = (symbol: string, opts?: Parameters<typeof inversionsFor>[1]) =>
  inversionsFor(symbol, opts).map((r) => [r.bassNote, r.notes.join(" "), r.slashName, r.figuredBass, r.label]);

describe("inversionsFor", () => {
  it("is exported from the model entry", () => {
    expect(fromModel).toBe(inversionsFor);
  });

  it("triads rotate, with 5/3 6/3 6/4", () => {
    expect(rows("C")).toEqual([
      ["C", "C E G", "C", "5/3", "C (root position)"],
      ["E", "E G C", "C/E", "6/3", "C/E (1st inv)"],
      ["G", "G C E", "C/G", "6/4", "C/G (2nd inv)"],
    ]);
    expect(rows("F#m").map((r) => r[1])).toEqual(["F# A C#", "A C# F#", "C# F# A"]);
    expect(inversionsFor("C").every((r) => r.stickyBass === null)).toBe(true);
  });

  it("sevenths have four rows: 7 6/5 4/3 4/2", () => {
    expect(rows("G7")).toEqual([
      ["G", "G B D F", "G7", "7", "G7 (root position)"],
      ["B", "B D F G", "G7/B", "6/5", "G7/B (1st inv)"],
      ["D", "D F G B", "G7/D", "4/3", "G7/D (2nd inv)"],
      ["F", "F G B D", "G7/F", "4/2", "G7/F (3rd inv)"],
    ]);
  });

  it("dim7 keeps the catalogue's 6th spelling (A, not Bbb)", () => {
    expect(rows("Cdim7")).toEqual([
      ["C", "C Eb Gb A", "Cdim7", "7", "Cdim7 (root position)"],
      ["Eb", "Eb Gb A C", "Cdim7/Eb", "6/5", "Cdim7/Eb (1st inv)"],
      ["Gb", "Gb A C Eb", "Cdim7/Gb", "4/3", "Cdim7/Gb (2nd inv)"],
      ["A", "A C Eb Gb", "Cdim7/A", "4/2", "Cdim7/A (3rd inv)"],
    ]);
  });

  it("a slash chord holds its bass by default; only the upper chord inverts", () => {
    expect(rows("Bb/C")).toEqual([
      ["C", "C Bb D F", "Bb/C", "5/3", "Bb/C (upper root position)"],
      ["C", "C D F Bb", "Bb/C", "6/3", "Bb/C (upper 1st inv)"],
      ["C", "C F Bb D", "Bb/C", "6/4", "Bb/C (upper 2nd inv)"],
    ]);
    const r = inversionsFor("Bb/C")[1];
    expect(r.stickyBass).toBe("C");
    expect(r.upper).toEqual(["D", "F", "Bb"]);
    // No "Bb/C/D"-style names.
    expect(inversionsFor("D7/C").map((x) => x.slashName)).toEqual(["D7/C", "D7/C", "D7/C", "D7/C"]);
    expect(rows("D7/C").map((x) => x[1])).toEqual(["C D F# A C", "C F# A C D", "C A C D F#", "C C D F# A"]);
    expect(rows("D7/C").map((x) => x[3])).toEqual(["7", "6/5", "4/3", "4/2"]);
  });

  it("a slash dim7 keeps the 6th spelling above the sticky bass", () => {
    expect(rows("Cdim7/Db").map((x) => x[1])).toEqual(["Db C Eb Gb A", "Db Eb Gb A C", "Db Gb A C Eb", "Db A C Eb Gb"]);
  });

  it("stickyBass: a note sets one; false inverts the upper chord alone", () => {
    expect(rows("Bb", { stickyBass: "C" })).toEqual(rows("Bb/C"));
    expect(rows("Bb/C", { stickyBass: false })).toEqual(rows("Bb"));
    expect(inversionsFor("Bb/C", { stickyBass: "D" }).map((r) => r.slashName)).toEqual(["Bb/D", "Bb/D", "Bb/D"]);
  });

  it("chords beyond four tones have no figured bass", () => {
    const nine = inversionsFor("C9");
    expect(nine).toHaveLength(5);
    expect(nine.map((r) => r.figuredBass)).toEqual(["", "", "", "", ""]);
    expect(nine[4].label).toBe("C9/D (4th inv)");
  });

  it("throws on chords outside the catalogue", () => {
    expect(() => inversionsFor("Cxyz")).toThrow(/catalogue/);
    expect(() => inversionsFor("C", { stickyBass: "H" })).toThrow(/not a note/);
  });
});
