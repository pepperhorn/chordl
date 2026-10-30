import type { ChordFile, Voicing } from "./types.js";

// Key order for every object in a chord file, defined once. Mirrors the property order in types.ts.
export const KEY_ORDER = {
  file: ["schema", "chord", "voicings"],
  chord: ["id", "symbol", "root", "quality", "bass", "aliases"],
  voicing: [
    "schema", "id", "rev", "previous", "chordId", "status", "tier", "licence", "notes",
    "realization", "level", "provenance", "relations", "externalIds", "hashes",
  ],
  note: ["pitch", "degree"],
  fretted: ["kind", "instrument", "tuning", "strings", "fingers", "baseFret", "barres", "capo"],
  barre: ["fret", "fromString", "toString"],
  keyboard: ["kind", "hands", "fingering"],
  hands: ["left", "right"],
  fingering: ["left", "right"],
  bowed: ["kind", "instrument", "tuning", "stops", "position"],
  stop: ["string", "pitch", "finger"],
  provenance: ["source", "authorId", "createdAt", "changeNote", "basedOn", "alternativeTo"],
  relations: ["supersedes", "supersededBy", "duplicateOf"],
  hashes: ["shape", "pitch"],
} as const;

type Obj = Record<string, unknown>;

// Present keys in the given order; absent keys stay absent. Unknown keys are kept at the end
// (in their original order) so the formatter never drops data; the schema rejects them.
function order(o: unknown, keys: readonly string[], children: Record<string, (v: unknown) => unknown> = {}): unknown {
  if (o === null || typeof o !== "object" || Array.isArray(o)) return o;
  const src = o as Obj;
  const out: Obj = {};
  const emit = (k: string) => { out[k] = children[k] ? children[k](src[k]) : src[k]; };
  for (const k of keys) if (k in src && src[k] !== undefined) emit(k);
  for (const k of Object.keys(src)) if (!(k in out) && src[k] !== undefined) emit(k);
  return out;
}

const list = (f: (v: unknown) => unknown) => (v: unknown) => (Array.isArray(v) ? v.map(f) : v);
const K = KEY_ORDER;

function realization(v: unknown): unknown {
  const kind = (v as Obj | null)?.kind;
  if (kind === "fretted") return order(v, K.fretted, { barres: list((b) => order(b, K.barre)) });
  if (kind === "keyboard") {
    return order(v, K.keyboard, {
      hands: (h) => order(h, K.hands),
      fingering: (f) => order(f, K.fingering),
    });
  }
  if (kind === "bowed") return order(v, K.bowed, { stops: list((s) => order(s, K.stop)) });
  return v;
}

const voicing = (v: unknown) => order(v, K.voicing, {
  notes: list((n) => order(n, K.note)),
  realization,
  provenance: (p) => order(p, K.provenance),
  relations: (r) => order(r, K.relations),
  hashes: (h) => order(h, K.hashes),
});

const cmp = (a: Voicing, b: Voicing) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.rev - b.rev);

export function formatChordFile(file: ChordFile): string {
  const sorted = Array.isArray(file.voicings) ? [...file.voicings].sort(cmp) : file.voicings;
  const out = order({ ...file, voicings: sorted }, K.file, {
    chord: (c) => order(c, K.chord),
    voicings: list(voicing),
  });
  return JSON.stringify(out, null, 2) + "\n";
}

export function isCanonical(text: string): { ok: boolean; expected: string } {
  const normalised = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  let parsed: ChordFile;
  try {
    parsed = JSON.parse(normalised) as ChordFile;
  } catch {
    return { ok: false, expected: "" };
  }
  let expected: string;
  try {
    expected = formatChordFile(parsed);
  } catch {
    return { ok: false, expected: "" };
  }
  return { ok: text === expected, expected };
}
