import { createRequire } from "node:module";
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { INSTRUMENTS } from "@pepperhorn/chordl-guitar";
import { Note } from "tonal";
import { ulid } from "ulid";
import {
  BOWED_INSTRUMENTS, checkVoicing, chordFilePath, chordIntervals, formatChordFile, isCanonical,
  labelNotes, parseChordId, parsePitch, validateCatalogue, validateChordFileSchema, withHashes,
} from "../index.js";
import type { ChordFile, Realization, Voicing } from "../index.js";

export interface CliIo { cwd: string; stdout(s: string): void; stderr(s: string): void }

const USAGE = `Usage:
  chordl-voicing new --chord <id> --instrument <id> (--frets <code> | --notes "<pitches>") --author <prefixed id> [--tier community|curated] [--barre <fret>:<from>-<to>]...
  chordl-voicing format [--check] [paths...]
  chordl-voicing validate [--base <dir>] [--licences <file>]
  chordl-voicing bundle --out <dir> --version <vYYYY.MM.N>
`;

class UsageError extends Error {}
class Failure extends Error {}

interface Args { flags: Map<string, string | true>; all: Map<string, string[]>; positional: string[] }
const BOOLEAN_FLAGS = new Set(["check"]);
const COMMAND_FLAGS: Record<string, string[]> = {
  new: ["chord", "instrument", "frets", "notes", "author", "tier", "barre"],
  format: ["check"],
  validate: ["base", "licences"],
  bundle: ["out", "version"],
};

function parseArgs(command: string, argv: string[]): Args {
  const allowed = COMMAND_FLAGS[command];
  const flags = new Map<string, string | true>();
  const all = new Map<string, string[]>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { positional.push(a); continue; }
    const name = a.slice(2);
    if (!allowed.includes(name)) throw new UsageError(`Unknown option --${name} for ${command}`);
    if (BOOLEAN_FLAGS.has(name)) { flags.set(name, true); continue; }
    const value = argv[++i];
    if (value === undefined) throw new UsageError(`Option --${name} needs a value`);
    flags.set(name, value);
    all.set(name, [...(all.get(name) ?? []), value]);
  }
  return { flags, all, positional };
}

function need(args: Args, name: string): string {
  const v = args.flags.get(name);
  if (typeof v !== "string") throw new UsageError(`Missing required option --${name}`);
  return v;
}
const opt = (args: Args, name: string): string | undefined => {
  const v = args.flags.get(name);
  return typeof v === "string" ? v : undefined;
};

// ---- file helpers -------------------------------------------------------------------

const stripBom = (s: string) => s.replace(/^﻿/, "");

function walkJson(root: string): string[] {
  const out: string[] = [];
  const visit = (rel: string) => {
    let entries;
    try { entries = readdirSync(join(root, rel), { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const r = `${rel}/${e.name}`;
      if (e.isDirectory()) visit(r);
      else if (e.isFile() && e.name.endsWith(".json")) out.push(r);
    }
  };
  visit("chords");
  return out;
}

function loadTree(root: string, mustExist = false): Map<string, string> {
  if (mustExist) {
    let ok = false;
    try { ok = statSync(root).isDirectory(); } catch { /* reported below */ }
    if (!ok) throw new Failure(`--base "${root}" is not a directory`);
  }
  const m = new Map<string, string>();
  for (const p of walkJson(root)) m.set(p, readFileSync(join(root, p), "utf8"));
  return m;
}

function loadChordFiles(cwd: string): ChordFile[] {
  const files: ChordFile[] = [];
  for (const [path, text] of loadTree(cwd)) {
    let data: unknown;
    try { data = JSON.parse(stripBom(text)); } catch (e) { throw new Failure(`${path}: not valid JSON (${(e as Error).message})`); }
    const res = validateChordFileSchema(data);
    if (!res.ok) throw new Failure(`${path}: fails schema validation; run "chordl-voicing validate"`);
    files.push(res.value);
  }
  return files;
}

// ---- new ---------------------------------------------------------------------------

function parseFrets(code: string, strings: number): (number | null)[] {
  const parts = code.includes(",") ? code.split(",").map((s) => s.trim()) : code.split("");
  const out = parts.map((p) => {
    if (p === "x" || p === "X") return null;
    if (!/^\d+$/.test(p)) throw new Failure(`Invalid fret "${p}" in --frets "${code}"`);
    return parseInt(p, 10);
  });
  if (out.length !== strings) {
    throw new Failure(`--frets "${code}" has ${out.length} strings but the instrument has ${strings}`);
  }
  return out;
}

// Spell a MIDI note using the chord tone of the same pitch class when there is one.
function spell(midi: number, tones: string[]): string {
  for (const name of tones) {
    const ref = Note.midi(`${name}4`);
    if (ref === null) continue;
    const diff = midi - ref;
    if (((diff % 12) + 12) % 12 === 0) return `${name}${4 + diff / 12}`;
  }
  return Note.fromMidi(midi);
}

function chordTones(chordId: string): string[] {
  const parsed = parseChordId(chordId)!;
  const tones = chordIntervals(chordId).map((iv) => Note.transpose(parsed.root, iv));
  if (parsed.bass) tones.push(parsed.bass);
  return tones;
}

function buildRealization(args: Args, chordId: string): Realization {
  const instrument = need(args, "instrument");
  const frets = opt(args, "frets");
  const notes = opt(args, "notes");
  if (Object.prototype.hasOwnProperty.call(BOWED_INSTRUMENTS, instrument)) {
    throw new Failure(`Bowed voicings (${instrument}) are written by hand; this command only creates fretted and keyboard voicings`);
  }
  if (instrument === "piano" || instrument === "keyboard") {
    if (notes === undefined) throw new UsageError("Keyboard voicings need --notes");
    if (frets !== undefined) throw new Failure("--frets does not apply to keyboard voicings; use --notes");
    if (notes.split("|").length > 2) throw new UsageError('--notes may contain at most one "|" (left | right)');
    const [left, right] = notes.includes("|")
      ? notes.split("|").map((s) => s.trim().split(/\s+/).filter(Boolean))
      : [[], notes.trim().split(/\s+/).filter(Boolean)];
    for (const p of [...left, ...right]) {
      if (!parsePitch(p)) throw new Failure(`Invalid pitch "${p}": use ASCII scientific pitch such as Eb4`);
    }
    if (left.length + right.length === 0) throw new Failure("--notes is empty");
    return { kind: "keyboard", hands: { left, right } };
  }
  if (!Object.prototype.hasOwnProperty.call(INSTRUMENTS, instrument)) {
    throw new Failure(`Unknown instrument "${instrument}"`);
  }
  if (notes !== undefined) throw new Failure("--notes only applies to keyboard voicings; use --frets");
  if (frets === undefined) throw new UsageError("Fretted voicings need --frets");
  const cfg = INSTRUMENTS[instrument as keyof typeof INSTRUMENTS];
  const strings = parseFrets(frets, cfg.openMidi.length);
  const barres = (args.all.get("barre") ?? []).map((b) => {
    const m = /^(\d+):(\d+)-(\d+)$/.exec(b);
    if (!m) throw new UsageError(`Invalid --barre "${b}"; expected <fret>:<fromString>-<toString> such as 3:1-5`);
    return { fret: +m[1], fromString: +m[2], toString: +m[3] };
  });
  const fretted = strings.filter((f): f is number => f !== null && f > 0);
  return {
    kind: "fretted",
    instrument,
    tuning: cfg.openMidi.map((m) => Note.fromMidi(m)),
    strings,
    fingers: strings.map(() => null),
    baseFret: fretted.length && Math.max(...fretted) > 5 ? Math.min(...fretted) : 1,
    barres,
    capo: null,
  };
}

function soundedPitches(r: Realization, chordId: string): string[] {
  if (r.kind === "keyboard") return [...r.hands.left, ...r.hands.right];
  if (r.kind !== "fretted") return [];
  const tones = chordTones(chordId);
  const out: { midi: number; name: string }[] = [];
  r.strings.forEach((f, i) => {
    if (f === null) return;
    const midi = parsePitch(r.tuning[i])!.midi + f + (r.capo ?? 0);
    out.push({ midi, name: spell(midi, tones) });
  });
  return out.sort((a, b) => a.midi - b.midi).map((o) => o.name);
}

function cmdNew(args: Args, io: CliIo): number {
  const chordId = need(args, "chord");
  need(args, "instrument");
  const author = need(args, "author");
  const tier = opt(args, "tier") ?? "community";
  if (tier !== "community" && tier !== "curated") throw new Failure(`--tier must be community or curated, not "${tier}"`);
  const colon = author.indexOf(":");
  if (colon < 1 || colon === author.length - 1) throw new Failure(`--author must be a prefixed id such as gh:alice, not "${author}"`);
  const parsed = parseChordId(chordId);
  if (!parsed) throw new Failure(`Invalid chord id "${chordId}"; expected <root>:<quality>[/<bass>] such as C:maj7`);

  const realization = buildRealization(args, chordId);
  const pitches = soundedPitches(realization, chordId);
  if (!pitches.length) throw new Failure("The voicing sounds no notes");
  const notes = labelNotes(chordId, pitches).map((n) => ({ pitch: n.pitch, degree: n.degree }));
  if (realization.kind === "keyboard") {
    notes.sort((a, b) => parsePitch(a.pitch)!.midi - parsePitch(b.pitch)!.midi);
  }

  const voicing = withHashes({
    schema: "chordl.voicing/1",
    id: `v_${ulid()}`,
    rev: 1,
    previous: null,
    chordId,
    status: "live",
    tier,
    licence: "CC0-1.0",
    notes,
    realization,
    provenance: {
      source: author.slice(0, colon),
      authorId: author,
      createdAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
      changeNote: null,
      basedOn: null,
      alternativeTo: null,
    },
    relations: { supersedes: null, supersededBy: null, duplicateOf: null },
    hashes: { shape: "", pitch: "" },
  } as Voicing);

  const check = checkVoicing(voicing);
  if (check.hard.length) {
    throw new Failure(`Voicing is invalid:\n${check.hard.map((f) => `  ${f.code}: ${f.message}`).join("\n")}`);
  }

  const rel = chordFilePath(chordId);
  const abs = join(io.cwd, rel);
  let file: ChordFile;
  try {
    file = JSON.parse(stripBom(readFileSync(abs, "utf8"))) as ChordFile;
    file.voicings.push(voicing);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw new Failure(`Cannot extend ${rel}: ${(e as Error).message}`);
    file = {
      schema: "chordl.chord/1",
      chord: {
        id: chordId,
        symbol: `${parsed.root}${parsed.quality}${parsed.bass ? `/${parsed.bass}` : ""}`,
        root: parsed.root,
        quality: parsed.quality,
        bass: parsed.bass,
        aliases: [],
      },
      voicings: [voicing],
    };
  }
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, formatChordFile(file));
  io.stdout(`${voicing.id} -> ${rel}\n`);
  for (const f of check.flags) io.stderr(`warning: ${f.code}: ${f.message}\n`);
  return 0;
}

// ---- format ------------------------------------------------------------------------

function lineDiff(path: string, actual: string, expected: string): string {
  const a = actual.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n");
  const e = expected.split("\n");
  const lines = [`--- ${path}`, `+++ ${path} (canonical)`];
  if (actual.startsWith("﻿")) lines.push("-<BOM>");
  if (actual.includes("\r")) lines.push("-<CRLF line endings>");
  for (let i = 0; i < Math.max(a.length, e.length); i++) {
    if (a[i] === e[i]) continue;
    if (a[i] !== undefined) lines.push(`-${i + 1}: ${a[i]}`);
    if (e[i] !== undefined) lines.push(`+${i + 1}: ${e[i]}`);
  }
  return lines.join("\n") + "\n";
}

function cmdFormat(args: Args, io: CliIo): number {
  const check = args.flags.get("check") === true;
  const paths = args.positional.length
    ? args.positional.map((p) => resolve(io.cwd, p))
    : walkJson(io.cwd).map((p) => join(io.cwd, p));
  let dirty = 0;
  for (const abs of paths) {
    const shown = abs.startsWith(io.cwd + "/") ? abs.slice(io.cwd.length + 1) : abs;
    const text = readFileSync(abs, "utf8");
    const res = isCanonical(text);
    if (!res.expected) throw new Failure(`${shown}: not valid JSON`);
    if (res.ok) continue;
    dirty++;
    if (check) io.stdout(lineDiff(shown, text, res.expected));
    else { writeFileSync(abs, res.expected); io.stdout(`formatted ${shown}\n`); }
  }
  if (check && dirty) {
    io.stderr(`${dirty} file(s) are not canonical; run "chordl-voicing format"\n`);
    return 1;
  }
  return 0;
}

// ---- validate ----------------------------------------------------------------------

function cmdValidate(args: Args, io: CliIo): number {
  const head = loadTree(io.cwd);
  const baseDir = opt(args, "base");
  const base = baseDir === undefined ? undefined : loadTree(resolve(io.cwd, baseDir), true);
  let licences = ["CC0-1.0", "public-domain"];
  const licFile = opt(args, "licences");
  if (licFile !== undefined) {
    const data = JSON.parse(readFileSync(resolve(io.cwd, licFile), "utf8")) as unknown;
    const list = Array.isArray(data) ? data : (data as { licences?: unknown })?.licences;
    if (!Array.isArray(list) || !list.every((x) => typeof x === "string")) {
      throw new Failure(`${licFile}: expected an array of licence ids`);
    }
    licences = list as string[];
  }
  const report = validateCatalogue(head, base, { licences });
  for (const e of report.errors) io.stdout(`error   ${e.path} [${e.code}] ${e.message}\n`);
  for (const w of report.warnings) io.stdout(`warning ${w.path} [${w.code}] ${w.message}\n`);
  io.stdout(`${head.size} file(s), ${report.errors.length} error(s), ${report.warnings.length} warning(s)\n`);
  return report.ok ? 0 : 1;
}

// ---- bundle ------------------------------------------------------------------------

function cmdBundle(args: Args, io: CliIo): number {
  const out = resolve(io.cwd, need(args, "out"));
  const version = need(args, "version");
  if (!/^v\d{4}\.\d{1,2}\.\d+$/.test(version)) throw new UsageError(`--version must look like v2026.10.1, not "${version}"`);
  const pkg = createRequire(import.meta.url)("../../package.json") as { version: string };

  const files = loadChordFiles(io.cwd);
  const latest = new Map<string, Voicing>();
  const revisions: Voicing[] = [];
  for (const f of files) {
    for (const v of f.voicings) {
      revisions.push(v);
      const cur = latest.get(v.id);
      if (!cur || v.rev > cur.rev) latest.set(v.id, v);
    }
  }
  const live = [...latest.values()].filter((v) => v.status === "live").sort((a, b) => (a.id < b.id ? -1 : 1));
  const instrumentOf = (v: Voicing) => (v.realization.kind === "keyboard" ? "keyboard" : v.realization.instrument);
  const tally = (key: (v: Voicing) => string) => {
    const m: Record<string, number> = {};
    for (const v of live) m[key(v)] = (m[key(v)] ?? 0) + 1;
    return Object.fromEntries(Object.keys(m).sort().map((k) => [k, m[k]]));
  };
  const manifest = {
    version,
    generatedAt: new Date().toISOString(),
    chordlVoicing: pkg.version,
    counts: { chords: files.length, voicings: live.length, byInstrument: tally(instrumentOf), byTier: tally((v) => v.tier) },
    voicings: revisions
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.rev - b.rev))
      .map((v) => ({ id: v.id, rev: v.rev, chordId: v.chordId, shape: v.hashes.shape, pitch: v.hashes.pitch })),
  };
  const write = (rel: string, data: unknown) => {
    const abs = join(out, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, JSON.stringify(data, null, 2) + "\n");
  };
  write("manifest.json", manifest);
  write("catalogue.json", files);
  for (const inst of Object.keys(manifest.counts.byInstrument)) {
    write(`by-instrument/${inst}.json`, live.filter((v) => instrumentOf(v) === inst));
  }
  io.stdout(`bundled ${manifest.counts.chords} chord file(s), ${live.length} live voicing(s) to ${out}\n`);
  return 0;
}

// ---- entry -------------------------------------------------------------------------

export async function run(argv: string[], io: CliIo): Promise<number> {
  const [command, ...rest] = argv;
  try {
    if (!command || !Object.prototype.hasOwnProperty.call(COMMAND_FLAGS, command)) {
      throw new UsageError(command ? `Unknown command "${command}"` : "Missing command");
    }
    const args = parseArgs(command, rest);
    switch (command) {
      case "new": return cmdNew(args, io);
      case "format": return cmdFormat(args, io);
      case "validate": return cmdValidate(args, io);
      default: return cmdBundle(args, io);
    }
  } catch (e) {
    if (e instanceof UsageError) {
      io.stderr(`${e.message}\n${USAGE}`);
      return 2;
    }
    io.stderr(`${(e as Error).message}\n`);
    return 1;
  }
}
