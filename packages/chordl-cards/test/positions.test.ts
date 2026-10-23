import { describe, it, expect } from "vitest";
import { INSTRUMENTS, analyzeChordTones } from "@pepperhorn/chordl-guitar";
import { requestFor } from "../src/faces";
import { playbackFor } from "../src/playback";
import { spelledChord, noteParts } from "../src/catalogue";
import { POSITIONS_MAX_FRET, positionsFor, type FacePosition, type FrettedCardFace } from "../src/positions";
import * as model from "../src/model";
import { loadTheme } from "./theme-fixture";

const THEME = loadTheme();
const FACES: FrettedCardFace[] = ["guitar", "guitar-top3", "ukulele", "bass4"];
const ROOTS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const QUALITIES = ["", "m", "7", "m7", "maj7", "m7b5", "dim", "6", "sus4", "9"];
const SWEEP = ROOTS.flatMap((r) => QUALITIES.map((q) => r + q));

/** positionsFor, or null where the face cannot print the chord (requestFor throws). */
function tryPositions(chord: string, face: FrettedCardFace): FacePosition[] | null {
  try {
    requestFor(chord, face, THEME);
  } catch {
    return null;
  }
  return positionsFor(chord, face, THEME);
}

/** Absolute frets per string, low to high, from a request's svguitar shape (as playbackFor reads it). */
function absFrets(p: FacePosition): number[] {
  const { strings } = INSTRUMENTS[p.request.instrument];
  const shape = p.request.shape as {
    fingers: Array<[number, number | string]>;
    barres?: Array<{ fromString: number; toString: number; fret: number }>;
    position?: number;
  };
  const base = shape.position ?? 1;
  const abs = (f: number) => (f <= 0 || base <= 1 ? f : base + f - 1);
  const out: number[] = new Array(strings).fill(-1);
  for (const [s, f] of shape.fingers) if (typeof f === "number") out[strings - s] = Math.max(out[strings - s], abs(f));
  for (const b of shape.barres ?? []) {
    for (let s = Math.min(b.fromString, b.toString); s <= Math.max(b.fromString, b.toString); s++) {
      const muted = shape.fingers.some(([x, f]) => x === s && f === "x");
      if (!muted) out[strings - s] = Math.max(out[strings - s], abs(b.fret));
    }
  }
  return out;
}

const pcsOf = (p: FacePosition) => new Set(playbackFor(p.request).notes.map((n) => n % 12));
const pcOfNote = (n: string) => noteParts(n)!.pc;

describe("positionsFor: the card shape", () => {
  it("is item 0, byte-identical to requestFor", () => {
    for (const chord of ["C", "F#m7", "Am", "G7", "Bbmaj7", "Ebm7b5", "D7/C", "Cmaj9"]) {
      for (const face of FACES) {
        const ps = tryPositions(chord, face);
        if (!ps) continue;
        expect(ps[0].id).toBe("card");
        expect(ps[0].label).toBe("Card shape");
        expect(ps[0].kind).toBe("card");
        expect(JSON.stringify(ps[0].request), `${chord} ${face}`).toBe(JSON.stringify(requestFor(chord, face, THEME)));
      }
    }
  });

  it("throws exactly where requestFor throws, and for a keyboard face", () => {
    expect(() => positionsFor("Cmaj9", "guitar-top3", THEME)).toThrow(/unsupported chord suffix/);
    expect(() => positionsFor("D7/C", "ukulele", THEME)).toThrow(/slash/);
    expect(() => positionsFor("Cdim", "bass4", THEME)).toThrow(/perfect fifth/);
    expect(() => positionsFor("C", "keyboard" as FrettedCardFace, THEME)).toThrow();
  });

  it("is published from the model entry", () => {
    expect(model.positionsFor).toBe(positionsFor);
    expect(model.POSITIONS_MAX_FRET).toBe(POSITIONS_MAX_FRET);
  });
});

describe("positionsFor: the alternatives", () => {
  it("respects the limit (default 4, the card included; at least the card)", () => {
    expect(positionsFor("C", "guitar", THEME)).toHaveLength(4);
    expect(positionsFor("C", "guitar", THEME, { limit: 2 })).toHaveLength(2);
    expect(positionsFor("C", "guitar", THEME, { limit: 1 }).map((p) => p.id)).toEqual(["card"]);
    expect(positionsFor("C", "guitar", THEME, { limit: 0 }).map((p) => p.id)).toEqual(["card"]);
  });

  it("are distinct sounding shapes with distinct labels, ordered up the neck after the card", () => {
    for (const chord of SWEEP) {
      for (const face of FACES) {
        const ps = tryPositions(chord, face);
        if (!ps) continue;
        const keys = ps.map((p) => absFrets(p).join(","));
        expect(new Set(keys).size, `${chord} ${face} shapes`).toBe(ps.length);
        expect(new Set(ps.map((p) => p.label)).size, `${chord} ${face} labels`).toBe(ps.length);
        expect(new Set(ps.map((p) => p.id)).size).toBe(ps.length);
        const frets = ps.slice(1).map((p) => p.fret);
        expect(frets, `${chord} ${face} order`).toEqual([...frets].sort((a, b) => a - b));
        for (const p of ps.slice(1)) expect(p.id).toBe(absFrets(p).map((f) => (f < 0 ? "x" : f)).join("-"));
      }
    }
  });

  it("every one sounds the chord: only chord tones, every required tone (guitar, ukulele, top 3)", () => {
    for (const chord of SWEEP) {
      const spelled = spelledChord(chord, { strict: true });
      const analysis = analyzeChordTones(spelled.root, spelled.pitchClasses);
      const allowed = new Set(analysis.tones.filter((t) => t.role !== "excluded").map((t) => t.pc));
      const required = analysis.tones.filter((t) => t.role === "required").map((t) => t.pc);
      for (const face of ["guitar", "ukulele", "guitar-top3"] as const) {
        const ps = tryPositions(chord, face);
        if (!ps) continue;
        for (const p of ps.slice(1)) {
          const pcs = pcsOf(p);
          for (const pc of pcs) expect(allowed.has(pc), `${chord} ${face} ${p.label}: ${pc}`).toBe(true);
          if (face === "guitar-top3") {
            // Top 3 voices the card's three tones (a seventh chord's shell).
            expect([...pcs].sort(), `${chord} top3 ${p.label}`).toEqual([...pcsOf(ps[0])].sort());
          } else {
            for (const pc of required) expect(pcs.has(pc), `${chord} ${face} ${p.label} lacks ${pc}`).toBe(true);
          }
        }
      }
    }
  });

  it("six-string alternatives keep the root lowest", () => {
    for (const chord of SWEEP) {
      const ps = tryPositions(chord, "guitar");
      if (!ps) continue;
      const root = pcOfNote(spelledChord(chord).root);
      for (const p of ps) expect(Math.min(...playbackFor(p.request).notes) % 12, `${chord} ${p.label}`).toBe(root);
    }
  });

  it("bass alternatives play root, fifth, octave", () => {
    for (const chord of SWEEP) {
      const ps = tryPositions(chord, "bass4");
      if (!ps) continue;
      const root = pcOfNote(spelledChord(chord).root);
      for (const p of ps) {
        const [r, fifth, octave] = playbackFor(p.request).notes;
        expect(r % 12, `${chord} ${p.label}`).toBe(root);
        expect(fifth - r).toBe(7);
        expect(octave - r).toBe(12);
      }
    }
  });

  it("fit the face's window and usable neck, with the window set above the nut", () => {
    for (const chord of SWEEP) {
      for (const face of FACES) {
        const ps = tryPositions(chord, face);
        if (!ps) continue;
        const { frets } = INSTRUMENTS[face];
        for (const p of ps.slice(1)) {
          const shape = p.request.shape as { position?: number; fingers: Array<[number, number | string]>; barres: Array<{ fret: number }> };
          const abs = absFrets(p);
          const hi = Math.max(...abs);
          expect(hi, `${chord} ${face} ${p.label}`).toBeLessThanOrEqual(POSITIONS_MAX_FRET[face]);
          const rel = [...shape.fingers.map(([, f]) => f).filter((f): f is number => typeof f === "number" && f > 0), ...shape.barres.map((b) => b.fret)];
          for (const f of rel) expect(f, `${chord} ${face} ${p.label} relative fret`).toBeLessThanOrEqual(frets);
          if ((shape.position ?? 1) > 1) {
            expect(shape.position).toBe(Math.min(...abs.filter((f) => f > 0)));
            expect(abs.includes(0), `${chord} ${face} ${p.label}: open string in a slid window`).toBe(false);
          } else {
            expect(hi).toBeLessThanOrEqual(frets);
          }
        }
      }
    }
  });

  it("are held by at most four fingers", () => {
    for (const chord of SWEEP) {
      for (const face of FACES) {
        const ps = tryPositions(chord, face);
        if (!ps) continue;
        for (const p of ps.slice(1)) {
          const shape = p.request.shape as { fingers: Array<[number, number | string, { text?: string }?]>; barres: Array<{ text?: string }> };
          const numbers = new Set([
            ...shape.fingers.map((f) => f[2]?.text).filter(Boolean),
            ...shape.barres.map((b) => b.text).filter(Boolean),
          ]);
          for (const n of numbers) expect(["1", "2", "3", "4"]).toContain(n);
        }
      }
    }
  });

  it("mark generated voicings, with the guitar request's keys", () => {
    const ps = positionsFor("C", "guitar", THEME);
    const keys = Object.keys(ps[0].request);
    for (const p of ps) {
      expect(Object.keys(p.request)).toEqual(keys);
      expect(p.request.generated).toBe(p.generated);
      expect(p.request.source).toBe(p.generated ? "generated" : "chords-db");
    }
    for (const p of positionsFor("C", "guitar-top3", THEME).slice(1)) {
      expect(p.request.generated ?? false).toBe(p.generated);
      if (p.kind === "generated") expect(p.generated).toBe(true);
    }
  });
});

describe("positionsFor: examples", () => {
  const summary = (chord: string, face: FrettedCardFace) =>
    positionsFor(chord, face, THEME).map((p) => `${p.label}${p.generated ? "*" : ""}`);

  it("C on guitar: the open card shape, then up the neck to chords-db's 8th-fret barre", () => {
    const ps = positionsFor("C", "guitar", THEME);
    expect(ps.map((p) => p.fret)).toEqual([1, 3, 5, 8]);
    expect(ps[3]).toMatchObject({ label: "8th fret", kind: "library", generated: false, id: "8-10-10-9-8-8" });
    expect((ps[3].request.shape as { position?: number }).position).toBe(8);
  });

  it("C on top 3: the card, two generated inversions, the card up an octave", () => {
    expect(summary("C", "guitar-top3")).toEqual(["Card shape", "3rd fret*", "8th fret*", "Up an octave (12th fret)"]);
  });

  it("C on ukulele: up an octave re-fingers the open strings at the 12th", () => {
    const ps = positionsFor("C", "ukulele", THEME);
    const octave = ps.find((p) => p.kind === "octave")!;
    expect(octave.label).toBe("Up an octave (12th fret)");
    expect(octave.id).toBe("12-12-12-15");
    expect(playbackFor(octave.request).notes).toEqual(playbackFor(ps[0].request).notes.map((n) => n + 12));
    expect((octave.request.shape as { position?: number }).position).toBe(12);
  });

  it("C on bass: the A-string pattern at the 3rd and 15th frets", () => {
    expect(summary("C", "bass4")).toEqual(["Card shape", "3rd fret, A string", "15th fret, A string"]);
  });

  it("an octave up plays every note an octave higher (top 3, guitar, bass)", () => {
    for (const [chord, face] of [["C", "guitar-top3"], ["Bbmaj7", "guitar"], ["G7", "bass4"], ["E", "guitar"]] as const) {
      const ps = positionsFor(chord, face, THEME);
      const octave = ps.find((p) => p.kind === "octave");
      expect(octave, `${chord} ${face}`).toBeDefined();
      expect(playbackFor(octave!.request).notes).toEqual(playbackFor(ps[0].request).notes.map((n) => n + 12));
    }
  });

  it("never offers the C-shape barre up an octave (the hand cannot reach back over the index)", () => {
    expect(positionsFor("C", "guitar", THEME).some((p) => p.kind === "octave")).toBe(false);
  });

  it("F#m7 on each instrument", () => {
    expect(summary("F#m7", "guitar")).toEqual(["Card shape", "4th fret", "7th fret*", "9th fret*"]);
    expect(summary("F#m7", "guitar-top3")).toEqual(["Card shape", "2nd fret*"]);
    expect(summary("F#m7", "ukulele")).toEqual(["Card shape", "5th fret", "9th fret", "11th fret"]);
    expect(summary("F#m7", "bass4")).toEqual(["Card shape", "2nd fret, E string", "14th fret, E string"]);
  });
});
