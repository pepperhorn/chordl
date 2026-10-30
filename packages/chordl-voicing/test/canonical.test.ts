import { describe, expect, it } from "vitest";
import { formatChordFile, isCanonical, withHashes } from "../src/index.js";
import type { ChordFile, Voicing } from "../src/index.js";

const mk = (id: string, rev: number): Voicing => withHashes({
  schema: "chordl.voicing/1", id, rev, previous: rev === 1 ? null : rev - 1,
  chordId: "C:maj7", status: "live", tier: "curated", licence: "CC0-1.0",
  notes: [{ pitch: "C3", degree: "I" }],
  realization: { kind: "keyboard", hands: { left: ["C3"], right: [] } },
  provenance: { source: "s", authorId: "u_x", createdAt: "2026-01-01T00:00:00Z", changeNote: null, basedOn: null, alternativeTo: null },
  relations: { supersedes: null, supersededBy: null, duplicateOf: null },
  hashes: { shape: "", pitch: "" },
});
const file = (): ChordFile => ({
  schema: "chordl.chord/1",
  chord: { id: "C:maj7", symbol: "Cmaj7", root: "C", quality: "maj7", bass: null, aliases: [] },
  voicings: [mk("v_0000000000000000000000000B", 1), mk("v_0000000000000000000000000A", 2), mk("v_0000000000000000000000000A", 1)],
});

const shuffle = (o: unknown): unknown => {
  if (Array.isArray(o)) return o.map(shuffle);
  if (o && typeof o === "object") {
    return Object.fromEntries(Object.entries(o).reverse().map(([k, v]) => [k, shuffle(v)]));
  }
  return o;
};

describe("formatChordFile", () => {
  it("is independent of key order", () => {
    expect(formatChordFile(shuffle(file()) as ChordFile)).toBe(formatChordFile(file()));
  });
  it("sorts voicings by id then rev", () => {
    const out = JSON.parse(formatChordFile(file())) as ChordFile;
    expect(out.voicings.map((v) => [v.id.slice(-1), v.rev])).toEqual([["A", 1], ["A", 2], ["B", 1]]);
  });
  it("emits fixed key order", () => {
    const out = JSON.parse(formatChordFile(shuffle(file()) as ChordFile)) as ChordFile;
    expect(Object.keys(out)).toEqual(["schema", "chord", "voicings"]);
    expect(Object.keys(out.chord)).toEqual(["id", "symbol", "root", "quality", "bass", "aliases"]);
    expect(Object.keys(out.voicings[0])).toEqual([
      "schema", "id", "rev", "previous", "chordId", "status", "tier", "licence", "notes",
      "realization", "provenance", "relations", "hashes",
    ]);
    expect(Object.keys(out.voicings[0].provenance)).toEqual(["source", "authorId", "createdAt", "changeNote", "basedOn", "alternativeTo"]);
  });
  it("orders fretted realization and keeps absent optionals absent", () => {
    const f = file();
    f.voicings = [withHashes({ ...mk("v_0000000000000000000000000A", 1), level: "beginner", externalIds: { a: "1" },
      realization: { capo: null, barres: [], baseFret: 1, fingers: [null], strings: [0], tuning: ["E2"], instrument: "guitar", kind: "fretted" } })];
    const v = (JSON.parse(formatChordFile(shuffle(f) as ChordFile)) as ChordFile).voicings[0];
    expect(Object.keys(v.realization)).toEqual(["kind", "instrument", "tuning", "strings", "fingers", "baseFret", "barres", "capo"]);
    expect(Object.keys(v).slice(9, 12)).toEqual(["realization", "level", "provenance"]);
    expect(Object.keys(v)).toContain("externalIds");
    const plain = JSON.parse(formatChordFile(file())) as ChordFile;
    expect("level" in plain.voicings[0]).toBe(false);
    expect("externalIds" in plain.voicings[0]).toBe(false);
  });
  it("ends in LF, no CR, no BOM", () => {
    const out = formatChordFile(file());
    expect(out.endsWith("}\n")).toBe(true);
    expect(out).not.toContain("\r");
    expect(out.charCodeAt(0)).toBe(0x7b);
  });
});

describe("isCanonical", () => {
  const good = () => formatChordFile(file());
  it("accepts formatter output", () => {
    expect(isCanonical(good())).toEqual({ ok: true, expected: good() });
  });
  it("rejects CRLF, with LF expected", () => {
    const r = isCanonical(good().replace(/\n/g, "\r\n"));
    expect(r.ok).toBe(false);
    expect(r.expected).toBe(good());
  });
  it("rejects BOM, with BOM-free expected", () => {
    const r = isCanonical("﻿" + good());
    expect(r.ok).toBe(false);
    expect(r.expected).toBe(good());
  });
  it("rejects shuffled keys and missing trailing newline", () => {
    expect(isCanonical(JSON.stringify(shuffle(file()), null, 2) + "\n").ok).toBe(false);
    expect(isCanonical(good().trimEnd()).ok).toBe(false);
  });
  it("does not throw on bad JSON", () => {
    expect(isCanonical("{nope")).toEqual({ ok: false, expected: "" });
  });
});

describe("prototype-named keys", () => {
  const base = { schema: "chordl.chord/1", chord: { id: "C:7" }, voicings: [{ id: "a", rev: 1, realization: { kind: "fretted", barres: [{ fret: 3, fromString: 1, toString: 5 }] } }] };

  it("keeps a barre's toString field as data", () => {
    expect(formatChordFile(base as never)).toContain('"toString": 5');
  });

  it("does not copy an inherited toString onto a barre that lacks one", () => {
    const f = structuredClone(base);
    delete (f.voicings[0].realization.barres[0] as Record<string, unknown>).toString;
    expect(formatChordFile(f as never)).not.toContain('"toString"');
  });

  it("keeps an unknown own key named constructor", () => {
    const f = JSON.parse('{"schema":"chordl.chord/1","constructor":7,"chord":{"id":"C:7"},"voicings":[]}');
    expect(JSON.parse(formatChordFile(f)).constructor).toBe(7);
  });

  it("keeps a __proto__ own key from JSON.parse without changing the prototype", () => {
    const f = JSON.parse('{"schema":"chordl.chord/1","__proto__":{"polluted":true},"chord":{"id":"C:7"},"voicings":[]}');
    const text = formatChordFile(f);
    expect(text).toContain('"__proto__"');
    const back = JSON.parse(text);
    expect(Object.prototype.hasOwnProperty.call(back, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(back)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
