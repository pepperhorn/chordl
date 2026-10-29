import { describe, expect, it } from "vitest";
import { analyzeChordTones, generateGuitarVoicings, positionSpellsChord } from "../src/voicingGenerator.js";
import { guitarLibraryPositionsFor, guitarPositionFor } from "../src/guitarPosition.js";
import { reviewGuitarPosition } from "../src/voicingReview.js";
import { SHEET_ROOTS, spell } from "./fixtures/sheetCatalogue.js";
import missing38 from "./fixtures/missing38.json";
const open = [40, 45, 50, 55, 59, 64];
const absolute = (p: {
  frets: number[];
  baseFret: number;
}) => p.frets.map(f => f <= 0 ? f : f + p.baseFret - 1);
const midi = (p: {
  frets: number[];
  baseFret: number;
}) => absolute(p).flatMap((f, i) => f < 0 ? [] : [open[i] + f]);
it("retains the named ninth under #11 in every root, including altered fifths", () => {
  for (const root of SHEET_ROOTS)
    for (const degrees of ["1 3 5 7 9 #11", "1 b3 5 b7 9 #11", "1 3 #5 b7 9 #11", "1 3 #5 7 9 #11"]) {
    const notes = degrees.split(" ").map(d => spell(root,d));
    const analysis = analyzeChordTones(root,notes);
    const ninth = analysis.tones.find(t => t.degree === "9")!;
    expect(ninth.role).toBe("required");
    const results = generateGuitarVoicings(notes,{root,level:3,limit:4});
    expect(results.length, `${root}: ${degrees}`).toBeGreaterThan(0);
      for (const p of results)
        expect(midi(p).some(m => m % 12 === ninth.pc)).toBe(true);
  }
});
it("revisits the 38 missing chords with rooted mini-barres and safe level-3 rootless grips", () => {
  for (const c of missing38) {
    if (c.name === "G#9/B") {
      expect(guitarPositionFor(c, {level: 3})).toBeNull();
      continue; // The rootless upper is a different chord; no rooted grip fits the reach limit.
    }
    for (const level of [0,1,2] as const) {
      const lower = generateGuitarVoicings(c.pitchClasses,{...c,level,limit:1});
      expect(lower.every(p => !p.rootless), c.name).toBe(true);
    }
    const p = guitarPositionFor(c,{level:3});
    expect(p,c.name).not.toBeNull();
    if (!p?.generated) throw Error(c.name);
    expect(p.rootless, c.name).toBe(p.omitted.includes("1"));
    const analysis = analyzeChordTones(c.root,c.pitchClasses,c.bass,{level:3});
    expect(positionSpellsChord(p,analysis),c.name).toBe(true);
    const pcs = new Set(midi(p).map(m => m%12));
    const rootPc = analysis.tones.find(t=>t.degree === "1")!.pc;
    expect(pcs.has(rootPc)).toBe(!p.rootless);
    for (const t of analysis.tones.filter(t => t.degree !== "1" && (t.role === "required" || /^(b?3|b?7)$/.test(t.degree))))
      expect(pcs.has(t.pc), `${c.name}: ${t.degree}`).toBe(true);
    if (c.bass || !p.rootless)
      expect(Math.min(...midi(p)) % 12).toBe(analysis.bassPc);
    else
      expect(analysis.tones.filter(t => /^(b?3|b?7)$/.test(t.degree)).map(t => t.pc)).toContain(Math.min(...midi(p)) % 12);
  }
}, 60000);
it("does not make simple chords rootless just because level 3 is requested", () => {
  const results = generateGuitarVoicings(["C","E","G","Bb","D"],{level:3,limit:100});
  expect(results.length).toBeGreaterThan(0);
  expect(results.every(p=>!p.rootless && midi(p).some(m=>m%12===0))).toBe(true);
});
it("makes enharmonic slash and root twins share a shape and review key", () => {
  const a = guitarPositionFor({root:"Bb",pitchClasses:["Bb","D","F","Ab","C"],bass:"D#"})!;
  const b = guitarPositionFor({root:"Bb",pitchClasses:["Bb","D","F","Ab","C"],bass:"Eb"})!;
  expect(a.frets).toEqual(b.frets);
  expect(a.fingers).toEqual(b.fingers);
  expect(a.review.reviewKey).toBe(b.review.reviewKey);
  const sharp = guitarPositionFor({root:"C#",pitchClasses:["C#","E#","G#"]})!;
  const flat = guitarPositionFor({root:"Db",pitchClasses:["Db","F","Ab"]})!;
  expect(sharp.review.reviewKey).toBe(flat.review.reviewKey);
});
describe("ranking reviewed problem grips", () => {
  it.each([
    {root:"D",notes:["D","F","A","C"],bass:"G",old:[-1,10,10,10,10,10],max:5},
    {root:"Bb",notes:["Bb","Db","F"],bass:"Db",old:[-1,-1,-1,6,6,6],max:6},
  ])("prefers a low practical grip for $root/$bass", ({root,notes,bass,old,max}) => {
    const results = generateGuitarVoicings(notes,{root,bass,limit:100000});
    const best = absolute(results[0]);
    const previous = results.find(p=>absolute(p).join()===old.join())!;
    expect(previous).toBeDefined();
    expect(results[0].score).toBeLessThan(previous.score);
    expect(Math.min(...best.filter(f=>f>0))).toBeLessThanOrEqual(max);
    expect(best.findIndex(f=>f>=0)).toBeLessThanOrEqual(1);
  });
});
it("reports deterministic measurable reasons, confidence, and the review threshold", () => {
  const analysis = analyzeChordTones("C",["C","E","G","B"]);
  const clean = {frets:[-1,3,2,0,0,0],fingers:[0,3,2,0,0,0],baseFret:1,barres:[]};
  const r = reviewGuitarPosition(clean,analysis,{level:1,origin:"chords-db"});
  expect(r.reasons).toEqual([]);
  expect(r.confidence).toBeGreaterThanOrEqual(.8);
  expect(r.needsReview).toBe(false);
  const risky = {frets:[-1,1,1,1,1,1],fingers:[0,1,1,1,1,1],baseFret:10,barres:[1]};
  const rr = reviewGuitarPosition(risky,analysis,{level:3,origin:"search"});
  expect(rr.reasons).toEqual(expect.arrayContaining(["high-position","barre-5+"]));
  expect(rr.confidence).toBeLessThan(r.confidence);
  expect(rr.needsReview).toBe(rr.reasons.length>0 || rr.confidence<.8);
  expect(rr).toEqual(reviewGuitarPosition(risky,analysis,{level:3,origin:"search"}));
});
it("flags low semitones and minor ninths by register, rather than rejecting all colour", () => {
  const analysis = analyzeChordTones("C", ["C", "E", "G", "Bb", "Db"]);
  const review = (frets: number[]) => reviewGuitarPosition({ frets, baseFret: 1, fingers: [1, 2, 3, 4, 0, 0], barres: [] }, analysis);
  expect(review([0, 8, -1, -1, -1, -1]).reasons).toEqual(expect.arrayContaining(["b9-clash", "low-interval"])); // E2–F3
  expect(review([-1, -1, -1, 9, 6, -1]).reasons).not.toContain("low-interval"); // E4–F4: high semitone is allowed
});
it("rejects the reviewed Fm/E open low minor ninth while preserving a separated voicing", () => {
  const results = generateGuitarVoicings(["F", "Ab", "C"], { root: "F", bass: "E", limit: 100000 });
  const old = results.find(p => absolute(p).join() === "0,3,3,1,1,-1")!;
  expect(old).toBeUndefined();
  expect(results[0].review.reasons).not.toContain("low-interval");

});
it("ranks the reviewed Db7/C finger-spacing risk below a compact hand", () => {
  const results = generateGuitarVoicings(["Db", "F", "Ab", "Cb"], { root: "Db", bass: "C", limit: 100000 });
  const old = results.find(p => absolute(p).join() === "-1,3,3,6,0,4")!;
  expect(old.review.reasons).toContain("finger-spacing");
  expect(results[0].review.reasons).not.toContain("finger-spacing");
  expect(results[0].score).toBeLessThan(old.score);
});

it("explicit comping keeps guide tones and cannot enable rootlessness below level 3", () => {
  const notes = ["C","Eb","G","Bb","D","F"];
  const a = analyzeChordTones("C",notes,undefined,{level:3,comping:true});
  expect(a.tones.find(t=>t.degree==="b3")?.role).toBe("required");
  const results = generateGuitarVoicings(notes,{level:3,comping:true,limit:100000});
  expect(results.some(p=>p.rootless)).toBe(true);
  for (const p of results.filter(p=>p.rootless)) {
    const pcs = new Set(midi(p).map(m=>m%12));
    expect(pcs.has(3) && pcs.has(10)).toBe(true);
  }
  expect(generateGuitarVoicings(notes,{level:2,comping:true,limit:1000}).every(p=>!p.rootless)).toBe(true);
});

it("distinguishes a non-chord slash bass from a chord seventh in review policy", () => {
  const dim = guitarPositionFor({root:"D",pitchClasses:["D","F","Ab"],bass:"C"})!;
  const halfDim = guitarPositionFor({root:"D",pitchClasses:["D","F","Ab","C"],bass:"C"})!;
  const policy = (key:string) => key.split(":").slice(0,-3).join(":");
  expect(policy(dim.review.reviewKey)).not.toBe(policy(halfDim.review.reviewKey));
});
describe("a written bass equal to the root is never dropped by the public selectors", () => {
  const notes = ["C","E","G#","B","D","F#"];
  for (const bass of ["C","B#"]) {
    it(`bass ${bass}: root sounds lowest at level 3, via guitarPositionFor and guitarLibraryPositionsFor`, () => {
      const chord = {root:"C",pitchClasses:notes,bass};
      const p = guitarPositionFor(chord,{level:3});
      expect(p).not.toBeNull();
      const m = midi(p!);
      expect(Math.min(...m) % 12).toBe(0);
      expect(m.some(x => x % 12 === 0)).toBe(true);
      if (p!.generated) {
        expect(p!.rootless).toBeFalsy();
        expect(p!.omitted).not.toContain("1");
      }
      expect(p!.review.reasons).not.toContain("rootless");
      for (const lib of guitarLibraryPositionsFor(chord,{level:3}))
        expect(midi(lib).some(x => x % 12 === 0)).toBe(true);
    });
  }
  it("the unwritten-bass chord is still allowed to go rootless at level 3", () => {
    const p = guitarPositionFor({root:"C",pitchClasses:notes},{level:3});
    expect(p).not.toBeNull();
    expect(p!.generated && p!.rootless).toBe(true);
  });
});
describe("reviewGuitarPosition level", () => {
  const chord = {root:"C",pitchClasses:["C","E","G#","B","D","F#"]};
  it("defaults to the supplied analysis level, preserving the generated review key", () => {
    const p = guitarPositionFor(chord,{level:3});
    if (!p?.generated) throw Error("expected a generated position");
    const analysis = analyzeChordTones(chord.root,chord.pitchClasses,undefined,{level:3});
    const again = reviewGuitarPosition(p,analysis);
    expect(p.review.level).toBe(3);
    expect(again.level).toBe(3);
    expect(again.reviewKey).toBe(p.review.reviewKey);
    expect(again.reviewKey.startsWith("guitar:v1:3:")).toBe(true);
  });
  it("an explicit level still overrides the analysis", () => {
    const p = guitarPositionFor(chord,{level:3});
    if (!p?.generated) throw Error("expected a generated position");
    const analysis = analyzeChordTones(chord.root,chord.pitchClasses,undefined,{level:3});
    const r = reviewGuitarPosition(p,analysis,{level:1});
    expect(r.level).toBe(1);
    expect(r.reviewKey.startsWith("guitar:v1:1:")).toBe(true);
  });
});
