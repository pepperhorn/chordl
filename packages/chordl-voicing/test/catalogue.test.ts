import { describe, expect, it } from "vitest";
import { chordFilePath, formatChordFile, labelNotes, validateCatalogue, withHashes } from "../src/index.js";
import type { ChordFile, Voicing } from "../src/index.js";

const ID1 = "v_01JBX9ZQ3M4N5P6R7S8T9V0W1X";
const ID2 = "v_01JBX9ZQ3M4N5P6R7S8T9V0W1Y";
const PATH = "chords/C/C__maj7.json";

const voicing = (over: Record<string, unknown> = {}, left = ["C3"], right = ["E4", "G4", "B4"]): Voicing => {
  const pitches = [...left, ...right];
  const v = {
    schema: "chordl.voicing/1", id: ID1, rev: 1, previous: null, chordId: "C:maj7",
    status: "live", tier: "community", licence: "CC0-1.0",
    notes: labelNotes("C:maj7", pitches).map((n) => ({ pitch: n.pitch, degree: n.degree })),
    realization: { kind: "keyboard", hands: { left, right } },
    provenance: { source: "user", authorId: "ph:user:1", createdAt: "2026-10-29T10:00:00Z", changeNote: null, basedOn: null, alternativeTo: null },
    relations: { supersedes: null, supersededBy: null, duplicateOf: null },
    hashes: { shape: "", pitch: "" },
    ...over,
  } as unknown as Voicing;
  return over.hashes ? v : withHashes(v);
};
const file = (voicings: Voicing[], chordOver: Record<string, unknown> = {}): ChordFile => ({
  schema: "chordl.chord/1",
  chord: { id: "C:maj7", symbol: "Cmaj7", root: "C", quality: "maj7", bass: null, aliases: [], ...chordOver },
  voicings,
}) as ChordFile;
const text = (voicings: Voicing[], chordOver: Record<string, unknown> = {}) => formatChordFile(file(voicings, chordOver));
const map = (entries: Record<string, string>) => new Map(Object.entries(entries));
const errs = (r: { errors: { code: string }[] }) => r.errors.map((e) => e.code);

describe("chordFilePath", () => {
  it("encodes root dir, #, / and :", () => {
    expect(chordFilePath("C#:maj7")).toBe("chords/Cs/Cs__maj7.json");
    expect(chordFilePath("C:maj7/E")).toBe("chords/C/C__maj7_over_E.json");
    expect(chordFilePath("C:7#9")).toBe("chords/C/C__7s9.json");
  });
});

describe("validateCatalogue", () => {
  it("accepts an empty head", () => {
    expect(validateCatalogue(new Map())).toEqual({ ok: true, errors: [], warnings: [] });
  });
  it("accepts a valid file and ignores non-chord paths", () => {
    const r = validateCatalogue(map({ [PATH]: text([voicing()]), "README.md": "x" }));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
  it("schema: bad JSON and bad shape stop further checks", () => {
    const r = validateCatalogue(map({ [PATH]: "{nope", "chords/C/C__m7.json": '{"schema":"x"}' }));
    expect(errs(r)).toEqual(["schema", "schema"]);
    expect(r.ok).toBe(false);
  });
  it("not-canonical", () => {
    const r = validateCatalogue(map({ [PATH]: text([voicing()]).replace(/\n/g, "\r\n") }));
    expect(errs(r)).toEqual(["not-canonical"]);
  });
  it("path-mismatch", () => {
    const r = validateCatalogue(map({ "chords/C/wrong.json": text([voicing()]) }));
    expect(errs(r)).toEqual(["path-mismatch"]);
  });
  it("chord-id: invalid chord.id and voicing chordId mismatch", () => {
    const bad = validateCatalogue(map({ "chords/C/x.json": text([voicing()], { id: "C:zzz" }) }));
    expect(errs(bad)).toContain("chord-id");
    const other = validateCatalogue(map({ [PATH]: text([voicing({ chordId: "C:maj7/E" })]) }));
    expect(errs(other)).toContain("chord-id");
  });
  it("hash-mismatch", () => {
    const v = voicing({ hashes: { shape: "sha256:" + "0".repeat(64), pitch: "sha256:" + "1".repeat(64) } });
    expect(errs(validateCatalogue(map({ [PATH]: text([v]) })))).toEqual(["hash-mismatch"]);
  });
  it("check:<hard code> errors and check:<flag> warnings", () => {
    const hard = voicing({ notes: [{ pitch: "C3", degree: "III" }, { pitch: "E4", degree: "III" }, { pitch: "G4", degree: "V" }, { pitch: "B4", degree: "VII" }] });
    const r = validateCatalogue(map({ [PATH]: text([hard]) }));
    expect(errs(r).some((c) => c.startsWith("check:"))).toBe(true);
    const flagged = voicing({}, ["C3"], ["E4", "G4", "B4", "D5"]);
    const r2 = validateCatalogue(map({ [PATH]: text([flagged]) }));
    expect(r2.ok).toBe(true);
    expect(r2.warnings.map((w) => w.code)).toContain("check:unwritten-addition:IX");
  });
  it("licence", () => {
    const r = validateCatalogue(map({ [PATH]: text([voicing({ licence: "MIT" })]) }));
    expect(errs(r)).toEqual(["licence"]);
    expect(validateCatalogue(map({ [PATH]: text([voicing({ licence: "MIT" })]) }), undefined, { licences: ["MIT"] }).ok).toBe(true);
  });
  it("rev-chain: gap and wrong previous", () => {
    const gap = validateCatalogue(map({ [PATH]: text([voicing(), voicing({ rev: 3, previous: 1 })]) }));
    expect(errs(gap)).toContain("rev-chain");
    const prev = validateCatalogue(map({ [PATH]: text([voicing(), voicing({ rev: 2, previous: null })]) }));
    expect(errs(prev)).toContain("rev-chain");
  });
  it("id-reused across files", () => {
    const other = text([voicing({ chordId: "C:maj7/E" })], { id: "C:maj7/E", symbol: "Cmaj7/E", bass: "E" });
    const r = validateCatalogue(map({ [PATH]: text([voicing()]), "chords/C/C__maj7_over_E.json": other }));
    expect(errs(r)).toContain("id-reused");
  });
  it("duplicate-shape on different ids; same-pitch warning", () => {
    const r = validateCatalogue(map({ [PATH]: text([voicing(), voicing({ id: ID2 })]) }));
    expect(errs(r)).toEqual(["duplicate-shape"]);
    const split = validateCatalogue(map({ [PATH]: text([voicing({}, ["C3", "B3"], ["E4", "G4"]), voicing({ id: ID2 }, ["C3"], ["B3", "E4", "G4"])]) }));
    expect(split.ok).toBe(true);
    expect(split.warnings.map((w) => w.code)).toContain("same-pitch");
  });
  it("same shape under another chord id is a warning; same chord id still errors", () => {
    const dim = (chordId: string, id: string, left: string[], right: string[]) =>
      voicing({
        id, chordId,
        notes: labelNotes(chordId, [...left, ...right]).map((n) => ({ pitch: n.pitch, degree: n.degree })),
        realization: { kind: "keyboard", hands: { left, right } },
      });
    const c = dim("C:dim7", ID1, ["C3"], ["Eb4", "Gb4", "Bbb4"]);
    const eb = dim("Eb:dim7", ID2, ["Dbb3"], ["Eb4", "Gb4", "Bbb4"]);
    const files = map({
      "chords/C/C__dim7.json": text([c], { id: "C:dim7", symbol: "Cdim7", quality: "dim7" }),
      "chords/Eb/Eb__dim7.json": text([eb], { id: "Eb:dim7", symbol: "Ebdim7", root: "Eb", quality: "dim7" }),
    });
    const r = validateCatalogue(files);
    expect(errs(r)).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toContain("same-shape-other-chord");
    const same = validateCatalogue(map({ [PATH]: text([voicing(), voicing({ id: ID2 })]) }));
    expect(errs(same)).toEqual(["duplicate-shape"]);
  });
  it("chord-id error when chord.root/quality/bass disagree with the id", () => {
    for (const over of [{ root: "D" }, { quality: "m7" }, { bass: "E" }]) {
      const r = validateCatalogue(map({ [PATH]: text([voicing()], over) }));
      expect(errs(r)).toContain("chord-id");
    }
  });
  it("duplicate-shape ignores non-live latest revs", () => {
    const r = validateCatalogue(map({ [PATH]: text([voicing(), voicing({ id: ID2, status: "retired" })]) }));
    expect(r.errors).toEqual([]);
  });
  it("modified-history and removed-history against base", () => {
    const base = map({ [PATH]: text([voicing()]) });
    const modified = validateCatalogue(map({ [PATH]: text([voicing({ tier: "curated" })]) }), base);
    expect(errs(modified)).toEqual(["modified-history"]);
    const removed = validateCatalogue(map({ [PATH]: text([voicing({ id: ID2 })]) }), base);
    expect(errs(removed)).toContain("removed-history");
    const deleted = validateCatalogue(new Map(), base);
    expect(errs(deleted)).toEqual(["removed-history"]);
  });
  it("moving an unchanged revision between files is not history damage", () => {
    const base = map({ "chords/C/old.json": text([voicing()]) });
    const r = validateCatalogue(map({ [PATH]: text([voicing()]) }), base);
    expect(errs(r)).not.toContain("removed-history");
    expect(errs(r)).not.toContain("modified-history");
  });
  it("status-only rev 2 keeps hashes and passes against base with rev 1", () => {
    const base = map({ [PATH]: text([voicing()]) });
    const head = map({ [PATH]: text([voicing(), voicing({ rev: 2, previous: 1, status: "retired" })]) });
    const r = validateCatalogue(head, base);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
