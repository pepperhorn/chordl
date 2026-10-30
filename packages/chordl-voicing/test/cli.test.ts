import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatChordFile } from "../src/index.js";
import { run } from "../src/cli/run.js";

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "chordl-voicing-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

async function cli(args: string[], cwd = dir) {
  let out = "", err = "";
  const code = await run(args, { cwd, stdout: (s) => { out += s; }, stderr: (s) => { err += s; } });
  return { code, out, err };
}
const newGuitar = (frets = "x32000", chord = "C:maj7") =>
  cli(["new", "--chord", chord, "--instrument", "guitar", "--frets", frets, "--author", "gh:alice"]);
const read = (p: string) => readFileSync(join(dir, p), "utf8");

describe("new", () => {
  it("creates a chord file that validate accepts", async () => {
    const r = await newGuitar();
    expect(r.code).toBe(0);
    const file = JSON.parse(read("chords/C/C__maj7.json"));
    expect(file.chord).toMatchObject({ id: "C:maj7", symbol: "Cmaj7", root: "C", quality: "maj7", bass: null, aliases: [] });
    const v = file.voicings[0];
    expect(v).toMatchObject({ rev: 1, previous: null, status: "live", tier: "community", licence: "CC0-1.0" });
    expect(v.id).toMatch(/^v_[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(v.provenance).toMatchObject({ source: "gh", authorId: "gh:alice" });
    expect(v.notes.map((n: { pitch: string }) => n.pitch)).toEqual(["C3", "E3", "G3", "B3", "E4"]);
    expect(v.realization).toMatchObject({ kind: "fretted", instrument: "guitar", baseFret: 1, barres: [], capo: null });
    expect(v.realization.tuning).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);
    expect(v.realization.strings).toEqual([null, 3, 2, 0, 0, 0]);
    expect(v.realization.fingers).toEqual([null, null, null, null, null, null]);
    const val = await cli(["validate"]);
    expect(val.err).toBe("");
    expect(val.code).toBe(0);
  });

  it("accepts the comma fret form and sets baseFret to the lowest fretted fret (open strings ignored)", async () => {
    const r = await newGuitar("8,x,9,9,8,x", "C:maj7");
    expect(r.code).toBe(0);
    const v = JSON.parse(read("chords/C/C__maj7.json")).voicings[0];
    expect(v.realization.strings).toEqual([8, null, 9, 9, 8, null]);
    expect(v.realization.baseFret).toBe(8);
  });

  it("a duplicate shape fails validate and keeps both entries", async () => {
    await newGuitar();
    await newGuitar();
    expect(JSON.parse(read("chords/C/C__maj7.json")).voicings).toHaveLength(2);
    const val = await cli(["validate"]);
    expect(val.code).toBe(1);
    expect(val.out + val.err).toContain("duplicate-shape");
  });

  it("spells ukulele from chord tones and uses encoded paths for sharps and slash chords", async () => {
    const r = await cli(["new", "--chord", "C#:maj7/E", "--instrument", "ukulele", "--frets", "1,1,1,3", "--author", "ph:u1"]);
    expect(r.code).toBe(0);
    const f = JSON.parse(read("chords/Cs/Cs__maj7_over_E.json"));
    expect(f.chord).toMatchObject({ symbol: "C#maj7/E", bass: "E" });
    expect(f.voicings[0].realization.tuning).toEqual(["G4", "C4", "E4", "A4"]);
    expect(f.voicings[0].provenance.source).toBe("ph");
  });

  it("writes keyboard voicings with | splitting hands", async () => {
    const r = await cli(["new", "--chord", "C:maj7", "--instrument", "piano", "--notes", "C3 E3 | G4 B4", "--author", "system:seed", "--tier", "curated"]);
    expect(r.code).toBe(0);
    const v = JSON.parse(read("chords/C/C__maj7.json")).voicings[0];
    expect(v.realization.hands).toEqual({ left: ["C3", "E3"], right: ["G4", "B4"] });
    expect(v.tier).toBe("curated");
    expect(v.provenance.source).toBe("system");
    const noBar = await cli(["new", "--chord", "C:maj7", "--instrument", "piano", "--notes", "C4 E4 G4 B4", "--author", "gh:a"]);
    expect(noBar.code).toBe(0);
    const vs = JSON.parse(read("chords/C/C__maj7.json")).voicings;
    expect(vs.find((x: { realization: { hands: { left: string[] } } }) => x.realization.hands.left.length === 0)).toBeTruthy();
    expect((await cli(["validate"])).code).toBe(0);
  });

  it("rejects bad input with exit 1 and a message", async () => {
    const bad = await cli(["new", "--chord", "H:foo", "--instrument", "guitar", "--frets", "x32000", "--author", "gh:a"]);
    expect(bad.code).toBe(1);
    expect(bad.err).toMatch(/chord/i);
    const bowed = await cli(["new", "--chord", "C:maj7", "--instrument", "violin", "--frets", "0000", "--author", "gh:a"]);
    expect(bowed.code).toBe(1);
    expect(bowed.err).toMatch(/by hand/);
    const len = await cli(["new", "--chord", "C:maj7", "--instrument", "guitar", "--frets", "x320", "--author", "gh:a"]);
    expect(len.code).toBe(1);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("exits 2 with usage for missing flags and unknown commands", async () => {
    const miss = await cli(["new", "--chord", "C:maj7"]);
    expect(miss.code).toBe(2);
    expect(miss.err).toMatch(/usage/i);
    const unk = await cli(["frobnicate"]);
    expect(unk.code).toBe(2);
    expect(unk.err).toMatch(/usage/i);
    expect((await cli([])).code).toBe(2);
  });
});

describe("new --barre and baseFret", () => {
  it("writes barres and passes checks for a barre shape", async () => {
    const r = await cli(["new", "--chord", "C:7", "--instrument", "guitar", "--frets", "x35353", "--barre", "3:1-5", "--author", "gh:a"]);
    expect(r.err).not.toMatch(/invalid/i);
    expect(r.code).toBe(0);
    const v = JSON.parse(read("chords/C/C__7.json")).voicings[0];
    expect(v.realization.barres).toEqual([{ fret: 3, fromString: 1, toString: 5 }]);
    expect(v.realization.baseFret).toBe(1);
  });
  it("rejects malformed --barre with exit 2", async () => {
    const r = await cli(["new", "--chord", "C:7", "--instrument", "guitar", "--frets", "x32310", "--barre", "bad", "--author", "gh:a"]);
    expect(r.code).toBe(2);
  });
  it("baseFret is the lowest fretted fret when the highest is above 5", async () => {
    await cli(["new", "--chord", "C:maj7", "--instrument", "guitar", "--frets", "8,x,9,9,8,x", "--author", "gh:a"]);
    expect(JSON.parse(read("chords/C/C__maj7.json")).voicings[0].realization.baseFret).toBe(8);
  });
  it("rejects more than one | in --notes with exit 2", async () => {
    const r = await cli(["new", "--chord", "C:maj7", "--instrument", "piano", "--notes", "C3 | E4 | G4", "--author", "gh:a"]);
    expect(r.code).toBe(2);
  });
});

describe("format", () => {
  it("--check fails on a mangled file and format fixes it", async () => {
    await newGuitar();
    const p = join(dir, "chords/C/C__maj7.json");
    const obj = JSON.parse(readFileSync(p, "utf8"));
    writeFileSync(p, "﻿" + JSON.stringify(obj, null, 4).replace(/\n/g, "\r\n"));
    const bad = await cli(["format", "--check"]);
    expect(bad.code).toBe(1);
    expect(bad.out + bad.err).toContain("chords/C/C__maj7.json");
    expect((await cli(["format"])).code).toBe(0);
    expect((await cli(["format", "--check"])).code).toBe(0);
    expect(read("chords/C/C__maj7.json").startsWith("{")).toBe(true);
    expect((await cli(["validate"])).code).toBe(0);
  });
});

describe("validate", () => {
  it("treats a missing chords dir as empty and checks history against --base", async () => {
    expect((await cli(["validate"])).code).toBe(0);
    await newGuitar();
    const base = mkdtempSync(join(tmpdir(), "chordl-base-"));
    try {
      mkdirSync(join(base, "chords/C"), { recursive: true });
      const text = read("chords/C/C__maj7.json");
      writeFileSync(join(base, "chords/C/C__maj7.json"), text);
      expect((await cli(["validate", "--base", base])).code).toBe(0);
      const o = JSON.parse(text);
      o.voicings[0].provenance.changeNote = "tampered";
      writeFileSync(join(base, "chords/C/C__maj7.json"), JSON.stringify(o, null, 2) + "\n");
      const r = await cli(["validate", "--base", base]);
      expect(r.code).toBe(1);
      expect(r.out + r.err).toContain("modified-history");
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});

describe("validate --base errors", () => {
  it("fails on a missing or non-directory base, accepts an empty real dir", async () => {
    expect((await cli(["validate", "--base", join(dir, "nope")])).code).toBe(1);
    writeFileSync(join(dir, "afile"), "x");
    const f = await cli(["validate", "--base", join(dir, "afile")]);
    expect(f.code).toBe(1);
    expect(f.err).toMatch(/not a directory/);
    const empty = mkdtempSync(join(tmpdir(), "chordl-empty-"));
    try { expect((await cli(["validate", "--base", empty])).code).toBe(0); } finally { rmSync(empty, { recursive: true, force: true }); }
  });
});

describe("bundle revisions", () => {
  it("excludes retired latest revisions and lists every revision", async () => {
    await newGuitar();
    await newGuitar("8,x,9,9,8,x");
    const p = join(dir, "chords/C/C__maj7.json");
    const file = JSON.parse(readFileSync(p, "utf8"));
    const first = file.voicings[0];
    const rev2 = { ...first, rev: 2, previous: 1, status: "retired" };
    file.voicings.push(rev2);
    writeFileSync(p, formatChordFile(file));
    expect((await cli(["validate"])).code).toBe(0);
    expect((await cli(["bundle", "--out", "out", "--version", "v2026.10.1"])).code).toBe(0);
    const m = JSON.parse(read("out/manifest.json"));
    expect(m.counts.voicings).toBe(1);
    expect(m.counts.byInstrument).toEqual({ guitar: 1 });
    expect(m.voicings).toHaveLength(3);
    const g = JSON.parse(read("out/by-instrument/guitar.json"));
    expect(g).toHaveLength(1);
    expect(g[0].id).not.toBe(first.id);
  });
});

describe("bundle", () => {
  it("writes manifest, catalogue and by-instrument with matching counts", async () => {
    await newGuitar();
    await newGuitar("8,x,9,9,8,x");
    await cli(["new", "--chord", "C:maj7", "--instrument", "piano", "--notes", "C3 E3 | G4 B4", "--author", "gh:a", "--tier", "curated"]);
    await cli(["new", "--chord", "G:7", "--instrument", "ukulele", "--frets", "0212", "--author", "gh:a"]);
    const r = await cli(["bundle", "--out", "out", "--version", "v2026.10.1"]);
    expect(r.code).toBe(0);
    const m = JSON.parse(read("out/manifest.json"));
    expect(m.version).toBe("v2026.10.1");
    expect(m.chordlVoicing).toBe("0.1.0");
    expect(typeof m.generatedAt).toBe("string");
    expect(m.counts).toEqual({ chords: 2, voicings: 4, byInstrument: { guitar: 2, keyboard: 1, ukulele: 1 }, byTier: { community: 3, curated: 1 } });
    expect(m.voicings).toHaveLength(4);
    expect(Object.keys(m.voicings[0]).sort()).toEqual(["chordId", "id", "pitch", "rev", "shape"]);
    const cat = JSON.parse(read("out/catalogue.json"));
    expect(cat).toHaveLength(2);
    const g = JSON.parse(read("out/by-instrument/guitar.json"));
    expect(g).toHaveLength(2);
    expect(JSON.parse(read("out/by-instrument/keyboard.json"))).toHaveLength(1);
  });

  it("requires --out and --version", async () => {
    expect((await cli(["bundle", "--out", "o"])).code).toBe(2);
  });
});
