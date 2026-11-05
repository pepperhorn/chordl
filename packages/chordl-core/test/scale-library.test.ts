import { describe, expect, it } from "vitest";
import {
  type ScaleDef, type StepToken, spellScale, stepPatternOf, validateStepPattern,
  degreeLabelsOf, modeSource, modeAt, scaleExcerpt, excerptLabel,
  diatonicChords, preferredRoot, modeDemo,
} from "../src/theory/scale-library.js";

// Hand-written fixtures from 0024 §1b, independent of Tonal's scale catalogue.
const def = (slug: string, name: string, intervals: string, steps: string,
  modeParent?: string, modeDegree?: number): ScaleDef => ({
  slug, name, intervals: intervals.split(" "), steps: steps.split(" ") as StepToken[],
  modeParent, modeDegree,
});
const major = def("major", "Major", "1 2 3 4 5 6 7", "W W H W W W H", "major", 1);
const ionian = { ...major, slug: "ionian", name: "Ionian" };
const dorian = def("dorian", "Dorian", "1 2 b3 4 5 6 b7", "W H W W W H W", "major", 2);
const phrygian = def("phrygian", "Phrygian", "1 b2 b3 4 5 b6 b7", "H W W W H W W", "major", 3);
const lydian = def("lydian", "Lydian", "1 2 3 #4 5 6 7", "W W W H W W H", "major", 4);
const mixolydian = def("mixolydian", "Mixolydian", "1 2 3 4 5 6 b7", "W W H W W H W", "major", 5);
const minor = def("minor", "Natural Minor", "1 2 b3 4 5 b6 b7", "W H W W H W W", "major", 6);
const locrian = def("locrian", "Locrian", "1 b2 b3 4 b5 b6 b7", "H W W H W W W", "major", 7);
const melodic = def("melodic-minor", "Melodic Minor", "1 2 b3 4 5 6 7", "W H W W W W H");
const altered = def("altered", "Altered", "1 b2 #2 3 b5 b6 b7", "H W H W W W W", "melodic-minor", 7);
const harmonic = def("harmonic-minor", "Harmonic Minor", "1 2 b3 4 5 b6 7", "W H W W H m3 H");
const dominant = def("phrygian-dominant", "Phrygian Dominant", "1 b2 3 4 5 b6 b7", "H m3 H W H W W", "harmonic-minor", 5);
const pent = def("minor-pentatonic", "Minor Pentatonic", "1 b3 4 5 b7", "m3 W W m3 W");
const sus = def("sus-dominant", "Sus Dominant", "1 2 4 5 6 b7", "W m3 W W H W");
const defs = [major, ionian, dorian, phrygian, lydian, mixolydian, minor, locrian, melodic, altered, harmonic, dominant, pent, sus];

describe("scale library", () => {
  it.each([
    [lydian, "major", "G"], [altered, "melodic-minor", "Db"],
    [dominant, "harmonic-minor", "F"], [locrian, "major", "Db"], [dorian, "major", "Bb"],
  ])("finds the relative parent of $slug on C", (mode, slug, parentRoot) => {
    expect(modeSource(mode as ScaleDef, "C", defs)).toEqual({ parent: defs.find(d => d.slug === slug), parentRoot });
  });
  it("finds a mode with the parent's spelling", () => {
    expect(modeAt(major, "G", 4, defs)).toEqual({ mode: lydian, root: "C" });
    expect(modeAt(major, "Gb", 4, defs).root).toBe("Cb");
  });
  it("spells interval numbers without simplifying enharmonics", () => {
    expect(spellScale(altered, "C")).toEqual(["C", "Db", "D#", "E", "Gb", "Ab", "Bb"]);
    expect(spellScale(major, "C#")).toEqual(["C#", "D#", "E#", "F#", "G#", "A#", "B#"]);
    expect(spellScale(major, "Gb")[3]).toBe("Cb");
  });
  it("derives and validates circular steps", () => {
    for (const d of defs) expect(stepPatternOf(d.intervals)).toEqual(d.steps);
    expect(validateStepPattern(sus.intervals, ["W", "m3", "W", "W", "W", "W"])).toBe(false);
    expect(validateStepPattern(major.intervals, major.steps)).toBe(true);
    expect(validateStepPattern(["garbage"], ["H"])).toBe(false);
    expect(stepPatternOf(["1", "3", "#5"])).toEqual(["M3", "M3", "M3"]);
  });
  it("labels degrees and excerpts", () => {
    expect(degreeLabelsOf(["1", "b3", "#4"])).toEqual(["I", "♭III", "#IV"]);
    expect(scaleExcerpt(pent, "C", 1, 5)).toEqual(["C", "Eb", "F", "G", "Bb"]);
    expect(scaleExcerpt(major, "C", 1, 9)).toEqual(["C", "D", "E", "F", "G", "A", "B", "C", "D"]);
    expect(scaleExcerpt(major, "C", 1, 3, 1, "up-down")).toEqual(["C", "D", "E", "D", "C"]);
    expect(scaleExcerpt(major, "C", 1, 3, 1, "down")).toEqual(["E", "D", "C"]);
    expect(excerptLabel(pent, "C", 1, 5)).toBe("C Minor Pentatonic");
    expect(excerptLabel({ ...pent, intervals: [...pent.intervals, "7"] }, "C", 1, 5)).toBe("Notes 1–5 of C Minor Pentatonic");
  });
  it("extends excerpts by octaves and rejects invalid ranges", () => {
    expect(scaleExcerpt(major, "C", 1, 8, 2)).toHaveLength(15);
    expect(scaleExcerpt(pent, "C", 4, 7)).toEqual(["G", "Bb", "C", "Eb"]);
    expect(scaleExcerpt(major, "C", 1, 1, 1, "up-down")).toEqual(["C"]);
    expect(() => scaleExcerpt(major, "C", 0, 3)).toThrow();
    expect(() => scaleExcerpt(major, "C", 3, 1)).toThrow();
    expect(() => scaleExcerpt(major, "C", 1, 3, 0)).toThrow();
    expect(() => modeSource(pent, "C", defs)).toThrow();
    expect(() => modeSource(dorian, "C", [])).toThrow();
    expect(() => modeAt(major, "C", 8, defs)).toThrow();
  });
  it("builds mode demonstration cards", () => {
    const demo = modeDemo(dorian, defs);
    expect(demo.title).toBe("2nd Degree - Dorian");
    expect(demo.parallel).toEqual({ root: "C", notes: ["C", "D", "Eb", "F", "G", "A", "Bb"], question: "C is the II (nd degree) of?", answer: "Bb" });
    expect(demo.relative).toEqual({ root: "D", notes: ["D", "E", "F", "G", "A", "B", "C"], question: "D is the II (nd degree) of?", answer: "C" });
    expect(modeDemo(ionian, defs).relative.root).toBe("G");
    expect(modeDemo({ ...dorian, relativeExampleRoot: "G" }, defs).relative.root).toBe("G");
  });
  it("chooses the fewest key-signature accidentals", () => {
    expect(Array.from({ length: 12 }, (_, pc) => preferredRoot(pc))).toEqual(["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]);
  });
  it("stacks triads, sevenths, and ninths with CRF slugs", () => {
    const triads = diatonicChords(major, "C", 3);
    expect(triads.map(c => c.symbol)).toEqual(["C", "Dm", "Em", "F", "G", "Am", "Bdim"]);
    expect(triads.map(c => c.slug)).toEqual(["c", "d-m", "e-m", "f", "g", "a-m", "b-dim"]);
    expect(diatonicChords(major, "Bb", 3)[0].slug).toBe("b-flat");
    expect(triads.map(c => c.roman)).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
    expect(diatonicChords(major, "C", 4)[4]).toEqual({ degree: 5, root: "G", symbol: "G7", roman: "V7", slug: "g-7" });
    expect(diatonicChords(major, "C", 4)[1].slug).toBe("d-m7");
    expect(diatonicChords(major, "C", 4)[6].slug).toBe("b-m7-flat5");
    expect(diatonicChords(major, "C", 5)[2]).toMatchObject({ symbol: "Em7(b9)", slug: "e-m7-flat9" });
    expect(diatonicChords(harmonic, "A", 3)[2].symbol).toBe("Caug");
    expect(diatonicChords(harmonic, "C", 4)[2].slug).toBe("e-flat-maj7-sharp5");
    expect(diatonicChords(melodic, "C#", 4)[0].slug).toBe("c-sharp-m-maj7");
    expect(() => diatonicChords(pent, "C", 3)).toThrow();
  });
});
