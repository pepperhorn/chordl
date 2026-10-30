import { describe, expect, it } from "vitest";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
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
  it("tuning is hashed as MIDI: Eb2 and D#2 are equal", () => {
    expect(shapeHash(fretted({ tuning: ["Eb2", ...GUITAR.slice(1)] }))).toBe(shapeHash(fretted({ tuning: ["D#2", ...GUITAR.slice(1)] })));
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

describe("golden vectors", () => {
  const sha = (s: string) => "sha256:" + bytesToHex(sha256(utf8ToBytes(s)));
  const bowed: Realization = {
    kind: "bowed", instrument: "violin", tuning: ["G3", "D4", "A4", "E5"], position: null,
    stops: [{ string: 1, pitch: "F4", finger: null }, { string: 0, pitch: "G3", finger: null }],
  };
  const cases: [string, Realization, string, string, string, string][] = [
    ["fretted", fretted(),
      "shape/1|fretted|guitar|40,45,50,55,59,64|capo=0|x,3,2,0,0,0",
      "sha256:0cf8b0b60521984fc5a169e22556964e72418a9fd6dc1bbf80b1800ce7b7bf88",
      "pitch/1|48,52,55,59,64",
      "sha256:9cb75abba89d486c5344fb4378a6e96c9b4a3176680219aaad26271ef33d3e40"],
    ["keyboard", keys(["G3", "C3"], ["B4", "Eb4"]),
      "shape/1|keyboard|L=48,55|R=63,71",
      "sha256:2deb6ff8f875934bbb8cbe2ed4f3e9728cb921dd566d7f1b865f50eb780b32b5",
      "pitch/1|48,55,63,71",
      "sha256:70b5b3ce1f51ed123f2962eb110e1baa47bd2900ce064d88d78eea29a396ba63"],
    ["bowed", bowed,
      "shape/1|bowed|violin|55,62,69,76|0:55,1:65",
      "sha256:5843edb5a85aa8a362afa14ec0b3a830194c1009853bf1c7772858406d6c1576",
      "pitch/1|55,65",
      "sha256:0fae030df9869de03b144ca42da8a69c9862e4776366378463bf6dc0570fae72"],
  ];
  it.each(cases)("%s", (_k, r, shapeStr, shapeDigest, pitchStr, pitchDigest) => {
    expect(sha(shapeStr)).toBe(shapeDigest);
    expect(sha(pitchStr)).toBe(pitchDigest);
    expect(shapeHash(r)).toBe(shapeDigest);
    expect(pitchHash(r)).toBe(pitchDigest);
  });
});
