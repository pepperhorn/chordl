import { describe, expect, it } from "vitest";
import { resolveChord } from "@pepperhorn/chordl-core";
import { explodedVoicing, handsWindow, HANDS_WINDOW } from "../src/hands";
import { keyIndicesFor } from "../src/keyboard-window";

/** Names and semitones, the shape every case below asserts. */
function shape(chord: string) {
  const v = explodedVoicing(chord);
  if (!v) return undefined;
  return { lh: v.lh.map((t) => t.name), rh: v.rh.map((t) => t.name), semis: v.rh.map((t) => t.semitone) };
}

describe("explodedVoicing", () => {
  it("C", () => expect(shape("C")).toEqual({ lh: ["C"], rh: ["E", "G"], semis: [4, 7] }));
  it("Cm", () => expect(shape("Cm")).toEqual({ lh: ["C"], rh: ["Eb", "G"], semis: [3, 7] }));
  it("Cdim", () => expect(shape("Cdim")?.rh).toEqual(["Eb", "Gb"]));
  it("Caug", () => expect(shape("Caug")?.rh).toEqual(["E", "G#"]));
  it("Csus4", () => expect(shape("Csus4")?.rh).toEqual(["F", "G"]));
  it("Csus2", () => expect(shape("Csus2")?.rh).toEqual(["D", "G"]));
  it("C6", () => expect(shape("C6")?.rh).toEqual(["E", "A"]));
  it("C7", () => expect(shape("C7")).toEqual({ lh: ["C"], rh: ["E", "Bb"], semis: [4, 10] }));
  it("Cmaj7", () => expect(shape("Cmaj7")?.rh).toEqual(["E", "B"]));
  it("Cm7", () => expect(shape("Cm7")?.rh).toEqual(["Eb", "Bb"]));
  it("Cm7b5", () => expect(shape("Cm7b5")?.rh).toEqual(["Eb", "Bb"]));
  it("Cdim7 takes chordl-core's spelling of the 7th", () => {
    const seventh = resolveChord("Cdim7").notes[3];
    expect(shape("Cdim7")?.rh).toEqual(["Eb", seventh]);
  });
  it("C/E", () => expect(shape("C/E")).toEqual({ lh: ["E"], rh: ["G", "C"], semis: [3, 8] }));
  it("C/G", () => expect(shape("C/G")).toEqual({ lh: ["G"], rh: ["C", "E"], semis: [5, 9] }));
  it("C/D keeps the normal pair over a foreign bass", () =>
    expect(shape("C/D")).toEqual({ lh: ["D"], rh: ["E", "G"], semis: [2, 5] }));
  it.each(["C7/E", "Cm7/G", "Cmaj7/B", "C7/Bb", "C6/A"])(
    "%s is undefined: a chord-tone bass on a four-note chord would drop the 6th/7th or root", (c) =>
      expect(explodedVoicing(c)).toBeUndefined());
  it("C7/D keeps the normal pair over a foreign bass", () =>
    expect(shape("C7/D")).toEqual({ lh: ["D"], rh: ["E", "Bb"], semis: [2, 8] }));
  it("Bb7", () => expect(shape("Bb7")).toMatchObject({ lh: ["Bb"], rh: ["D", "Ab"] }));
  it("carries the sharp identity alongside the display name", () =>
    expect(explodedVoicing("Bb")?.lh[0]).toEqual({ name: "Bb", pc: "A#", semitone: 0 }));
  it.each(["C9", "C5", "Cadd9", "H", ""])("%j is undefined", (c) =>
    expect(explodedVoicing(c)).toBeUndefined());
  it.each(["C", "Cm", "Cdim", "Caug", "Csus2", "Csus4", "C6", "Cm6", "C7", "Cmaj7", "Cm7", "Cm7b5", "Cdim7",
    "CmMaj7", "C/E", "C/G", "C/D", "C7/D", "Bb7", "F#m7", "Ab/C", "G/B"])("%s puts the R.H. in the octave above the bass", (c) => {
    const v = explodedVoicing(c)!;
    expect(v.lh).toHaveLength(1);
    expect(v.rh).toHaveLength(2);
    for (const t of v.rh) expect(t.semitone).toBeGreaterThanOrEqual(1);
    for (const t of v.rh) expect(t.semitone).toBeLessThanOrEqual(11);
  });
  it("exports the window", () => expect(HANDS_WINDOW).toEqual({ whiteKeys: 14, minContextKeys: 3 }));
});

describe("handsWindow", () => {
  const roots = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
  const chords = [
    ...roots.flatMap((r) => ["", "m", "7", "m7", "maj7"].map((q) => r + q)),
    "C/E", "C/G", "C/D",
  ];

  it.each(chords)("%s fits the window with the L.H. bass leftmost", (chord) => {
    const { window } = handsWindow(chord);
    expect(window.size).toBe(14);
    expect(window.padLeft).toBeGreaterThanOrEqual(3);
    expect(window.padRight).toBeGreaterThanOrEqual(3);
    const [first, ...rest] = keyIndicesFor(window, "exact");
    for (const i of rest) expect(first).toBeLessThan(i);
  });

  it("throws naming the chord when the chord has no exploded voicing", () => {
    expect(() => handsWindow("C9")).toThrow('face "keyboard-hands" cannot print "C9"');
  });
});
