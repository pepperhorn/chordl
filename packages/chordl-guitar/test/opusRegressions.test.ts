import { describe, expect, it } from "vitest";
import { analyzeChordTones, fingeringFor, generateGuitarVoicings, positionSpellsChord } from "../src/voicingGenerator.js";
import { guitarPositionFor } from "../src/guitarPosition.js";
import { spell } from "./fixtures/sheetCatalogue.js";
import regressions from "./fixtures/opus-regressions.json";
import { dbPositionToChord } from "../src/instruments.js";

const tuning = [40, 45, 50, 55, 59, 64];
const absolute = (p: {frets: number[]; baseFret: number}) => p.frets.map(f => f <= 0 ? f : f + p.baseFret - 1);
const pitches = (frets: number[]) => frets.flatMap((f, i) => f < 0 ? [] : [tuning[i] + f]);
const notes = (root: string, formula: string) => formula.split(" ").map(d => spell(root, d));
function lowOpenClash(frets: number[]) {
  return frets.some((f, i) => f >= 0 && frets.some((g, j) => {
    if (j <= i || g < 0 || (f !== 0 && g !== 0)) return false;
    const a = tuning[i] + f, b = tuning[j] + g, interval = Math.abs(a - b);
    return Math.min(a, b) < 52 && (interval === 1 || interval === 13);
  }));
}

describe("Opus musical regressions", () => {
  it("1: keeps every upper root over a written slash bass, including level 3 comping", () => {
    for (const f of regressions.filter(f => /9\//.test(f.symbol))) {
      const a = analyzeChordTones(f.chord.root, f.chord.pitchClasses, f.chord.bass, {level: 3, comping: true});
      expect(a.tones.find(t => t.degree === "1")?.role, f.symbol).toBe("required");
      for (const p of generateGuitarVoicings(f.chord.pitchClasses, {...f.chord, level: 3, limit: 1000}))
        expect(p.rootless, f.symbol).toBe(false);
    }
  });

  it("2: rejects low open-string semitones and minor ninths in search and library validation", () => {
    for (const c of [
      {root: "A", pitchClasses: ["A", "C#", "E#"], bass: "G#", bad: [4, 0, 3, 6, -1, -1]},
      {root: "G#", pitchClasses: notes("G#", "1 3 b5 b7 b9"), bad: [4, 0, 4, 5, 3, -1]},
      {root: "F", pitchClasses: ["F", "Ab", "C"], bass: "E", bad: [0, 3, 3, 1, 1, -1]},
    ]) {
      const a = analyzeChordTones(c.root, c.pitchClasses, c.bass, {level: 3});
      expect(positionSpellsChord({frets: c.bad, baseFret: 1, fingers: [], barres: []}, a)).toBe(false);
      const all = generateGuitarVoicings(c.pitchClasses, {...c, level: 3, limit: 100000});
      expect(all.length).toBeGreaterThan(0);
      expect(all.some(p => lowOpenClash(absolute(p)))).toBe(false);
    }
    // Mid-register colour remains legal: F#3 under open G3.
    const a = analyzeChordTones("G", notes("G", "1 3 5 7"), "C");
    expect(positionSpellsChord({frets: [-1, 3, 4, 0, 0, -1], baseFret: 1, fingers: [], barres: []}, a)).toBe(true);
  });

  it("3: holds a two-string mini-barre above the lowest fret and recovers rooted Ab9/Eb", () => {
    const frets = [-1, 6, 6, 5, 7, 6];
    const hand = fingeringFor(frets);
    expect(hand).not.toBeNull();
    expect(hand?.barre).toBe(6);
    expect(hand?.fingers[1]).toBe(hand?.fingers[2]);
    expect(hand?.fingers[1]).toBeGreaterThan(1);
    expect(hand?.count).toBe(4);
    const c = {root: "Ab", pitchClasses: notes("Ab", "1 3 5 b7 9"), bass: "Eb"};
    const p = guitarPositionFor(c, {level: 3});
    expect(p).not.toBeNull();
    expect(p?.generated && p.rootless).toBe(false);
    expect(generateGuitarVoicings(c.pitchClasses, {...c, limit: 100000}).some(p => absolute(p).join() === frets.join())).toBe(true);
  });

  it("draws only the two mini-barre contacts, retaining a separate finger at the same fret", () => {
    const chord = dbPositionToChord({frets: [-1, 2, 2, 1, 3, 2], baseFret: 5, fingers: [0, 2, 2, 1, 4, 3], barres: [2]}, 6);
    expect(chord.barres).toEqual([{fromString: 5, toString: 4, fret: 2, text: "2"}]);
    expect(chord.fingers).toContainEqual([1, 2, "3"]);
  });

  it("4: keeps the fifth in 6/m6 and the minor third in m11(b5)", () => {
    for (const root of ["C", "D", "Eb", "G"]) {
      for (const formula of ["1 3 5 6", "1 b3 5 6", "1 3 5 6 9"]) {
        const a = analyzeChordTones(root, notes(root, formula), "Db", {level: 3});
        expect(a.tones.find(t => t.degree === "5")?.role).toBe("required");
      }
      const a = analyzeChordTones(root, notes(root, "1 b3 b5 b7 9 11"), undefined, {level: 3});
      expect(a.tones.find(t => t.degree === "b3")?.role).toBe("required");
      const p = guitarPositionFor({root, pitchClasses: notes(root, "1 b3 b5 b7 9 11")}, {level: 3});
      expect(p).not.toBeNull();
      expect(pitches(absolute(p!)).some(m => m % 12 === a.tones.find(t => t.degree === "b3")!.pc)).toBe(true);
    }
  });

  it("5: puts rootless grips at A2 or above, and a lowest major seventh at C3 or above", () => {
    for (const [root, formula] of [["F#", "1 3 #5 7 9 #11 13"], ["Gb", "1 3 #5 7 9 #11 13"], ["A", "1 3 #5 7 9 #11 13"], ["D", "1 3 #5 7 9 #11"], ["C", "1 3 b5 b7 b9 13"]]) {
      const ns = notes(root, formula);
      const a = analyzeChordTones(root, ns, undefined, {level: 3});
      const all = generateGuitarVoicings(ns, {root, level: 3, limit: 100000});
      expect(all.length).toBeGreaterThan(0);
      for (const p of all.filter(p => p.rootless)) {
        const low = Math.min(...pitches(absolute(p)));
        expect(low).toBeGreaterThanOrEqual(45);
        if (a.tones.find(t => t.degree === "7")?.pc === low % 12) expect(low).toBeGreaterThanOrEqual(48);
      }
    }
  });

  it("6: avoids open dominant-third unisons and doubled thirteenths", () => {
    const ns = notes("G", "1 3 b5 b7 b9");
    const all = generateGuitarVoicings(ns, {root: "G", level: 3, limit: 100000});
    expect(all.some(p => absolute(p).join() === "3,4,3,4,0,4")).toBe(false);
    expect(all.length).toBeGreaterThan(0);
    const p = guitarPositionFor({root: "A", pitchClasses: notes("A", "1 3 5 b7 b9 13")}, {level: 3})!;
    expect(p).not.toBeNull();
    expect(pitches(absolute(p)).filter(m => m % 12 === 6)).toHaveLength(1);
  });

  it.each(regressions)("7: selects the old or an Opus-approved alternative for $symbol", f => {
    const p = guitarPositionFor(f.chord, {level: 3});
    expect(p, f.symbol).not.toBeNull();
    expect(f.approvedFrets.map(fs => fs.join()), f.symbol).toContain(absolute(p!).join());
  });
});
