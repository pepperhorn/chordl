import { describe, expect, it } from "vitest";
import { Note } from "tonal";
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
const melodic = def("melodic-minor", "Melodic Minor", "1 2 b3 4 5 6 7", "W H W W W W H", "melodic-minor", 1);
const altered = def("altered", "Altered", "1 b2 #2 3 b5 #5 b7", "H W H W W W W", "melodic-minor", 7);
const harmonic = def("harmonic-minor", "Harmonic Minor", "1 2 b3 4 5 b6 7", "W H W W H m3 H", "harmonic-minor", 1);
const dominant = def("phrygian-dominant", "Phrygian Dominant", "1 b2 3 4 5 b6 b7", "H m3 H W H W W", "harmonic-minor", 5);
const pent = def("minor-pentatonic", "Minor Pentatonic", "1 b3 4 5 b7", "m3 W W m3 W");
const sus = def("sus-dominant", "Sus Dominant", "1 2 4 5 6 b7", "W m3 W W H W");
const dorianFlat2 = def("dorian-flat2", "Dorian b2", "1 b2 b3 4 5 6 b7", "H W W W W H W", "melodic-minor", 2);
const lydianAug = def("lydian-augmented", "Lydian Augmented", "1 2 3 #4 #5 6 7", "W W W W H W H", "melodic-minor", 3);
const lydianDom = def("lydian-dominant", "Lydian Dominant", "1 2 3 #4 5 6 b7", "W W W H W H W", "melodic-minor", 4);
const mixoFlat6 = def("mixolydian-flat6", "Mixolydian b6", "1 2 3 4 5 b6 b7", "W W H W H W W", "melodic-minor", 5);
const locrian2 = def("locrian-natural2", "Locrian Natural 2", "1 2 b3 4 b5 b6 b7", "W H W H W W W", "melodic-minor", 6);
const locrian6 = def("locrian-natural6", "Locrian Natural 6", "1 b2 b3 4 b5 6 b7", "H W W H m3 H W", "harmonic-minor", 2);
const ionianAug = def("ionian-sharp5", "Ionian #5", "1 2 3 4 #5 6 7", "W W H m3 H W H", "harmonic-minor", 3);
const dorianSharp4 = def("dorian-sharp4", "Dorian #4", "1 2 b3 #4 5 6 b7", "W H m3 H W H W", "harmonic-minor", 4);
const lydianSharp2 = def("lydian-sharp2", "Lydian #2", "1 #2 3 #4 5 6 7", "m3 H W H W W H", "harmonic-minor", 6);
const ultralocrian = def("ultralocrian", "Ultralocrian", "1 b2 b3 b4 b5 b6 bb7", "H W H W W H m3", "harmonic-minor", 7);
const modes = [major, dorian, phrygian, lydian, mixolydian, minor, locrian,
  melodic, dorianFlat2, lydianAug, lydianDom, mixoFlat6, locrian2, altered,
  harmonic, locrian6, ionianAug, dorianSharp4, dominant, lydianSharp2, ultralocrian];
const defs = [...modes, ionian, pent, sus];

describe("scale library", () => {
  it("preserves every accidental in formula degree labels and Romans", () => {
    expect(degreeLabelsOf(["bb7", "##4", "bb3"])).toEqual(["♭♭VII", "##IV", "♭♭III"]);
    expect(degreeLabelsOf(ultralocrian.intervals)).toEqual(["I", "♭II", "♭III", "♭IV", "♭V", "♭VI", "♭♭VII"]);
    expect(diatonicChords(ultralocrian, "C#", 4).map(c => c.roman)).toEqual([
      "i°7", "♭iimaj7", "♭iiiø7", "♭IV+maj7", "♭v7", "♭VI7", "♭♭VIImaj7",
    ]);
    for (const stack of [3, 4, 5] as const) {
      expect(diatonicChords(ultralocrian, "C#", stack)[6].roman).toMatch(/^♭♭VII/);
    }
  });
  it("limits seed-matrix double-accidental roots to the ruled Altered cases", () => {
    // 21 distinct seed modes × 12 pitch classes × 3 stacks × 7 degrees.
    // T10 lists these formula-forced Altered chords as missing, not respelled.
    const expectedRoots: Record<string, string[]> = {
      Db: ["Ebb", "Abb"], Eb: ["Bbb"], E: ["F##"],
      "F#": ["G##", "C##"], Ab: ["Bbb", "Ebb"], B: ["C##", "F##"],
    };
    const actual: Record<string, string[]> = {};
    let totalRows = 0;
    let doubleRows = 0;
    expect(modes).toHaveLength(21);
    for (const mode of modes) for (let pc = 0; pc < 12; pc++) {
      const root = preferredRoot(pc, mode);
      expect(Note.chroma(root)).toBe(pc);
      for (const stack of [3, 4, 5] as const) {
        const chords = diatonicChords(mode, root, stack);
        expect(chords).toHaveLength(7);
        totalRows += chords.length;
        const doubles = chords.filter(c => /bb|##/.test(c.root));
        doubleRows += doubles.length;
        if (doubles.length) {
          expect(mode.slug).toBe("altered");
          actual[`${root}/${stack}`] = doubles.map(c => c.root);
        }
      }
    }
    const expected = Object.fromEntries(Object.entries(expectedRoots).flatMap(([root, notes]) =>
      [3, 4, 5].map(stack => [`${root}/${stack}`, notes])));
    expect(actual).toEqual(expected);
    expect(totalRows).toBe(5292);
    expect(doubleRows).toBe(30);
  });
  it("preserves letter-consistent parents and uses flat ties only on fallback", () => {
    expect(modeSource(dorian, "Ab", defs).parentRoot).toBe("Gb");
    expect(modeSource(locrian, "F", defs).parentRoot).toBe("Gb");
    expect(modeSource(lydian, "F#", defs).parentRoot).toBe("C#");
    // G# major needs a double sharp; its practical enharmonic is Ab major.
    expect(modeSource(lydian, "C#", defs).parentRoot).toBe("Ab");
    // E# melodic minor needs impractical spelling; F# is cleaner than Gb.
    expect(modeSource(altered, "E", defs).parentRoot).toBe("F");
    expect(modeSource(altered, "F", defs).parentRoot).toBe("F#");
    expect(modeSource(major, "E##", defs).parentRoot).toBe("Gb");
    let roundTrips = 0;
    let fallbacks = 0;
    for (const mode of modes) for (let pc = 0; pc < 12; pc++) {
      const root = preferredRoot(pc);
      const source = modeSource(mode, root, defs);
      const parentNotes = spellScale(source.parent, source.parentRoot);
      // Independently identify fallback by whether the inverse-transposed parent
      // has >7 accidentals or any double accidental (Note.get gives the count).
      const parentRoot = Note.transpose(root, `-${Note.distance("C", spellScale(source.parent, "C")[mode.modeDegree! - 1])}`);
      const originalNotes = spellScale(source.parent, parentRoot);
      const count = originalNotes.reduce((sum, n) => sum + Math.abs(Note.get(n).alt!), 0);
      if (count <= 7 && originalNotes.every(n => Math.abs(Note.get(n).alt!) <= 1)) {
        expect(source.parentRoot, `${mode.slug}@${root}`).toBe(parentRoot);
        expect(modeAt(source.parent, source.parentRoot, mode.modeDegree!, modes)).toEqual({ mode, root });
        roundTrips++;
      } else {
        expect(parentNotes.some(n => /##|bb/.test(n)), `${mode.slug}@${root}`).toBe(false);
        fallbacks++;
      }
    }
    expect(roundTrips + fallbacks).toBe(252);
    expect(roundTrips).toBeGreaterThan(0);
    expect(fallbacks).toBeGreaterThan(0);
  });
  it.each(modes)("uses parent spelling in the $slug relative demo", mode => {
    const demo = modeDemo(mode, defs);
    expect(demo.relative.notes.some(n => /##|bb/.test(n))).toBe(false);
    const parent = defs.find(d => d.slug === mode.modeParent)!;
    const notes = spellScale(parent, demo.relative.answer);
    const start = mode.modeDegree! - 1;
    expect(demo.relative.notes).toEqual([...notes.slice(start), ...notes.slice(0, start)]);
  });
  it("uses the parent's B Altered spelling while keeping formula spelling explicit", () => {
    expect(modeDemo(altered, defs).relative.notes).toEqual(["B", "C", "D", "Eb", "F", "G", "A"]);
    expect(spellScale(altered, "B")).toContain("C##");
  });
  it("keeps degree accidentals on minor-family Roman numerals", () => {
    // The amended rule preserves formula interval numbers, including #2/3.
    expect(diatonicChords(altered, "C", 4).map(c => c.roman)).toEqual(["iø7", "♭iimaj7", "♯ii7", "III+maj7", "♭V7", "♯V7", "♭viiø7"]);
    expect(diatonicChords(minor, "C", 4).map(c => c.roman)).toEqual(["i7", "iiø7", "♭IIImaj7", "iv7", "v7", "♭VImaj7", "♭VII7"]);
    expect(diatonicChords(harmonic, "C", 4).map(c => c.roman)).toEqual(["imaj7", "iiø7", "♭III+maj7", "iv7", "V7", "♭VImaj7", "vii°7"]);
  });

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
    expect(spellScale(altered, "C")).toEqual(["C", "Db", "D#", "E", "Gb", "G#", "Bb"]);
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
  it("chooses roots using the supplied scale's accidentals", () => {
    expect(preferredRoot(1, locrian)).toBe("C#");
    expect(preferredRoot(6, lydianAug)).toBe("Gb");
    expect(preferredRoot(1, major)).toBe("Db");
    expect(preferredRoot(6, major)).toBe("F#");
    expect(preferredRoot(-11, locrian)).toBe("C#");
    expect(preferredRoot(13, locrian)).toBe("C#");
    expect(() => preferredRoot(1.5, locrian)).toThrow();
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
