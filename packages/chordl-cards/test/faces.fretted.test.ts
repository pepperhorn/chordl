import { describe, it, expect } from "vitest";
import { INSTRUMENTS, bassShapeFor } from "@pepperhorn/chordl-guitar";
import { requestFor, type GuitarFaceRequest } from "../src/faces";
import { playbackFor } from "../src/playback";
import { loadTheme } from "./theme-fixture";

const THEME = loadTheme();
const PCS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const guitarReq = (chord: string, face: "ukulele" | "bass4"): GuitarFaceRequest => {
  const req = requestFor(chord, face, THEME);
  if (req.kind !== "guitar") throw new Error("fretted request expected");
  return req;
};
const play = (chord: string, face: "ukulele" | "bass4") => playbackFor(requestFor(chord, face, THEME));
const pcs = (notes: number[]) => notes.map((n) => PCS[n % 12]);

describe("ukulele face", () => {
  it("builds a fretted request on the ukulele, from chords-db's first position", () => {
    for (const chord of ["C", "Am", "F#m7", "Bbmaj7", "Ebm7b5"]) {
      const req = guitarReq(chord, "ukulele");
      expect(req.instrument, chord).toBe("ukulele");
      expect(req.kind).toBe("guitar");
    }
  });

  it("has the same keys, in the same order, as the top-3 request (no generated badge)", () => {
    const uke = guitarReq("C", "ukulele");
    const top3 = requestFor("C", "guitar-top3", THEME);
    expect(Object.keys(uke)).toEqual(Object.keys(top3));
    expect(uke.generated).toBeUndefined();
  });

  it("colours the fingers by the pitch each one sounds on a G C E A tuning", () => {
    // C on ukulele: 0 0 0 3 — the one stopped note is C on the A string.
    const req = guitarReq("C", "ukulele");
    const stopped = req.shape.fingers.filter((f) => typeof f[1] === "number" && f[1] > 0);
    expect(stopped).toHaveLength(1);
    expect(stopped[0][0]).toBe(1);
    expect(stopped[0][1]).toBe(3);
  });

  it("plays C as G C E C, the high G reentrant", () => {
    expect(play("C", "ukulele")).toEqual({
      notes: [67, 60, 64, 72], instrument: "ukulele", strings: [0, 1, 2, 3],
    });
  });

  it("sounds only chord tones", () => {
    for (const chord of ["C", "Am", "F#m7", "Bbmaj7", "G7", "Dm"]) {
      const want = new Set(requestFor(chord, "keyboard", THEME).kind === "keyboard"
        ? (requestFor(chord, "keyboard", THEME) as { notes: string[] }).notes.map((n) => n.split(":")[0])
        : []);
      for (const pc of pcs(play(chord, "ukulele").notes)) expect(want.has(pc), `${chord}: ${pc}`).toBe(true);
    }
  });

  it("finds a shape under the catalogue's other spelling of the quality", () => {
    // chords-db files m7b5 under "m7b5"; the catalogue also writes it m7(b5).
    expect(guitarReq("Bbm7(b5)", "ukulele").shape).toEqual(guitarReq("Bbm7b5", "ukulele").shape);
  });

  it("throws naming the chord when chords-db has no ukulele shape", () => {
    expect(() => requestFor("C7(#9,#5)", "ukulele", THEME)).toThrow(/no ukulele shape for "C7\(#9,#5\)"/);
  });

  it("refuses a slash chord, as the top-3 face does", () => {
    expect(() => requestFor("C/E", "ukulele", THEME)).toThrow(/slash/);
  });

  it("refuses a quality outside the catalogue", () => {
    expect(() => requestFor("CtoString", "ukulele", THEME)).toThrow(/unsupported/);
  });
});

describe("bass4 face", () => {
  it("draws chordl-guitar's root-fifth-octave pattern for the root", () => {
    const req = guitarReq("C", "bass4");
    expect(req.instrument).toBe("bass4");
    const plain = bassShapeFor("C")!;
    expect(req.shape.fingers.map((f) => f.slice(0, 2))).toEqual(plain.fingers.map((f) => f.slice(0, 2)));
    expect((req.shape as { position?: number }).position).toBe((plain as { position?: number }).position);
  });

  it("has the same keys, in the same order, as the top-3 request", () => {
    expect(Object.keys(guitarReq("C", "bass4"))).toEqual(Object.keys(requestFor("C", "guitar-top3", THEME)));
  });

  it("plays C as C-G-C in the bass register, on the bass patch", () => {
    expect(play("C", "bass4")).toEqual({
      notes: [36, 43, 48], instrument: "electric_bass_finger", strings: [0, 1, 2],
    });
  });

  it("plays root, fifth, octave for every root and supported quality, below middle C", () => {
    const roots = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B"];
    for (const root of roots) {
      for (const q of ["", "m", "7", "m7", "maj7", "sus4", "6", "9"]) {
        const { notes } = play(root + q, "bass4");
        expect(notes[1] - notes[0], root + q).toBe(7);
        expect(notes[2] - notes[0], root + q).toBe(12);
        expect(notes[2], root + q).toBeLessThan(60);
        expect(notes[0], root + q).toBeGreaterThanOrEqual(INSTRUMENTS.bass4.openMidi[0]);
      }
    }
    expect(pcs(play("F#m7", "bass4").notes)).toEqual(["F#", "C#", "F#"]);
  });

  it("refuses a chord without a perfect fifth: the pattern would play a wrong note", () => {
    for (const chord of ["Cdim", "Caug", "Cm7b5", "C7(b5)"]) {
      expect(() => requestFor(chord, "bass4", THEME), chord).toThrow(/perfect fifth/);
    }
  });

  it("refuses a slash chord", () => {
    expect(() => requestFor("C/E", "bass4", THEME)).toThrow(/slash/);
  });

  it("refuses a quality outside the catalogue", () => {
    expect(() => requestFor("CvalueOf", "bass4", THEME)).toThrow(/unsupported/);
  });
});
