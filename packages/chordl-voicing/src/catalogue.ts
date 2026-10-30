import { isCanonical } from "./canonical.js";
import { checkVoicing } from "./checks.js";
import { parseChordId } from "./chordId.js";
import { withHashes } from "./hash.js";
import { validateChordFileSchema } from "./schema.js";
import type { ChordFile, Voicing } from "./types.js";

export interface CatalogueIssue { path: string; code: string; message: string }
export interface CatalogueReport { ok: boolean; errors: CatalogueIssue[]; warnings: CatalogueIssue[] }

// chords/<root dir>/<encoded id>.json ; `#`->`s`, `/`->`_over_`, `:`->`__` (raw `#` breaks raw/CDN URLs).
export function chordFilePath(chordId: string): string {
  const encode = (s: string) => s.replace(/#/g, "s").replace(/\//g, "_over_").replace(/:/g, "__");
  const root = encode(chordId.split(":")[0]);
  return `chords/${root}/${encode(chordId)}.json`;
}

const isChordPath = (p: string) => p.startsWith("chords/") && p.endsWith(".json");
const stripBom = (s: string) => s.replace(/^﻿/, "");

// Key-sorted JSON, so history comparison ignores key order.
function stable(v: unknown): string {
  const sort = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(sort);
    if (x && typeof x === "object") {
      return Object.fromEntries(Object.keys(x).sort().map((k) => [k, sort((x as Record<string, unknown>)[k])]));
    }
    return x;
  };
  return JSON.stringify(sort(v));
}

// Voicing entries of a file keyed `id@rev`; tolerant of files that do not pass the schema.
function historyOf(files: Map<string, string>): Map<string, { path: string; json: string }> {
  const out = new Map<string, { path: string; json: string }>();
  for (const [path, text] of files) {
    if (!isChordPath(path)) continue;
    let data: unknown;
    try { data = JSON.parse(stripBom(text)); } catch { continue; }
    const voicings = (data as { voicings?: unknown })?.voicings;
    if (!Array.isArray(voicings)) continue;
    for (const v of voicings as Voicing[]) {
      if (v && typeof v === "object" && typeof v.id === "string") out.set(`${v.id}@${v.rev}`, { path, json: stable(v) });
    }
  }
  return out;
}

export function validateCatalogue(
  head: Map<string, string>,
  base?: Map<string, string>,
  opts: { licences: string[] } = { licences: ["CC0-1.0"] },
): CatalogueReport {
  const errors: CatalogueIssue[] = [];
  const warnings: CatalogueIssue[] = [];
  const err = (path: string, code: string, message: string) => errors.push({ path, code, message });
  const warn = (path: string, code: string, message: string) => warnings.push({ path, code, message });

  const parsed: { path: string; file: ChordFile }[] = [];
  for (const path of [...head.keys()].filter(isChordPath).sort()) {
    const text = head.get(path)!;
    let data: unknown;
    try {
      data = JSON.parse(stripBom(text));
    } catch (e) {
      err(path, "schema", `Not valid JSON: ${(e as Error).message}`);
      continue;
    }
    const res = validateChordFileSchema(data);
    if (!res.ok) {
      err(path, "schema", res.errors.map((e) => `${e.path || "/"}: ${e.message}`).join("; "));
      continue;
    }
    parsed.push({ path, file: res.value });
  }

  const idFiles = new Map<string, string>(); // voicing id -> first file
  for (const { path, file } of parsed) {
    if (!isCanonical(head.get(path)!).ok) err(path, "not-canonical", "File is not in canonical form; run the formatter");
    const chordOk = parseChordId(file.chord.id) !== null;
    if (!chordOk) err(path, "chord-id", `Invalid chord id "${file.chord.id}"`);
    else if (chordFilePath(file.chord.id) !== path) err(path, "path-mismatch", `Expected path ${chordFilePath(file.chord.id)}`);

    const revs = new Map<string, Voicing[]>();
    for (const v of file.voicings) {
      if (v.chordId !== file.chord.id) err(path, "chord-id", `${v.id}@${v.rev}: chordId "${v.chordId}" differs from chord.id "${file.chord.id}"`);
      if (!opts.licences.includes(v.licence)) err(path, "licence", `${v.id}@${v.rev}: licence "${v.licence}" is not allowed`);
      try {
        const h = withHashes(v).hashes;
        if (h.shape !== v.hashes.shape || h.pitch !== v.hashes.pitch) err(path, "hash-mismatch", `${v.id}@${v.rev}: stored hashes do not match the content`);
      } catch (e) {
        err(path, "hash-mismatch", `${v.id}@${v.rev}: cannot compute hashes: ${(e as Error).message}`);
      }
      const res = checkVoicing(v);
      for (const f of res.hard) err(path, `check:${f.code}`, `${v.id}@${v.rev}: ${f.message}`);
      for (const f of res.flags) warn(path, `check:${f.code}`, `${v.id}@${v.rev}: ${f.message}`);
      revs.set(v.id, [...(revs.get(v.id) ?? []), v]);
    }
    for (const [id, list] of revs) {
      const sorted = [...list].sort((a, b) => a.rev - b.rev);
      const bad = sorted.some((v, i) => v.rev !== i + 1 || v.previous !== (i === 0 ? null : i));
      if (bad) err(path, "rev-chain", `${id}: revisions must be 1..n with previous = rev-1 (rev 1 previous null)`);
      const first = idFiles.get(id);
      if (first === undefined) idFiles.set(id, path);
      else if (first !== path) err(path, "id-reused", `${id} is already used in ${first}`);
    }
  }

  // Latest rev per id across files; only live ones are compared for duplicates.
  const latest = new Map<string, { path: string; v: Voicing }>();
  for (const { path, file } of parsed) {
    for (const v of file.voicings) {
      const cur = latest.get(v.id);
      if (!cur || v.rev > cur.v.rev) latest.set(v.id, { path, v });
    }
  }
  const live = [...latest.values()].filter((e) => e.v.status === "live").sort((a, b) => (a.v.id < b.v.id ? -1 : 1));
  const group = (key: (v: Voicing) => string, report: (e: { path: string; v: Voicing }, first: { path: string; v: Voicing }) => void) => {
    const seen = new Map<string, { path: string; v: Voicing }>();
    for (const e of live) {
      const k = key(e.v);
      const first = seen.get(k);
      if (first) report(e, first);
      else seen.set(k, e);
    }
  };
  group((v) => v.hashes.shape, (e, f) => err(e.path, "duplicate-shape", `${e.v.id} has the same shape as ${f.v.id}`));
  group((v) => v.hashes.pitch, (e, f) => {
    if (e.v.hashes.shape !== f.v.hashes.shape) {
      warn(e.path, "same-pitch", `${e.v.id} sounds the same pitches as ${f.v.id}`);
    }
  });

  if (base) {
    const before = historyOf(base);
    const after = historyOf(new Map([...head].filter(([p]) => isChordPath(p))));
    for (const [key, b] of before) {
      const h = after.get(key);
      if (!h) err(b.path, "removed-history", `${key} was removed`);
      else if (h.json !== b.json) err(h.path, "modified-history", `${key} was modified; history is append-only`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
