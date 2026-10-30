import { describe, expect, it } from "vitest";
import { soundingMidi, notesMatchRealization, BOWED_INSTRUMENTS } from "../src/index.js";
import type { Voicing, Realization } from "../src/index.js";

const GUITAR = ["E2", "A2", "D3", "G3", "B3", "E4"];
const fretted = (over: Record<string, unknown>): Realization => ({
  kind: "fretted", instrument: "guitar", tuning: GUITAR,
  strings: [null, 3, 2, 0, 0, 0], fingers: [null, 3, 2, null, null, null],
  baseFret: 1, barres: [], capo: null, ...over,
}) as Realization;
const voicing = (notes: string[], realization: Realization): Voicing => ({
  notes: notes.map((pitch) => ({ pitch, degree: "I" })), realization,
}) as unknown as Voicing;

describe("soundingMidi", () => {
  it("guitar x32000 is Cmaj7", () => {
    expect(soundingMidi(fretted({}))).toEqual([48, 52, 55, 59, 64]);
  });
  it("uses absolute frets, ignoring baseFret (R2)", () => {
    expect(soundingMidi(fretted({ strings: [null, 8, null, null, null, null], baseFret: 8 }))).toEqual([53]);
  });
  it("ukulele reentrant: lowest pitch is C4", () => {
    const m = soundingMidi(fretted({
      instrument: "ukulele", tuning: ["G4", "C4", "E4", "A4"], strings: [0, 0, 0, 3], fingers: [null, null, null, 3],
    }));
    expect(m).toContain(60);
    expect(Math.min(...m)).toBe(60);
  });
  it("capo adds to every sounding string including open (R4)", () => {
    expect(soundingMidi(fretted({ capo: 2 }))).toEqual([50, 54, 57, 61, 66]);
  });
  it("concatenates keyboard hands", () => {
    expect(soundingMidi({ kind: "keyboard", hands: { left: ["C3"], right: ["E4", "G4"] } })).toEqual([48, 64, 67]);
  });
  it("bowed uses stop pitch", () => {
    expect(soundingMidi({ kind: "bowed", instrument: "cello", tuning: BOWED_INSTRUMENTS.cello.tuning,
      stops: [{ string: 0, pitch: "E2", finger: 1 }], position: 1 })).toEqual([40]);
  });
  it("exposes bowed tunings", () => {
    expect(BOWED_INSTRUMENTS.violin.tuning).toEqual(["G3", "D4", "A4", "E5"]);
    expect(BOWED_INSTRUMENTS["double-bass"].tuning).toEqual(["E1", "A1", "D2", "G2"]);
  });
});

describe("notesMatchRealization", () => {
  const codes = (v: Voicing) => notesMatchRealization(v).map((f) => `${f.severity}:${f.code}`);
  it("passes a matching voicing", () => {
    expect(codes(voicing(["C3", "E3", "G3", "B3", "E4"], fretted({})))).toEqual([]);
  });
  it("flags notes-mismatch", () => {
    expect(codes(voicing(["C3", "E3", "G3", "B3"], fretted({})))).toEqual(["hard:notes-mismatch"]);
  });
  it("flags unknown fretted instrument", () => {
    expect(codes(voicing(["C3", "E3", "G3", "B3", "E4"], fretted({ instrument: "banjo" })))).toEqual(["hard:unknown-instrument"]);
  });
  it("accepts guitar-top3 as known", () => {
    expect(codes(voicing(["C3", "E3", "G3", "B3", "E4"], fretted({ instrument: "guitar-top3" })))).toEqual([]);
  });
  it("flags tuning-length", () => {
    expect(codes(voicing(["C3"], fretted({ strings: [0, 0, 0] })))).toEqual(["hard:tuning-length"]);
  });
  const cello = (string: number) => voicing(["E2"], {
    kind: "bowed", instrument: "cello", tuning: BOWED_INSTRUMENTS.cello.tuning,
    stops: [{ string, pitch: "E2", finger: 1 }], position: 1,
  });
  it("cello E2 on string 0 is fine", () => expect(codes(cello(0))).toEqual([]));
  it("cello E2 on string 1 is below open", () => expect(codes(cello(1))).toEqual(["hard:stop-below-open"]));
});
