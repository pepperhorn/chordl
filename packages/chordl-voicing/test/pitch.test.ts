import { describe, expect, it } from "vitest";
import { voicingSchema } from "../src/schema.js";
import { parsePitch, labelNotes, degreeLabel } from "../src/index.js";

const degrees = (chord: string, pitches: string[]) => labelNotes(chord, pitches).map((n) => n.degree);

describe("parsePitch", () => {
  it("parses ASCII scientific pitch", () => {
    expect(parsePitch("Eb4")).toMatchObject({ letter: "E", alter: -1, octave: 4, midi: 63, pc: 3 });
    expect(parsePitch("F##2")!.midi).toBe(43);
    expect(parsePitch("Bbb3")).toMatchObject({ alter: -2, midi: 57 });
  });
  it("rejects Unicode accidentals and malformed strings", () => {
    expect(parsePitch("E♭4")).toBeNull();
    expect(parsePitch("F♯2")).toBeNull();
    expect(parsePitch("E4 ")).toBeNull();
    expect(parsePitch("H4")).toBeNull();
    expect(parsePitch("E")).toBeNull();
    expect(parsePitch("Ebbb4")).toBeNull();
  });
});

describe("degreeLabel", () => {
  it("wraps core, giving bb on diminished major-quality degrees", () => {
    expect(degreeLabel("7d")).toBe("bbVII");
    expect(degreeLabel("7m")).toBe("bVII");
    expect(degreeLabel("5d")).toBe("bV");
    expect(degreeLabel("9M")).toBe("IX");
  });
});

describe("labelNotes", () => {
  it("labels every chromatic note on every spelling root as the schema allows", () => {
    const degree = new RegExp(voicingSchema.properties.notes.items.properties.degree.pattern);
    const names = ["C", "C#", "Db", "D", "D#", "Eb", "E", "E#", "Fb", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B", "B#", "Cb"];
    for (const root of ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "Bb", "B"]) {
      for (const n of labelNotes(`${root}:maj`, names.map((p) => `${p}3`))) {
        expect(n.degree, `${n.pitch} on ${root}`).toMatch(degree);
      }
    }
  });

  it("labels an altered root as a flattened or sharpened I", () => {
    expect(labelNotes("A:6/Ab", ["Ab2", "A2"]).map((n) => n.degree)).toEqual(["bI", "I"]);
    expect(labelNotes("A:6", ["A#2"])[0].degree).toBe("#I");
  });

  it("labels Bb:7#5", () => {
    const r = labelNotes("Bb:7#5", ["Bb2", "D3", "F#3", "Ab3"]);
    expect(r.map((n) => n.degree)).toEqual(["I", "III", "#V", "bVII"]);
    expect(r.every((n) => n.inChord && !n.misspelled)).toBe(true);
  });
  it("labels extensions by the chord's interval", () => {
    expect(degrees("C:maj7", ["E4"])).toEqual(["III"]);
    expect(degrees("C:9", ["D4"])).toEqual(["IX"]);
  });
  it("labels non-chord tones as extensions", () => {
    const [n] = labelNotes("C:7", ["D4"]);
    expect(n).toMatchObject({ degree: "IX", inChord: false, misspelled: false });
    expect(degrees("C:7", ["F4", "A4", "Db4"])).toEqual(["XI", "XIII", "bIX"]);
  });
  it("flags misspelled chord tones", () => {
    expect(labelNotes("C:m", ["D#4"])[0]).toMatchObject({ inChord: true, misspelled: true, degree: "bIII" });
  });
  it("handles double flats", () => {
    expect(labelNotes("C:dim7", ["Bbb3"])[0]).toMatchObject({ degree: "bbVII", inChord: true, misspelled: false });
  });
  it("throws on invalid pitch", () => {
    expect(() => labelNotes("C:maj7", ["E♭4"])).toThrow(/E♭4/);
  });
});
