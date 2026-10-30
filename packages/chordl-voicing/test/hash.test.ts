import { describe, expect, it } from "vitest";
import { shapeHash, pitchHash, withHashes } from "../src/index.js";
import type { Realization, Voicing } from "../src/index.js";

const GUITAR = ["E2", "A2", "D3", "G3", "B3", "E4"];
const fretted = (over: Record<string, unknown> = {}): Realization => ({
  kind: "fretted", instrument: "guitar", tuning: GUITAR,
  strings: [null, 3, 2, 0, 0, 0], fingers: [null, 3, 2, null, null, null],
  baseFret: 1, barres: [], capo: null, ...over,
}) as Realization;
const keys = (left: string[], right: string[]): Realization => ({ kind: "keyboard", hands: { left, right } });

describe("shapeHash", () => {
  it("has sha256: prefix and 64 hex chars", () => {
    expect(shapeHash(fretted())).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(pitchHash(fretted())).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
  it("ignores fingers and barres", () => {
    const a = shapeHash(fretted());
    expect(shapeHash(fretted({ fingers: [null, 1, 1, null, null, null] }))).toBe(a);
    expect(shapeHash(fretted({ barres: [{ fret: 2, fromString: 1, toString: 2 }] }))).toBe(a);
  });
  it("changes with a fret, and with capo", () => {
    const a = shapeHash(fretted());
    expect(shapeHash(fretted({ strings: [null, 3, 2, 0, 0, 1] }))).not.toBe(a);
    expect(shapeHash(fretted({ capo: 2 }))).not.toBe(a);
    expect(shapeHash(fretted({ capo: 0 }))).toBe(a);
  });
  it("uses strings as absolute frets, not baseFret (R2)", () => {
    expect(shapeHash(fretted({ baseFret: 5 }))).toBe(shapeHash(fretted()));
  });
  it("keyboard: order within hand is irrelevant; hand split matters", () => {
    expect(shapeHash(keys(["C3", "G3"], ["E4"]))).toBe(shapeHash(keys(["G3", "C3"], ["E4"])));
    expect(shapeHash(keys(["C3"], ["G3", "E4"]))).not.toBe(shapeHash(keys(["C3", "G3"], ["E4"])));
  });
  it("bowed: stop order irrelevant, string matters", () => {
    const b = (stops: { string: number; pitch: string }[]): Realization => ({
      kind: "bowed", instrument: "violin", tuning: ["G3", "D4", "A4", "E5"], position: null,
      stops: stops.map((s) => ({ ...s, finger: null })),
    });
    const a = b([{ string: 0, pitch: "G3" }, { string: 1, pitch: "F4" }]);
    expect(shapeHash(b([{ string: 1, pitch: "F4" }, { string: 0, pitch: "G3" }]))).toBe(shapeHash(a));
    expect(shapeHash(b([{ string: 0, pitch: "G3" }, { string: 2, pitch: "F4" }]))).not.toBe(shapeHash(a));
  });
});

describe("pitchHash", () => {
  it("Eb4 and D#4 share a pitch hash", () => {
    expect(pitchHash(keys(["C3"], ["Eb4"]))).toBe(pitchHash(keys(["C3"], ["D#4"])));
  });
  it("differs for different pitches", () => {
    expect(pitchHash(keys(["C3"], ["E4"]))).not.toBe(pitchHash(keys(["C3"], ["F4"])));
  });
  it("same pitches via different shapes share pitch hash, not shape hash", () => {
    expect(pitchHash(keys(["C3"], ["E4", "G4"]))).toBe(pitchHash(keys(["C3", "E4"], ["G4"])));
    expect(shapeHash(keys(["C3"], ["E4", "G4"]))).not.toBe(shapeHash(keys(["C3", "E4"], ["G4"])));
  });
});

describe("withHashes", () => {
  const base = (): Voicing => ({
    schema: "chordl.voicing/1", id: "v_01ARZ3NDEKTSV4RRFFQ69G5FAV", rev: 1, previous: null,
    chordId: "C:maj7", status: "live", tier: "curated", licence: "CC0-1.0",
    notes: [], realization: fretted(),
    provenance: { source: "s", authorId: "u_x", createdAt: "2026-01-01T00:00:00Z", changeNote: null, basedOn: null, alternativeTo: null },
    relations: { supersedes: null, supersededBy: null, duplicateOf: null },
    hashes: { shape: "", pitch: "" },
  });
  it("fills hashes and does not mutate", () => {
    const v = base();
    const h = withHashes(v);
    expect(h.hashes.shape).toBe(shapeHash(v.realization));
    expect(h.hashes.pitch).toBe(pitchHash(v.realization));
    expect(v.hashes.shape).toBe("");
  });
  it("status, tier and provenance changes leave hashes unchanged", () => {
    const a = withHashes(base());
    const b = withHashes({ ...base(), rev: 2, previous: 1, status: "retired", tier: "community",
      provenance: { ...base().provenance, changeNote: "x", source: "other" } });
    expect(b.hashes).toEqual(a.hashes);
  });
});
