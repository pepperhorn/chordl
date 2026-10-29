import { describe, expect, it } from "vitest";
import { analyzeChordTones, generateGuitarVoicings, positionSpellsChord } from "../src/voicingGenerator.js";
import { guitarPositionFor } from "../src/guitarPosition.js";
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
it("solves all 38 missing chords only at level 3 without losing defining tones or slash bass", () => {
  for (const c of missing38) {
    for (const level of [0,1,2] as const) {
      expect(generateGuitarVoicings(c.pitchClasses,{...c,level,limit:1}),c.name).toEqual([]);
    }
    const p = guitarPositionFor(c,{level:3});
    expect(p,c.name).not.toBeNull();
    if (!p?.generated)
      throw Error(c.name);
    expect(p.rootless,c.name).toBe(true);
    expect(p.omitted).toContain("1");
    expect(p.review.reasons).toContain("rootless");
    const analysis = analyzeChordTones(c.root,c.pitchClasses,c.bass,{level:3});
    expect(positionSpellsChord(p,analysis),c.name).toBe(true);
    const pcs = new Set(midi(p).map(m => m%12));
    const rootPc = analysis.tones.find(t=>t.degree === "1")!.pc;
    expect(pcs.has(rootPc)).toBe(false);
    for (const t of analysis.tones.filter(t => t.degree !== "1" && (t.role === "required" || /^(b?3|b?7)$/.test(t.degree))))
      expect(pcs.has(t.pc), `${c.name}: ${t.degree}`).toBe(true);
    if (c.bass)
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
  const a = guitarPositionFor({root:"Bb",pitchClasses:["Bb","D","F","Ab","C"],bass:"C#"})!;
  const b = guitarPositionFor({root:"Bb",pitchClasses:["Bb","D","F","Ab","C"],bass:"Db"})!;
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
    {root:"Ab",notes:["Ab","C","Ebb","Gb","Bbb"],old:[-1,11,10,11,10,10],max:6},
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
it("ranks the reviewed Fm/E low minor-ninth clash below a separated voicing", () => {
  const results = generateGuitarVoicings(["F", "Ab", "C"], { root: "F", bass: "E", limit: 100000 });
  const old = results.find(p => absolute(p).join() === "0,3,3,1,1,-1")!;
  expect(old.review.reasons).toContain("low-interval");
  expect(results[0].review.reasons).not.toContain("low-interval");
  expect(results[0].score).toBeLessThan(old.score);
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
