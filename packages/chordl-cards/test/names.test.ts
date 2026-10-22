import { describe, it, expect } from "vitest";
import { fullChordName, qualityLabelFor, rootOf } from "../src/names";

describe("chord name parsing", () => {
  it("extracts the root including accidentals", () => {
    expect(rootOf("Bm")).toBe("B");
    expect(rootOf("C#m7")).toBe("C#");
    expect(rootOf("Bbmaj7")).toBe("Bb");
    expect(rootOf("F")).toBe("F");
  });

  it("maps the remainder to a human-readable quality", () => {
    // The headline is the common abbreviated spelling, consistent across
    // every quality: "maj"/"min" beside "maj7"/"min7"/"min6". The spelled-out
    // name sits under the title (fullChordName).
    expect(qualityLabelFor("Bm")).toBe("min");
    expect(qualityLabelFor("Bmin")).toBe("min");
    expect(qualityLabelFor("F")).toBe("maj");
    expect(qualityLabelFor("Fmaj")).toBe("maj");
    // A dominant seventh is written "G7", so the card sets "7" — "7th" reads
    // as an ordinal ("the 7th") rather than as the chord's name.
    expect(qualityLabelFor("G7")).toBe("7");
    expect(qualityLabelFor("Fmaj7")).toBe("maj7");
    expect(qualityLabelFor("Am7")).toBe("min7");
  });

  it("labels the sixths in the sevenths' style, and the other triads as written", () => {
    // "min6" beside "min7" and "min", not "m6": one abbreviation for minor.
    expect(qualityLabelFor("C6")).toBe("6");
    expect(qualityLabelFor("Ebm6")).toBe("min6");
    expect(qualityLabelFor("Gaug")).toBe("aug");
    expect(qualityLabelFor("Bbdim")).toBe("dim");
    expect(qualityLabelFor("F#sus4")).toBe("sus4");
  });

  it("prints an unrecognised quality verbatim, even one that names an Object property", () => {
    // The label table used to be an object literal indexed by whatever followed
    // the root, so `QUALITY_LABELS["toString"]` returned a FUNCTION off
    // Object.prototype — which this then handed to src/card.ts's escapeXml as
    // the quality label, crashing the build with a type error rather than
    // printing the unknown quality as itself. Cosmetic on operator-authored
    // decks; a nonsense crash on user input under the phase-2 builder.
    expect(qualityLabelFor("CtoString")).toBe("toString");
    expect(qualityLabelFor("Cconstructor")).toBe("constructor");
    // The ordinary unknown-quality path, unchanged: an unlisted suffix prints
    // itself. (src/diagrams.ts is what refuses to RENDER it — see the note on
    // QUALITY_LABELS; this function only formats.)
    expect(qualityLabelFor("C13")).toBe("13");
  });

  it("reads every label from the catalogue, slash chords as written", () => {
    expect(qualityLabelFor("C7(b9/#5)")).toBe("7b9#5");
    expect(qualityLabelFor("Cm7b5")).toBe("m7b5");
    expect(qualityLabelFor("Cø7")).toBe("half-dim7");
    expect(qualityLabelFor("C/E")).toBe("/E");
    expect(qualityLabelFor("D7/C")).toBe("7/C");
  });
});

describe("fullChordName", () => {
  it.each([
    ["C", "c major"], ["Cm", "c minor"], ["C6", "c major sixth"], ["Cm6", "c minor sixth"],
    ["C7", "c dominant seventh"], ["Cmaj7", "c major seventh"], ["Cm7", "c minor seventh"],
    ["Caug", "c augmented"], ["Cdim", "c diminished"], ["Csus4", "c suspended fourth"],
    ["Csus2", "c suspended second"], ["Cadd9", "c added ninth"],
  ])("spells every quality out: %s -> %s", (chord, name) => {
    expect(fullChordName(chord)).toBe(name);
  });

  it("reads the long-hand synonyms the title label accepts the same way", () => {
    expect(fullChordName("Cmin")).toBe("c minor");
    expect(fullChordName("Cmaj")).toBe("c major");
    expect(fullChordName("Cmin7")).toBe("c minor seventh");
    expect(fullChordName("Cmin6")).toBe("c minor sixth");
  });

  it("spells both accidentals out", () => {
    expect(fullChordName("F#m7")).toBe("f sharp minor seventh");
    expect(fullChordName("Bbdim")).toBe("b flat diminished");
    expect(fullChordName("C#")).toBe("c sharp major");
    expect(fullChordName("Ebmaj7")).toBe("e flat major seventh");
  });

  it("prints an unrecognised quality verbatim, even one that names an Object property", () => {
    // Map-based for the same reason as QUALITY_LABELS: an object literal would
    // answer "toString" with a function off Object.prototype.
    expect(fullChordName("CtoString")).toBe("c toString");
    expect(fullChordName("Cfoo")).toBe("c foo");
    expect(fullChordName("C13")).toBe("c dominant thirteenth");
    expect(fullChordName("D7/C")).toBe("d dominant seventh over c");
  });

  it("labels and spells out the extended qualities", () => {
    const cases: [string, string, string][] = [
      ["Cdim7", "dim7", "c diminished seventh"],
      ["Cm7b5", "m7b5", "c minor seventh flat five"],
      ["Cø7", "half-dim7", "c half-diminished seventh"],
      ["CmMaj7", "minMaj7", "c minor major seventh"],
      ["C7#5", "7#5", "c dominant seventh sharp five"],
      ["Cmaj7#5", "maj7#5", "c major seventh sharp five"],
      ["Bbsus2", "sus2", "b flat suspended second"],
    ];
    for (const [chord, label, full] of cases) {
      expect(qualityLabelFor(chord)).toBe(label);
      expect(fullChordName(chord)).toBe(full);
    }
  });
});
