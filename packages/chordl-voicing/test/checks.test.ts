import { describe, expect, it } from "vitest";
import { checkVoicing, BOWED_INSTRUMENTS } from "../src/index.js";
import type { Voicing, Realization } from "../src/index.js";

const GUITAR = ["E2", "A2", "D3", "G3", "B3", "E4"];
const UKE = ["G4", "C4", "E4", "A4"];
const fretted = (over: Record<string, unknown>): Realization => ({
  kind: "fretted", instrument: "guitar", tuning: GUITAR,
  strings: [null, 3, 2, 0, 0, 0], fingers: [null, 3, 2, null, null, null],
  baseFret: 1, barres: [], capo: null, ...over,
}) as Realization;
const make = (chordId: string, pitches: string[], realization: Realization, degrees?: string[]): Voicing => ({
  chordId,
  notes: pitches.map((pitch, i) => ({ pitch, degree: degrees?.[i] ?? "?" })),
  realization,
}) as unknown as Voicing;
// Fill in correct degrees via a first pass so tests focus on one concern.
import { labelNotes } from "../src/index.js";
const voicing = (chordId: string, pitches: string[], realization: Realization): Voicing =>
  make(chordId, pitches, realization, labelNotes(chordId, pitches).map((n) => n.degree));
const kb = (chordId: string, left: string[], right: string[]) =>
  voicing(chordId, [...left, ...right], { kind: "keyboard", hands: { left, right } });
const codes = (v: Voicing) => {
  const r = checkVoicing(v);
  return { hard: r.hard.map((f) => f.code), flags: r.flags.map((f) => f.code), facts: r.facts.map((f) => f.code) };
};

describe("checkVoicing", () => {
  it("Cmaj7 x32000 has no hard findings and level:beginner", () => {
    const c = codes(voicing("C:maj7", ["C3", "E3", "G3", "B3", "E4"], fretted({})));
    expect(c.hard).toEqual([]);
    expect(c.facts).toContain("level:beginner");
  });
  it("C7 with a D flags unwritten-addition:IX", () => {
    const c = codes(kb("C:7", ["C3"], ["E4", "G4", "Bb4", "D5"]));
    expect(c.flags).toContain("unwritten-addition:IX");
    expect(c.hard).toEqual([]);
  });
  it("7alt does not treat altered tensions as additions", () => {
    const c = codes(kb("C:7alt", ["C3", "Bb3"], ["E4", "Db5", "Ab5"]));
    expect(c.flags.filter((f) => f.startsWith("unwritten-addition"))).toEqual([]);
  });
  it("Cmaj7 without E is hard missing-third", () => {
    expect(codes(kb("C:maj7", ["C3"], ["G3", "B3"])).hard).toContain("missing-third");
  });
  it("Csus4 without a 3rd has no missing-third", () => {
    expect(codes(kb("C:sus4", ["C3"], ["F3", "G3"])).hard).not.toContain("missing-third");
  });
  it("five-finger fretted grip is hard too-many-fingers", () => {
    const five = make("C:maj", ["F2", "C3", "F3", "A3", "C4", "F4"], fretted({
      strings: [1, 3, 3, 2, 1, 1], fingers: [1, 2, 3, 4, 5, 1], barres: [],
    }));
    expect(checkVoicing(five).hard.map((f) => f.code)).toContain("too-many-fingers");
  });
  it("five fretted strings without a barre is too-many-fingers; a barre fixes it", () => {
    const base = { strings: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1] };
    const p = ["F2", "C3", "F3", "A3", "C4", "F4"];
    expect(codes(make("F:maj", p, fretted({ ...base, fingers: [null, null, null, null, null, null] }))).hard).toContain("too-many-fingers");
    expect(codes(make("F:maj", p, fretted({ ...base, barres: [{ fret: 1, fromString: 0, toString: 5 }] }))).hard).not.toContain("too-many-fingers");
  });
  it("keyboard hand over 14 semitones is hard keyboard-hand-span", () => {
    expect(codes(kb("C:maj", ["C3"], ["C4", "G4", "E5"])).hard).toContain("keyboard-hand-span");
  });
  it("rootless Cmaj9 keyboard flags root-omitted without hard", () => {
    const c = codes(kb("C:maj9", ["E3", "B3"], ["D4", "G4"]));
    expect(c.flags).toContain("root-omitted");
    expect(c.hard).toEqual([]);
  });
  it("cello double stop gets only bowed codes", () => {
    const v = voicing("C:maj", ["C3", "E3"], {
      kind: "bowed", instrument: "cello", tuning: BOWED_INSTRUMENTS.cello.tuning,
      stops: [{ string: 0, pitch: "C3", finger: 1 }, { string: 2, pitch: "E3", finger: 1 }], position: 1,
    });
    const c = codes(v);
    expect(c.hard).toEqual([]);
    expect(c.flags.filter((f) => ["root-omitted", "bass-mismatch", "missing-seventh"].includes(f))).toEqual([]);
    expect(c.facts).toEqual([]);
  });
  it("bowed: unwritten-addition still flagged, no bass or root flags", () => {
    const v = voicing("C:maj", ["D3", "E3"], {
      kind: "bowed", instrument: "cello", tuning: BOWED_INSTRUMENTS.cello.tuning,
      stops: [{ string: 0, pitch: "D3", finger: 1 }, { string: 2, pitch: "E3", finger: 1 }], position: 1,
    });
    const c = codes(v);
    expect(c.flags).toEqual(["unwritten-addition:IX"]);
    expect(c.hard).toEqual([]);
  });
  it("bowed stop below open is hard", () => {
    const v = voicing("C:maj", ["B1", "E3"], {
      kind: "bowed", instrument: "cello", tuning: BOWED_INSTRUMENTS.cello.tuning,
      stops: [{ string: 0, pitch: "B1", finger: 1 }, { string: 2, pitch: "E3", finger: 1 }], position: 1,
    });
    expect(codes(v).hard).toContain("stop-below-open");
  });
  it("degree '3' instead of 'III' is hard wrong-note", () => {
    const v = make("C:maj", ["C3", "E3", "G3"], { kind: "keyboard", hands: { left: ["C3"], right: ["E3", "G3"] } }, ["I", "3", "V"]);
    expect(codes(v).hard).toContain("wrong-note");
  });
  it("misspelled note is hard wrong-note", () => {
    const v = voicing("C:maj", ["C3", "Fb3", "G3"], { kind: "keyboard", hands: { left: ["C3"], right: ["Fb3", "G3"] } });
    expect(codes(v).hard).toContain("wrong-note");
  });
  it("does not require a third on bass4, but still does on other fretted instruments", () => {
    const bass = fretted({ instrument: "bass4", tuning: ["E1", "A1", "D2", "G2"], strings: [null, 3, 5, 5], fingers: [null, 1, 3, 4] });
    const notes = ["C2", "G2", "C3"];
    expect(codes(voicing("C:maj", notes, bass)).hard).not.toContain("missing-third");
    expect(codes(voicing("C:maj", ["C3", "G3", "C4"], fretted({ strings: [null, 3, 5, 5, null, null], fingers: [null, 1, 3, 4, null, null] }))).hard).toContain("missing-third");
  });

  it("notes-mismatch and unknown-instrument come through", () => {
    expect(codes(voicing("C:maj7", ["C3"], fretted({}))).hard).toContain("notes-mismatch");
    expect(codes(voicing("C:maj7", ["C3", "E3", "G3", "B3", "E4"], fretted({ instrument: "banjo" }))).hard).toContain("unknown-instrument");
  });
  it("missing-seventh and missing-extension and bass-mismatch", () => {
    const c = codes(kb("C:9", ["E3"], ["G3", "D4"]));
    expect(c.flags).toEqual(expect.arrayContaining(["missing-seventh", "root-omitted", "bass-mismatch"]));
    const d = codes(kb("C:13", ["C3"], ["E3", "Bb3", "D4"]));
    expect(d.flags).toContain("missing-extension:XIII");
  });
  it("slash chord expects the slash bass", () => {
    expect(codes(kb("C:maj/E", ["E3"], ["C4", "G4"])).flags).not.toContain("bass-mismatch");
    expect(codes(kb("C:maj/E", ["C3"], ["E4", "G4"])).flags).toContain("bass-mismatch");
  });
  it("interior-mute flagged, movable fact for closed grips", () => {
    const f = codes(voicing("C:maj", ["C3", "G3", "E4"], fretted({
      strings: [null, 3, null, 5, null, 0], fingers: [null, 1, null, 3, null, null],
    })));
    expect(f.flags).toContain("interior-mute");
    const m = codes(voicing("F:maj", ["F2", "C3", "F3", "A3", "C4", "F4"], fretted({
      strings: [1, 3, 3, 2, 1, 1], fingers: [1, 3, 4, 2, 1, 1], barres: [{ fret: 1, fromString: 0, toString: 5 }],
    })));
    expect(m.facts).toContain("movable");
  });
  it("guitar rule codes are prefixed guitar:", () => {
    const c = codes(voicing("C:maj", ["G3", "B3", "E4"], fretted({
      strings: [null, null, null, 0, 1, 0], fingers: [null, null, null, null, 1, null],
    })));
    expect(c.flags).toContain("guitar:three-strings");
  });
  it("guitar review and level are skipped for non-standard tuning (drop D)", () => {
    const drop = (strings: (number | null)[]) => voicing("C:maj", ["G3", "B3", "E4"], fretted({
      tuning: ["D2", ...GUITAR.slice(1)], strings, fingers: [null, null, null, null, 1, null],
    }));
    const c = codes(drop([null, null, null, 0, 1, 0]));
    expect(c.flags.some((f) => f.startsWith("guitar:"))).toBe(false);
    expect(c.facts.some((f) => f.startsWith("level:"))).toBe(false);
    const wide = codes(voicing("C:maj", ["F#3", "C4", "G4"], fretted({
      tuning: ["D2", ...GUITAR.slice(1)], strings: [null, null, null, 3, 5, 3], fingers: [null, null, null, 1, 3, 1],
    })));
    expect(wide.flags).not.toContain("stretch");
    const stretch = codes(voicing("C:maj", ["G3", "C4", "A4"], fretted({
      tuning: ["D2", ...GUITAR.slice(1)], strings: [null, null, null, 0, 1, 5], fingers: [null, null, null, null, 1, 4],
    })));
    expect(stretch.flags).toContain("stretch");
  });
  it("bass-mismatch message names the note, not a pitch class number", () => {
    const f = checkVoicing(kb("C:maj", ["E3"], ["G3", "C4"])).flags.find((x) => x.code === "bass-mismatch")!;
    expect(f.message).toContain("E3");
  });
  it("non-guitar fretted gets stretch and no level fact", () => {
    const c = codes(voicing("C:maj", ["G4", "C4", "F4", "D5"], {
      kind: "fretted", instrument: "ukulele", tuning: UKE, strings: [0, 0, 1, 5], fingers: [null, null, 1, 4],
      baseFret: 1, barres: [], capo: null,
    }));
    expect(c.flags).toContain("stretch");
    expect(c.facts.some((f) => f.startsWith("level:"))).toBe(false);
  });
  it("keyboard gets a level fact", () => {
    expect(codes(kb("C:maj", ["C3"], ["E3", "G3"])).facts).toContain("level:beginner");
  });
  it("findings are sorted by code within each group", () => {
    const r = checkVoicing(kb("C:9", ["E3"], ["G3", "D4"]));
    const c = r.flags.map((f) => f.code);
    expect(c).toEqual([...c].sort());
  });
});
