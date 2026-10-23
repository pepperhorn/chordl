import { describe, expect, it } from "vitest";
import { guitarPositionFor, chordsDbSuffixFor } from "../src/guitarPosition.js";
import { lookupGuitarChord } from "../src/chordLookup.js";
import { INSTRUMENTS } from "../src/instruments.js";
import { positionToMidi } from "../src/pitch.js";

const OPEN = INSTRUMENTS.guitar.openMidi;
const pcs = (p: { frets: number[]; baseFret: number; fingers: number[]; barres: number[] }) =>
  new Set(positionToMidi(p, OPEN).map((m) => m % 12));
const lowest = (p: { frets: number[]; baseFret: number; fingers: number[]; barres: number[] }) =>
  Math.min(...positionToMidi(p, OPEN)) % 12;

describe("chordsDbSuffixFor", () => {
  it("matches a spelled chord to the chords-db suffix with the same tones", () => {
    expect(chordsDbSuffixFor({ root: "C", pitchClasses: ["C", "E", "G", "Bb"] })).toBe("7");
    expect(chordsDbSuffixFor({ root: "C", pitchClasses: ["C", "E", "G", "Bb", "D", "A"] })).toBe("13");
    expect(chordsDbSuffixFor({ root: "C", pitchClasses: ["C", "E", "Gb", "Bb"] })).toBe("7b5");
    expect(chordsDbSuffixFor({ root: "C", pitchClasses: ["C", "Eb", "Gb", "Bbb"] })).toBe("dim7");
    expect(chordsDbSuffixFor({ root: "C", pitchClasses: ["C", "E", "G"], bass: "E" })).toBe("/E");
    expect(chordsDbSuffixFor({ root: "A", pitchClasses: ["A", "C", "E"], bass: "G" })).toBe("m/G");
  });

  it("returns null for chords chords-db does not carry", () => {
    expect(chordsDbSuffixFor({ root: "C", pitchClasses: ["C", "G", "Bb"] })).toBeNull();
    expect(chordsDbSuffixFor({ root: "C", pitchClasses: ["C", "E", "G#", "Bb", "D#"] })).toBeNull();
    expect(chordsDbSuffixFor({ root: "Bb", pitchClasses: ["Bb", "D", "F"], bass: "C" })).toBeNull();
  });
});

describe("guitarPositionFor", () => {
  it("chords-db first, marked generated: false", () => {
    const p = guitarPositionFor({ root: "C", pitchClasses: ["C", "E", "G", "Bb"] })!;
    expect(p.generated).toBe(false);
    expect(p.generated === false && p.source).toBe("chords-db");
    const db = lookupGuitarChord("C7")!.positions[0];
    expect(p.frets).toEqual(db.frets);
    expect(p.baseFret).toBe(db.baseFret);
  });

  it("skips a chords-db position that does not spell the chord (C9 #1 has no b7)", () => {
    const first = lookupGuitarChord("C9")!.positions[0];
    expect(pcs(first).has(10)).toBe(false);
    const p = guitarPositionFor({ root: "C", pitchClasses: ["C", "E", "G", "Bb", "D"] })!;
    expect(p.generated).toBe(false);
    expect(pcs(p).has(10)).toBe(true);
    expect(pcs(p).has(2)).toBe(true);
  });

  it("resolves sharps and flats to the same chords-db root", () => {
    const sharp = guitarPositionFor({ root: "C#", pitchClasses: ["C#", "E#", "G#"] })!;
    const flat = guitarPositionFor({ root: "Db", pitchClasses: ["Db", "F", "Ab"] })!;
    expect(sharp.generated).toBe(false);
    expect(flat.frets).toEqual(sharp.frets);
  });

  it("falls back to the generator, flagged for review", () => {
    const p = guitarPositionFor({ root: "C", pitchClasses: ["C", "E", "G#", "Bb", "D#"] })!;
    expect(p.generated).toBe(true);
    if (p.generated) expect(p.rule).toContain("altered");
    expect(pcs(p)).toEqual(new Set([0, 4, 8, 10, 3]));
  });

  it("power chords come from the existing regular shape, not the generator", () => {
    const p = guitarPositionFor({ root: "C", pitchClasses: ["C", "G"] })!;
    expect(p.generated).toBe(false);
    expect(p.generated === false && p.source).toBe("power-chord");
  });

  it("slash chords: chords-db '/E' when it exists, generated otherwise, bass lowest either way", () => {
    const ce = guitarPositionFor({ root: "C", pitchClasses: ["C", "E", "G"], bass: "E" })!;
    expect(ce.generated).toBe(false);
    expect(lowest(ce)).toBe(4);
    const bbc = guitarPositionFor({ root: "Bb", pitchClasses: ["Bb", "D", "F"], bass: "C" })!;
    expect(bbc.generated).toBe(true);
    expect(lowest(bbc)).toBe(0);
  });

  it("returns null when nothing playable exists", () => {
    expect(guitarPositionFor({ root: "C", pitchClasses: ["C", "Db", "D", "Eb", "E", "F", "F#"] })).toBeNull();
  });
});
