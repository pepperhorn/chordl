import { describe, expect, it } from "vitest";
import {
  analyzeChordTones,
  generateGuitarVoicings,
  VOICING_RULES,
} from "../src/voicingGenerator.js";
import type { GeneratedPosition } from "../src/voicingGenerator.js";
import { INSTRUMENTS } from "../src/instruments.js";
import { positionToMidi } from "../src/pitch.js";
import { sheetChords, slashChords } from "./fixtures/sheetCatalogue.js";

const OPEN = INSTRUMENTS.guitar.openMidi;

/** Absolute frets (0 = open, -1 = muted), the way guitarists write grips. */
function absolute(p: GeneratedPosition): number[] {
  return p.frets.map((f) => (f <= 0 ? f : f + p.baseFret - 1));
}

/** "x3234x" / "8x89(10)x" → absolute frets. */
function grip(s: string): number[] {
  return (s.match(/\(\d+\)|x|\d/g) ?? []).map((t) =>
    t === "x" ? -1 : Number(t.replace(/[()]/g, "")),
  );
}

function hasGridFor(notes: string[], g: string): boolean {
  return hasGrip(generateGuitarVoicings(notes, { limit: 40 }), g);
}

function hasGrip(results: GeneratedPosition[], ...grips: string[]): boolean {
  const want = grips.map((g) => grip(g).join(","));
  return results.some((p) => want.includes(absolute(p).join(",")));
}

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function pc(note: string): number {
  let v = PC[note[0]];
  for (const ch of note.slice(1)) v += ch === "#" ? 1 : ch === "b" ? -1 : 0;
  return ((v % 12) + 12) % 12;
}

describe("analyzeChordTones — the rule table", () => {
  const roles = (root: string, notes: string[]) =>
    Object.fromEntries(analyzeChordTones(root, notes).tones.map((t) => [t.degree, t.role]));

  it("names degrees by letter, so #9 and b3 are not confused", () => {
    expect(roles("C", ["C", "E", "G", "Bb", "D#"])).toEqual({
      "1": "required", "3": "required", "5": "optional", b7: "required", "#9": "required",
    });
  });

  it("keeps an altered fifth, drops nothing from a triad", () => {
    expect(roles("C", ["C", "E", "G#"])).toEqual({ "1": "required", "3": "required", "#5": "required" });
    expect(roles("C", ["C", "E", "G"])).toEqual({ "1": "required", "3": "required", "5": "required" });
  });

  it("13ths keep 1, 3, b7, 13 and may drop 5, 9, 11", () => {
    expect(roles("C", ["C", "E", "G", "Bb", "D", "A"])).toEqual({
      "1": "required", "3": "required", "5": "optional", b7: "required", "9": "optional", "13": "required",
    });
    expect(roles("C", ["C", "Eb", "G", "Bb", "D", "F", "A"])).toMatchObject({
      b3: "required", "9": "optional", "11": "optional", "13": "required",
    });
  });

  it("a #11 alone keeps the named 9 required", () => {
    expect(roles("C", ["C", "E", "G", "B", "D", "F#"])).toMatchObject({ "9": "required", "#11": "required" });
  });

  it("altered tensions are never optional", () => {
    expect(roles("C", ["C", "E", "G", "Bb", "Db", "F#", "A"])).toMatchObject({
      b9: "required", "#11": "required", "13": "required",
    });
  });

  it("dominant 11 drops the 3rd; minor 11 keeps b3 as preferred-optional", () => {
    expect(roles("C", ["C", "E", "G", "Bb", "D", "F"])).toMatchObject({
      "3": "excluded", "9": "optional", "11": "required",
    });
    expect(roles("C", ["C", "Eb", "G", "Bb", "D", "F"])).toMatchObject({
      b3: "preferred", "9": "optional", "11": "required",
    });
  });

  it("sus tones replace the 3rd and are required", () => {
    expect(roles("C", ["C", "D", "G"])).toEqual({ "1": "required", "2": "required", "5": "required" });
    expect(roles("C", ["C", "F", "G", "Bb", "D", "A"])).toMatchObject({
      "4": "required", "9": "optional", "13": "required",
    });
  });

  it("6 without a 7th, 13 with one; dim7's bb7 is required", () => {
    expect(roles("C", ["C", "E", "G", "A"])).toMatchObject({ "6": "required", "5": "optional" });
    expect(roles("C", ["C", "Eb", "Gb", "Bbb"])).toEqual({
      "1": "required", b3: "required", b5: "required", bb7: "required",
    });
  });

  it("every rule id it reports is documented in VOICING_RULES", () => {
    const ids = new Set(VOICING_RULES.map((r) => r.id));
    for (const c of [...sheetChords(), ...slashChords()].slice(0, 400)) {
      for (const id of analyzeChordTones(c.root, c.pitchClasses, c.bass).rules) {
        expect(ids.has(id)).toBe(true);
      }
    }
  });
});

describe("generateGuitarVoicings — known grips", () => {
  const gen = (notes: string[], bass?: string) =>
    generateGuitarVoicings(notes, { limit: 12, ...(bass ? { bass } : {}) });

  it("C7(#9): the Hendrix grip x3234x", () => {
    expect(hasGrip(gen(["C", "E", "G", "Bb", "D#"]), "x3234x")).toBe(true);
  });

  it("E7(#9): the movable x7678x is found (open-E grips outrank it)", () => {
    // With E as root, open strings give dozens of low, cheap grips; the
    // Hendrix shape is still produced, just further down the list.
    const r = generateGuitarVoicings(["E", "G#", "B", "D", "F##"], { limit: 150 });
    expect(hasGrip(r, "x7678x", "076780", "07678x")).toBe(true);
  });

  it("C9: x3233x / x32333", () => {
    expect(hasGrip(gen(["C", "E", "G", "Bb", "D"]), "x3233x", "x32333")).toBe(true);
  });

  it("C13: the shell + 13 grip 8x89(10)x", () => {
    // x32355 is also common, but its B+E pair is a pinky mini-barre above the
    // lowest fret, which the one-barre-at-the-lowest-fret rule does not allow.
    expect(hasGrip(gen(["C", "E", "G", "Bb", "D", "A"]), "8x89(10)x")).toBe(true);
  });

  it("C7(b9): x3232x", () => {
    expect(hasGrip(gen(["C", "E", "G", "Bb", "Db"]), "x3232x")).toBe(true);
  });

  it("Cm7b5: x3434x", () => {
    expect(hasGrip(gen(["C", "Eb", "Gb", "Bb"]), "x3434x")).toBe(true);
  });

  it("C6/9: x32233", () => {
    expect(hasGrip(gen(["C", "E", "G", "A", "D"]), "x32233")).toBe(true);
  });

  it("Cmaj7: x32000 ranks first", () => {
    expect(absolute(gen(["C", "E", "G", "B"])[0])).toEqual(grip("x32000"));
  });

  it("Am: x02210 ranks first; G7: 320001", () => {
    expect(absolute(gen(["A", "C", "E"])[0])).toEqual(grip("x02210"));
    expect(hasGrip(gen(["G", "B", "D", "F"]), "320001")).toBe(true);
  });

  it("C/E: the bass, not the root, is lowest", () => {
    const r = gen(["C", "E", "G"], "E");
    expect(hasGrip(r, "032010", "0x2010")).toBe(true);
    for (const p of r) expect(Math.min(...positionToMidi(p, OPEN)) % 12).toBe(4);
  });

  it("Bb/C: a slash bass outside the chord sits alone at the bottom", () => {
    const r = gen(["Bb", "D", "F"], "C");
    expect(r.length).toBeGreaterThan(0);
    for (const p of r) {
      const midi = positionToMidi(p, OPEN);
      const low = Math.min(...midi);
      expect(low % 12).toBe(0);
      expect(midi.filter((m) => m % 12 === 0)).toHaveLength(1);
    }
  });

  it("C7(#9) reports the 5th as omitted when it drops it", () => {
    const hendrix = gen(["C", "E", "G", "Bb", "D#"]).find(
      (p) => absolute(p).join(",") === grip("x3234x").join(","),
    )!;
    expect(hendrix.generated).toBe(true);
    expect(hendrix.omitted).toEqual(["5"]);
    expect(hendrix.rule).toMatch(/omit-unaltered-5th/);
  });
});

// ── invariants over the whole catalogue sample ─────────────────────────────

function checkInvariants(p: GeneratedPosition, root: string, notes: string[], bass?: string) {
  const analysis = analyzeChordTones(root, notes, bass);
  const abs = absolute(p);
  const midi = positionToMidi(p, OPEN);
  const pcs = new Set(midi.map((m) => m % 12));
  const allowed = new Set(analysis.tones.filter((t) => t.role !== "excluded").map((t) => t.pc));

  // every sounding note is a chord tone
  for (const m of midi) expect(allowed.has(m % 12)).toBe(true);
  // every required tone sounds
  for (const t of analysis.tones) if (t.role === "required") expect(pcs.has(t.pc)).toBe(true);
  // lowest note is the bass, on the lowest sounding string
  const low = Math.min(...midi);
  expect(low % 12).toBe(pc(bass ?? root));
  const firstString = abs.findIndex((f) => f >= 0);
  expect(midi[0]).toBe(low);
  expect(firstString).toBeGreaterThanOrEqual(0);
  // at least three strings
  expect(midi.length).toBeGreaterThanOrEqual(3);

  // stretch
  const fretted = abs.filter((f) => f > 0);
  if (fretted.length) {
    const lo = Math.min(...fretted);
    const span = Math.max(...fretted) - lo;
    expect(span).toBeLessThanOrEqual(lo > 5 ? 4 : 3);
  }

  // fingers: 1-4 on every fretted string, 0 elsewhere, ≤ 4 in use
  const used = new Set<number>();
  abs.forEach((f, i) => {
    if (f > 0) {
      expect(p.fingers[i]).toBeGreaterThanOrEqual(1);
      expect(p.fingers[i]).toBeLessThanOrEqual(4);
      used.add(p.fingers[i]);
    } else expect(p.fingers[i]).toBe(0);
  });
  expect(used.size).toBeLessThanOrEqual(4);
  // a finger number used on several strings must be a barre at the lowest fret
  for (const finger of used) {
    const strings = abs.map((f, i) => (f > 0 && p.fingers[i] === finger ? i : -1)).filter((i) => i >= 0);
    if (strings.length > 1) {
      expect(finger).toBe(1);
      expect(p.barres).toHaveLength(1);
    }
  }
  // barre: at the lowest fret, every string inside it fretted at or above it
  expect(p.barres.length).toBeLessThanOrEqual(1);
  for (const b of p.barres) {
    const barreFret = b + p.baseFret - 1;
    expect(barreFret).toBe(Math.min(...fretted));
    const on = abs.map((f, i) => (f === barreFret ? i : -1)).filter((i) => i >= 0);
    expect(on.length).toBeGreaterThanOrEqual(2);
    for (let i = on[0]; i <= on[on.length - 1]; i++) expect(abs[i]).toBeGreaterThanOrEqual(barreFret);
  }
  // finger order follows fret order
  const byFinger = abs
    .map((f, i) => ({ f, finger: p.fingers[i] }))
    .filter((x) => x.f > 0)
    .sort((a, b) => a.finger - b.finger);
  for (let i = 1; i < byFinger.length; i++) expect(byFinger[i].f).toBeGreaterThanOrEqual(byFinger[i - 1].f);

  // interior mutes: only one, directly above a bass on string 6 or 5
  const played = abs.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
  const gaps: number[] = [];
  for (let i = played[0]; i <= played[played.length - 1]; i++) if (abs[i] < 0) gaps.push(i);
  if (gaps.length) {
    expect(gaps).toEqual([played[0] + 1]);
    expect(played[0]).toBeLessThanOrEqual(1);
  }

  // omitted lists exactly the optional tones that do not sound
  const missing = analysis.tones.filter((t) => t.role !== "required" && t.role !== "excluded" && !pcs.has(t.pc));
  expect([...p.omitted].sort()).toEqual(missing.map((t) => t.degree).sort());
  expect(p.generated).toBe(true);
}

describe("generateGuitarVoicings — constraints are never violated", () => {
  const sample = [
    ...sheetChords().filter((_, i) => i % 3 === 0),
    ...slashChords().filter((_, i) => i % 17 === 0),
  ];

  it(`holds for every result across ${sample.length} catalogue chords`, () => {
    let checked = 0;
    for (const c of sample) {
      const results = generateGuitarVoicings(c.pitchClasses, { root: c.root, bass: c.bass, limit: 5 });
      for (const p of results) {
        checkInvariants(p, c.root, c.pitchClasses, c.bass);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(sample.length);
  }, 60_000);

  it("the barre rule: strings fretted below a partial barre sit one fret above it", () => {
    let partial = 0;
    for (const p of generateGuitarVoicings(["C", "E", "G", "Bb", "D", "A"], { limit: 200 })) {
      if (!p.barres.length) continue;
      const on = p.frets.map((f, i) => (f === p.barres[0] ? i : -1)).filter((i) => i >= 0);
      p.frets.slice(0, on[0]).forEach((f) => {
        if (f > 0) {
          partial++;
          expect(f).toBe(p.barres[0] + 1);
        }
      });
    }
    expect(partial).toBeGreaterThan(0);
  });

  it("D7(b9,b5): x54544, a partial barre over the A-string root", () => {
    expect(hasGridFor(["D", "F#", "Ab", "C", "Eb"], "x54544")).toBe(true);
  });
});

describe("generateGuitarVoicings — determinism and ranking", () => {
  it("returns identical results on repeated calls", () => {
    const a = generateGuitarVoicings(["F#", "A#", "C#", "E", "G##"], { limit: 10 });
    const b = generateGuitarVoicings(["F#", "A#", "C#", "E", "G##"], { limit: 10 });
    expect(b).toEqual(a);
  });

  it("is sorted by score, best first, with no duplicate grips", () => {
    const r = generateGuitarVoicings(["C", "E", "G", "Bb", "D", "A"], { limit: 30 });
    for (let i = 1; i < r.length; i++) expect(r[i].score).toBeGreaterThanOrEqual(r[i - 1].score);
    expect(new Set(r.map((p) => absolute(p).join(","))).size).toBe(r.length);
  });

  it("returns [] for a chord with no playable voicing rather than inventing one", () => {
    // seven distinct required tones cannot fit under four fingers and a root bass
    expect(generateGuitarVoicings(["C", "Db", "D", "Eb", "E", "F", "F#"], { limit: 5 })).toEqual([]);
  });
});
