import { describe, it, expect } from "vitest";
import { identifyChords, matchesChordName } from "@pepperhorn/chordl-core";
import type { ChordCandidate } from "@pepperhorn/chordl-core";

const symbols = (cands: ChordCandidate[]) => cands.map((c) => c.symbol);

describe("identifyChords", () => {
  it("names A–C#–E as A", () => {
    const result = identifyChords(["A", "C#", "E"]);
    expect(symbols(result)).toContain("A");
    const a = result.find((c) => c.symbol === "A")!;
    expect(a).toMatchObject({ root: "A", type: "M" });
    expect(a.bass).toBeUndefined();
    expect(a.omitted).toBeUndefined();
  });

  it("offers both spellings of an accidental root", () => {
    const roots = identifyChords(["C#", "F", "G#"]).map((c) => c.root);
    expect(roots).toContain("C#");
    expect(roots).toContain("Db");
    expect(symbols(identifyChords(["C#", "F", "G#"]))).toEqual(
      expect.arrayContaining(["C#", "Db"]),
    );
  });

  it("is enharmonic-agnostic and ignores octaves and duplicates", () => {
    const result = symbols(identifyChords(["A3", "Db4", "E4", "A5", "C#2"]));
    expect(result).toContain("A");
  });

  it("names an inversion by its root when inversion-agnostic", () => {
    expect(symbols(identifyChords(["E", "G", "C"]))).toContain("C");
  });

  it("names an inversion as a slash chord when inversion matters", () => {
    const result = symbols(identifyChords(["E", "G", "C"], { inversionAgnostic: false }));
    expect(result).toContain("C/E");
    expect(result).not.toContain("C");
  });

  it("drops inversions entirely when inversion matters and slashes are off", () => {
    const result = identifyChords(["E", "G", "C"], { inversionAgnostic: false, allowSlash: false });
    expect(symbols(result)).not.toContain("C");
    expect(symbols(result)).not.toContain("C/E");
  });

  it("finds seventh chords and their symmetric relatives", () => {
    expect(symbols(identifyChords(["C", "E", "G", "B"]))).toContain("Cmaj7");
    expect(symbols(identifyChords(["C", "E", "G", "A"]))).toEqual(
      expect.arrayContaining(["C6", "Am7"]),
    );
    expect(symbols(identifyChords(["B", "D", "F", "Ab"]))).toEqual(
      expect.arrayContaining(["Bdim7", "Ddim7", "Fdim7", "G#dim7", "Abdim7"]),
    );
  });

  it("names the omitted-fifth reading and records the omission", () => {
    const cadd9 = identifyChords(["C", "D", "E"]).find((c) => c.symbol === "Cadd9");
    expect(cadd9).toMatchObject({ root: "C", type: "add9", omitted: ["5"] });
  });

  it("skips omitted-fifth readings when disabled", () => {
    expect(symbols(identifyChords(["C", "D", "E"], { allowOmittedFifth: false }))).not.toContain(
      "Cadd9",
    );
  });

  it("names a pedal-bass slash chord", () => {
    const result = identifyChords(["Ab", "C", "E", "G"]);
    expect(symbols(result)).toEqual(expect.arrayContaining(["C/Ab", "Abmaj7#5"]));
    expect(result.find((c) => c.symbol === "C/Ab")).toMatchObject({
      root: "C",
      type: "M",
      bass: "Ab",
    });
  });

  it("does not omit the fifth under a pedal bass or while the fifth is the bass", () => {
    expect(symbols(identifyChords(["Ab", "C", "E", "G"]))).not.toContain("Abmaj7/E");
    expect(symbols(identifyChords(["C", "E", "G", "A"]))).not.toContain("C6/G");
    expect(symbols(identifyChords(["C", "E", "G", "A"]))).not.toContain("Am7/E");
  });

  it("keeps slash names out when allowSlash is false", () => {
    const result = identifyChords(["Ab", "C", "E", "G"], { allowSlash: false });
    expect(result.every((c) => c.bass === undefined)).toBe(true);
    expect(symbols(result)).toContain("Abmaj7#5");
  });

  it("restricts to the given chord types", () => {
    const result = identifyChords(["C", "E", "G", "B"], { chordTypes: ["M", "m"] });
    expect(symbols(result)).not.toContain("Cmaj7");
    // C/B (pedal) is still a major triad
    expect(symbols(result)).toContain("C/B");
    expect(result.every((c) => c.type === "M" || c.type === "m")).toBe(true);
  });

  it("accepts chord-type synonyms in the filter", () => {
    expect(symbols(identifyChords(["C", "E", "G", "B"], { chordTypes: ["Δ7"] }))).toContain(
      "Cmaj7",
    );
    expect(symbols(identifyChords(["C", "E", "G"], { chordTypes: ["major"] }))).toContain("C");
  });

  it("ranks common chord types first within the same root and bass", () => {
    const result = symbols(identifyChords(["Ab", "C", "E", "G"]));
    expect(result.indexOf("Abmaj7#5")).toBeGreaterThanOrEqual(0);
    expect(result.indexOf("Abmaj7#5")).toBeLessThan(result.indexOf("AbM7b6"));
    expect(result.indexOf("G#maj7#5")).toBeLessThan(result.indexOf("G#M7b6"));
    expect(result).toContain("C/Ab");
  });

  it("lists root-position names before slash names", () => {
    const result = identifyChords(["Ab", "C", "E", "G"]);
    const firstSlash = result.findIndex((c) => c.bass);
    const lastPlain = result.map((c) => !c.bass).lastIndexOf(true);
    expect(firstSlash).toBeGreaterThan(lastPlain);
  });

  it("lists the root-position name first", () => {
    expect(identifyChords(["C", "E", "G"])[0].symbol).toBe("C");
    expect(identifyChords(["A", "C", "E", "G"])[0].symbol).toBe("Am7");
  });

  it("names a two-note power chord but nothing for a single note", () => {
    expect(symbols(identifyChords(["C", "G"]))).toContain("C5");
    expect(identifyChords(["C"])).toEqual([]);
    expect(identifyChords(["C", "C4", "B#"])).toEqual([]);
  });

  it("does not stretch a dyad into an omitted-fifth triad", () => {
    expect(symbols(identifyChords(["C", "E"]))).not.toContain("C");
  });

  it("returns nothing for all twelve notes", () => {
    const all = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    expect(identifyChords(all)).toEqual([]);
  });

  it("returns nothing for empty or unparseable input", () => {
    expect(identifyChords([])).toEqual([]);
    expect(identifyChords(["C", "H", "G"])).toEqual([]);
    expect(identifyChords(["", "E", "G"])).toEqual([]);
  });

  it("tolerates whitespace and case in note names", () => {
    expect(symbols(identifyChords([" a ", "c#", "e"]))).toContain("A");
    expect(symbols(identifyChords(["bb", "D", "f"]))).toContain("Bb");
  });

  it("spells the bass as the caller spelled it", () => {
    const result = identifyChords(["G#", "C", "E", "G"]);
    const slash = result.find((c) => c.root === "C" && c.type === "M" && c.bass);
    expect(slash?.bass).toBe("G#");
    expect(slash?.symbol).toBe("C/G#");
    expect(symbols(result)).not.toContain("C/Ab");
  });
});

describe("matchesChordName", () => {
  it("accepts A for A–C#–E and its major synonyms", () => {
    for (const name of ["A", "Amaj", "AM", "A major", "Amajor"]) {
      const r = matchesChordName(name, ["A", "C#", "E"]);
      expect(r.ok, name).toBe(true);
      expect(r.normalized, name).toBe("A");
    }
  });

  it("is enharmonic-agnostic about the notes", () => {
    expect(matchesChordName("A", ["A", "Db", "E"]).ok).toBe(true);
  });

  it("is inversion-agnostic by default", () => {
    expect(matchesChordName("C", ["E", "G", "C"]).ok).toBe(true);
  });

  it("requires the slash form when inversion matters", () => {
    expect(matchesChordName("C", ["E", "G", "C"], { inversionAgnostic: false }).ok).toBe(false);
    expect(matchesChordName("C/E", ["E", "G", "C"], { inversionAgnostic: false }).ok).toBe(true);
    expect(matchesChordName("C/G", ["E", "G", "C"], { inversionAgnostic: false }).ok).toBe(false);
    expect(matchesChordName("C", ["C", "E", "G"], { inversionAgnostic: false }).ok).toBe(true);
  });

  it("accepts an inversion slash name whose bass is a chord tone", () => {
    const r = matchesChordName("C/E", ["E", "G", "C"]);
    expect(r.ok).toBe(true);
    expect(r.normalized).toBe("C/E");
    expect(r.matched).toMatchObject({ root: "C", type: "M", bass: "E" });
  });

  it("accepts Cadd9 for C–D–E only when the fifth may be omitted", () => {
    const r = matchesChordName("Cadd9", ["C", "D", "E"]);
    expect(r.ok).toBe(true);
    expect(r.matched).toMatchObject({ symbol: "Cadd9", omitted: ["5"] });
    expect(matchesChordName("Cadd9", ["C", "D", "E"], { allowOmittedFifth: false }).ok).toBe(false);
    expect(matchesChordName("Cadd2", ["C", "D", "E"]).normalized).toBe("Cadd9");
  });

  it("does not report an omission when the fifth is present", () => {
    const r = matchesChordName("Cadd9", ["C", "D", "E", "G"]);
    expect(r.ok).toBe(true);
    expect(r.matched?.omitted).toBeUndefined();
  });

  it("accepts both C/Ab and Abmaj7#5 for Ab–C–E–G", () => {
    const notes = ["Ab", "C", "E", "G"];
    const slash = matchesChordName("C/Ab", notes);
    expect(slash.ok).toBe(true);
    expect(slash.normalized).toBe("C/Ab");
    expect(slash.matched).toMatchObject({ root: "C", type: "M", bass: "Ab" });
    const aug = matchesChordName("Abmaj7#5", notes);
    expect(aug.ok).toBe(true);
    expect(aug.normalized).toBe("Abmaj7#5");
    expect(matchesChordName("G#maj7#5", notes).ok).toBe(true);
  });

  it("requires the whole chord above a pedal bass", () => {
    expect(matchesChordName("Abmaj7/E", ["Ab", "C", "E", "G"]).ok).toBe(false);
    expect(matchesChordName("Cmaj7/D", ["D", "C", "E", "B"]).ok).toBe(false);
    expect(matchesChordName("Cmaj7/D", ["D", "C", "E", "G", "B"]).ok).toBe(true);
  });

  it("rejects slash names when allowSlash is false", () => {
    expect(matchesChordName("C/Ab", ["Ab", "C", "E", "G"], { allowSlash: false }).ok).toBe(false);
  });

  it("rejects a slash bass that is not one of the notes", () => {
    expect(matchesChordName("C/D", ["C", "E", "G"]).ok).toBe(false);
  });

  it("rejects the wrong quality", () => {
    const r = matchesChordName("Cm", ["C", "E", "G"]);
    expect(r.ok).toBe(false);
    expect(r.normalized).toBe("Cm");
    expect(r.matched).toBeUndefined();
    expect(symbols(r.candidates)).toContain("C");
  });

  it("enforces the chordTypes allow-list", () => {
    expect(matchesChordName("Cmaj7", ["C", "E", "G", "B"], { chordTypes: ["M", "m"] }).ok).toBe(
      false,
    );
    expect(matchesChordName("Cmaj7", ["C", "E", "G", "B"], { chordTypes: ["maj7"] }).ok).toBe(true);
    expect(matchesChordName("C", ["C", "E", "G"], { chordTypes: ["M", "m"] }).ok).toBe(true);
  });

  it("parses quality synonyms tolerantly", () => {
    const cases: [string, string[], string][] = [
      ["Cmin", ["C", "Eb", "G"], "Cm"],
      ["C-", ["C", "Eb", "G"], "Cm"],
      ["C minor", ["C", "Eb", "G"], "Cm"],
      ["Cø", ["C", "Eb", "Gb", "Bb"], "Cm7b5"],
      ["Cmin7b5", ["C", "Eb", "Gb", "Bb"], "Cm7b5"],
      ["C°", ["C", "Eb", "Gb"], "Cdim"],
      ["C°7", ["C", "Eb", "Gb", "A"], "Cdim7"],
      ["C+", ["C", "E", "G#"], "Caug"],
      ["Csus", ["C", "F", "G"], "Csus4"],
      ["C7sus", ["C", "F", "G", "Bb"], "C7sus4"],
      ["CM7", ["C", "E", "G", "B"], "Cmaj7"],
      ["CΔ7", ["C", "E", "G", "B"], "Cmaj7"],
      ["CΔ", ["C", "E", "G", "B"], "Cmaj7"],
      ["CΔ9", ["C", "E", "G", "B", "D"], "Cmaj9"],
      ["CmΔ", ["C", "Eb", "G", "B"], "CmMaj7"],
      ["CmΔ7", ["C", "Eb", "G", "B"], "CmMaj7"],
      ["Cmaj7", ["C", "E", "G", "B"], "Cmaj7"],
      ["CmMaj7", ["C", "Eb", "G", "B"], "CmMaj7"],
      ["Cm(maj7)", ["C", "Eb", "G", "B"], "CmMaj7"],
      ["Cmadd9", ["C", "Eb", "G", "D"], "Cmadd9"],
      ["C6", ["C", "E", "G", "A"], "C6"],
      ["C9", ["C", "E", "G", "Bb", "D"], "C9"],
    ];
    for (const [input, notes, normalized] of cases) {
      const r = matchesChordName(input, notes);
      expect(r.ok, input).toBe(true);
      expect(r.normalized, input).toBe(normalized);
    }
  });

  it("accepts unicode accidentals and normalizes the root", () => {
    const r = matchesChordName("D♭", ["Db", "F", "Ab"]);
    expect(r.ok).toBe(true);
    expect(r.normalized).toBe("Db");
    expect(matchesChordName("C♯m", ["C#", "E", "G#"]).normalized).toBe("C#m");
  });

  it("tolerates whitespace and root case", () => {
    expect(matchesChordName("  a  ", ["A", "C#", "E"]).ok).toBe(true);
    expect(matchesChordName("bbmaj7", ["Bb", "D", "F", "A"]).normalized).toBe("Bbmaj7");
    expect(matchesChordName("C / E", ["E", "G", "C"]).normalized).toBe("C/E");
    expect(matchesChordName("c maj 7", ["C", "E", "G", "B"]).ok).toBe(true);
  });

  it("reads a bare Δ as maj7, not a major triad", () => {
    expect(matchesChordName("CΔ", ["C", "E", "G"]).ok).toBe(false);
    expect(matchesChordName("CΔ", ["C", "E", "G"]).normalized).toBe("Cmaj7");
  });

  it("keeps M and m distinct by case", () => {
    expect(matchesChordName("CM", ["C", "E", "G"]).ok).toBe(true);
    expect(matchesChordName("Cm", ["C", "Eb", "G"]).ok).toBe(true);
    expect(matchesChordName("CM", ["C", "Eb", "G"]).ok).toBe(false);
  });

  it("returns ok false without a normalized name for unknown input", () => {
    for (const input of ["", "   ", "H", "Cxyz", "hello", "C/H"]) {
      const r = matchesChordName(input, ["C", "E", "G"]);
      expect(r.ok, input).toBe(false);
      expect(r.normalized, input).toBeUndefined();
      expect(r.candidates.length, input).toBeGreaterThan(0);
    }
  });

  it("returns ok false for notes that cannot form a chord", () => {
    expect(matchesChordName("C", []).ok).toBe(false);
    expect(matchesChordName("C", ["C"]).ok).toBe(false);
    expect(matchesChordName("C", ["C", "E", "H"]).ok).toBe(false);
  });

  it("does not accept a dyad as an omitted-fifth triad", () => {
    expect(matchesChordName("C", ["C", "E"]).ok).toBe(false);
  });
});
