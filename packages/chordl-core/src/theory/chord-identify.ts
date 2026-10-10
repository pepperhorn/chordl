import { ChordType, Interval } from "tonal";
import { PC_SEMITONES, SHARP_TO_FLAT } from "../engine/note-spelling.js";
import { resolveChord } from "../resolver/chord-resolver.js";

/**
 * Notes → chord-name recognition, and validation of a typed chord name
 * against a set of notes.
 *
 * The opposite direction to `resolveChord`: everything here compares
 * pitch-class sets, so it is enharmonic-agnostic (A–Db–E is an A major triad)
 * and ignores octaves and doubled notes. Chord shapes come from tonal's
 * `ChordType` dictionary, the same one `resolveChord` reads, so a name this
 * module accepts is a name the rest of chordl can draw.
 */

export interface IdentifyOptions {
  /**
   * Allowed chord-type symbols, tonal style ("M", "m", "dim", "maj7", "m7b5",
   * "add9", ...). Synonyms are accepted ("major", "Δ7", "°7"). `undefined`
   * allows every type tonal knows.
   */
  chordTypes?: string[];
  /** Accept slash names — inversions ("C/E") and pedal basses ("C/Ab"). Default true. */
  allowSlash?: boolean;
  /** Accept a chord whose perfect 5th is missing (C–D–E → "Cadd9"). Default true. */
  allowOmittedFifth?: boolean;
  /**
   * Name an inversion by its root ("C" for E–G–C). Default true. When false,
   * the first note passed is taken as the bass: a chord whose root is not the
   * bass must be written as a slash chord ("C/E").
   */
  inversionAgnostic?: boolean;
}

export interface ChordCandidate {
  /** Canonical display symbol, e.g. "Cmaj7", "C/Ab", "Abmaj7#5". */
  symbol: string;
  /** Spelled root, e.g. "C#" or "Db". */
  root: string;
  /** Canonical tonal chord-type symbol ("M" for a major triad). */
  type: string;
  /** Bass note of a slash name, spelled as given. */
  bass?: string;
  /** Chord tones left out of the notes, e.g. ["5"]. */
  omitted?: string[];
}

export interface ChordNameMatch {
  ok: boolean;
  /** Canonical spelling of the typed name, whenever it parsed. */
  normalized?: string;
  /** The parsed name as a candidate, when `ok`. */
  matched?: ChordCandidate;
  /** Everything `identifyChords` finds for the notes under the same options. */
  candidates: ChordCandidate[];
}

// ── Pitch-class sets as 12-bit masks ──

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FIFTH = 7;
/** An omitted-5th reading must still leave a triad's worth of notes. */
const MIN_NOTES_AFTER_OMISSION = 3;
/** A slash chord's upper structure must be at least a triad. */
const MIN_PEDAL_UPPER_NOTES = 3;

const bit = (pc: number) => 1 << pc;

function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

function pcsOf(mask: number): number[] {
  const out: number[] = [];
  for (let pc = 0; pc < 12; pc++) if (mask & bit(pc)) out.push(pc);
  return out;
}

function transpose(relMask: number, root: number): number {
  let out = 0;
  for (const pc of pcsOf(relMask)) out |= bit((pc + root) % 12);
  return out;
}

/** Both spellings of a black-key root, one for a white key. */
function rootSpellings(pc: number): string[] {
  const sharp = SHARP_NAMES[pc];
  const flat = SHARP_TO_FLAT[sharp];
  return flat ? [sharp, flat] : [sharp];
}

// ── Note and chord-type parsing ──

/** "c#4", " Bb ", "D♭" → "C#", "Bb", "Db". Null when it is not a note name. */
function spellNote(raw: string): string | null {
  const m = raw
    .trim()
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .match(/^([A-Ga-g])\s*([#b]?)\s*-?\d*$/);
  if (!m) return null;
  const name = m[1].toUpperCase() + m[2];
  return name in PC_SEMITONES ? name : null;
}

interface ParsedNotes {
  mask: number;
  /** Pitch class of the first note given — the bass when inversion matters. */
  bass: number;
  /** How the caller spelled each pitch class (first spelling wins). */
  spelling: Map<number, string>;
}

function parseNotes(notes: string[]): ParsedNotes | null {
  if (notes.length === 0) return null;
  const spelling = new Map<number, string>();
  let mask = 0;
  let bass = -1;
  for (const raw of notes) {
    const name = spellNote(raw);
    if (!name) return null;
    const pc = PC_SEMITONES[name];
    if (bass < 0) bass = pc;
    if (!spelling.has(pc)) spelling.set(pc, name);
    mask |= bit(pc);
  }
  return { mask, bass, spelling };
}

/**
 * Display-type overrides where tonal's first alias is not the symbol people
 * write: tonal lists "Madd9" before "add9", "m/ma7" before "mMaj7".
 */
const CANONICAL_TYPE: Record<string, string> = {
  Madd9: "add9",
  "m/ma7": "mMaj7",
  mM9: "mMaj9",
  "maj#4": "maj7#11",
  "M6#11": "6#11",
};

interface ChordShape {
  /** Canonical type symbol ("M" for major). */
  type: string;
  /** Pitch classes relative to the root. */
  mask: number;
}

function shapeFromIntervals(type: string, intervals: string[]): ChordShape {
  let mask = 0;
  for (const ivl of intervals) {
    const semis = Interval.semitones(ivl);
    if (Number.isInteger(semis)) mask |= bit(((semis % 12) + 12) % 12);
  }
  return { type, mask };
}

const TONAL_SHAPES: ChordShape[] = ChordType.all().map((t) =>
  shapeFromIntervals(CANONICAL_TYPE[t.aliases[0]] ?? t.aliases[0], t.intervals),
);

/**
 * Rewrite a typed chord quality into a symbol tonal recognises. Tolerates
 * spaces, parentheses, unicode accidentals and the common written synonyms:
 * maj/major/Δ → M, min/minor/- → m, ø → m7b5, ° → dim, + → aug, sus → sus4,
 * add2 → add9. The single letters M and m keep their case-sensitive meaning.
 */
function normalizeQuality(raw: string): string {
  let s = raw
    .replace(/[\s()]/g, "")
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .replace(/Δ/g, "maj");
  s = s.replace(/^major/i, "maj").replace(/^minor/i, "min");
  s = s.replace(/^min/i, "m").replace(/^-/, "m");
  s = s.replace(/^ø7?/, "m7b5").replace(/^°/, "dim");
  s = s.replace(/maj|dim|aug|sus|add|alt|omit|dom/gi, (w) => w.toLowerCase());
  s = s.replace(/^m(?:maj|M)(?=\d|$)/, "mMaj");
  if (s === "mMaj") s = "mMaj7";
  if (s === "maj" || s === "") s = "M";
  if (s === "+") s = "aug";
  s = s.replace(/sus(?![24])/, "sus4").replace(/add2/, "add9");
  return s;
}

/** Resolve a typed quality to a chord shape, or null when it is not a chord. */
function shapeForQuality(raw: string): ChordShape | null {
  const s = normalizeQuality(raw);
  const t = ChordType.get(s);
  if (!t.empty) {
    return shapeFromIntervals(CANONICAL_TYPE[t.aliases[0]] ?? t.aliases[0], t.intervals);
  }
  // Names tonal does not know but `resolveChord` builds (m6/9, 7omit3,
  // compound alterations like maj9#5#13): reuse its fallback rather than
  // re-deriving those chords here.
  try {
    const resolved = resolveChord(`C${s}`);
    return resolved.intervals?.length ? shapeFromIntervals(s, resolved.intervals) : null;
  } catch {
    return null;
  }
}

const displaySuffix = (type: string) => (type === "M" ? "" : type);

function allowedTypes(chordTypes: string[] | undefined): Set<string> | null {
  if (!chordTypes) return null;
  const set = new Set<string>();
  for (const t of chordTypes) {
    set.add(shapeForQuality(t)?.type ?? normalizeQuality(t));
  }
  return set;
}

interface ParsedSymbol {
  root: string;
  rootPc: number;
  shape: ChordShape;
  bass?: string;
  bassPc?: number;
}

/** Parse a typed chord symbol: root, quality, optional "/bass". */
function parseSymbol(input: string): ParsedSymbol | null {
  const m = input
    .trim()
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    .match(/^([A-Ga-g])\s*([#b]?)(.*)$/);
  if (!m) return null;
  const root = m[1].toUpperCase() + m[2];
  let quality = m[3];
  let bass: string | undefined;

  const slash = quality.match(/^(.*?)\/\s*([A-Ga-g]\s*[#b]?)\s*$/);
  if (slash) {
    quality = slash[1];
    const spelled = spellNote(slash[2]);
    if (!spelled) return null;
    bass = spelled;
  }

  const shape = shapeForQuality(quality);
  if (!shape || !(root in PC_SEMITONES)) return null;
  return {
    root,
    rootPc: PC_SEMITONES[root],
    shape,
    bass,
    bassPc: bass === undefined ? undefined : PC_SEMITONES[bass],
  };
}

// ── Matching ──

interface Resolved {
  ok: boolean;
  omitted?: string[];
}

/**
 * Does `shape` on `root`, with an optional slash bass, spell exactly `target`?
 * Tries the whole chord first, then — if allowed — the chord minus its
 * perfect 5th. A pedal bass (one that is not a chord tone, "C/Ab") requires
 * the whole chord above it: omitting the 5th there yields names like
 * "Abmaj7/E" that describe the notes but no musician would write.
 */
function spells(
  shape: ChordShape,
  root: number,
  target: number,
  bassPc: number | undefined,
  allowOmittedFifth: boolean,
): Resolved {
  const chord = transpose(shape.mask, root);
  const bassBit = bassPc === undefined ? 0 : bit(bassPc);
  const full = chord | bassBit;
  if (full === target) return { ok: true };
  const isPedal = bassBit !== 0 && !(chord & bassBit);
  const fifthPc = (root + FIFTH) % 12;
  // The 5th cannot be "omitted" while it is sounding as the bass.
  if (allowOmittedFifth && !isPedal && shape.mask & bit(FIFTH) && bassPc !== fifthPc) {
    const without = full & ~bit(fifthPc);
    if (without === target && popcount(without) >= MIN_NOTES_AFTER_OMISSION) {
      return { ok: true, omitted: ["5"] };
    }
  }
  return { ok: false };
}

function makeCandidate(
  root: string,
  type: string,
  bass: string | undefined,
  omitted: string[] | undefined,
): ChordCandidate {
  const c: ChordCandidate = {
    symbol: root + displaySuffix(type) + (bass ? `/${bass}` : ""),
    root,
    type,
  };
  if (bass) c.bass = bass;
  if (omitted) c.omitted = omitted;
  return c;
}

/**
 * Every chord name the given notes spell.
 *
 * Root-position names come first (the name whose root is the first note given
 * leads), then omitted-5th readings, then slash names. A black-key root is
 * offered in both spellings ("C#" and "Db") as separate candidates. Slash
 * names returned here are pedal basses — a non-chord-tone under a chord
 * ("C/Ab") — plus, when `inversionAgnostic` is false, inversions ("C/E").
 * Returns `[]` when any note is unparseable or nothing matches.
 */
export function identifyChords(notes: string[], opts: IdentifyOptions = {}): ChordCandidate[] {
  const { allowSlash = true, allowOmittedFifth = true, inversionAgnostic = true } = opts;
  const parsed = parseNotes(notes);
  if (!parsed) return [];
  const allowed = allowedTypes(opts.chordTypes);
  const shapes = allowed ? TONAL_SHAPES.filter((s) => allowed.has(s.type)) : TONAL_SHAPES;

  const found: { c: ChordCandidate; rank: number }[] = [];
  const push = (rootPc: number, type: string, bassPc: number | undefined, omitted?: string[]) => {
    const bass = bassPc === undefined ? undefined : parsed.spelling.get(bassPc);
    const rank =
      (bass ? 4 : 0) + (omitted ? 2 : 0) + (rootPc === parsed.bass && !bass ? 0 : 1);
    for (const root of rootSpellings(rootPc)) {
      found.push({ c: makeCandidate(root, type, bass, omitted), rank });
    }
  };

  // Plain names: the notes are exactly the chord (or the chord minus its 5th).
  for (const root of pcsOf(parsed.mask)) {
    for (const shape of shapes) {
      const r = spells(shape, root, parsed.mask, undefined, allowOmittedFifth);
      if (!r.ok) continue;
      if (inversionAgnostic || root === parsed.bass) push(root, shape.type, undefined, r.omitted);
      else if (allowSlash) push(root, shape.type, parsed.bass, r.omitted);
    }
  }

  // Pedal basses: one note under a chord that does not contain it.
  if (allowSlash) {
    const basses = inversionAgnostic ? pcsOf(parsed.mask) : [parsed.bass];
    for (const b of basses) {
      const upper = parsed.mask & ~bit(b);
      if (popcount(upper) < MIN_PEDAL_UPPER_NOTES) continue;
      for (const root of pcsOf(upper)) {
        for (const shape of shapes) {
          // A chord that contains the bass is an inversion, named above.
          if (transpose(shape.mask, root) & bit(b)) continue;
          const r = spells(shape, root, parsed.mask, b, allowOmittedFifth);
          if (r.ok) push(root, shape.type, b, r.omitted);
        }
      }
    }
  }

  const seen = new Set<string>();
  return found
    .map((f, i) => ({ ...f, i }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((f) => f.c)
    .filter((c) => (seen.has(c.symbol) ? false : (seen.add(c.symbol), true)));
}

/**
 * Check a typed chord name against a set of notes.
 *
 * The name is parsed tolerantly (see `normalizeQuality`) and is correct when
 * its pitch-class set equals the notes' set — or equals it with the perfect
 * 5th omitted, when `allowOmittedFifth`. A slash bass must be one of the
 * notes; the chord above it may contain it (an inversion, "C/E") or not (a
 * pedal, "C/Ab"). `normalized` is the canonical spelling of whatever parsed,
 * right or wrong, so a UI can echo it back.
 */
export function matchesChordName(
  input: string,
  notes: string[],
  opts: IdentifyOptions = {},
): ChordNameMatch {
  const { allowSlash = true, allowOmittedFifth = true, inversionAgnostic = true } = opts;
  const candidates = identifyChords(notes, opts);
  const sym = parseSymbol(input);
  if (!sym) return { ok: false, candidates };

  const normalized = makeCandidate(sym.root, sym.shape.type, sym.bass, undefined).symbol;
  const fail: ChordNameMatch = { ok: false, normalized, candidates };

  const parsed = parseNotes(notes);
  if (!parsed || popcount(parsed.mask) < 2) return fail;

  const allowed = allowedTypes(opts.chordTypes);
  if (allowed && !allowed.has(sym.shape.type)) return fail;

  const lowest = sym.bassPc ?? sym.rootPc;
  if (sym.bassPc !== undefined) {
    if (!allowSlash || !(parsed.mask & bit(sym.bassPc))) return fail;
  }
  if (!inversionAgnostic && lowest !== parsed.bass) return fail;

  const r = spells(sym.shape, sym.rootPc, parsed.mask, sym.bassPc, allowOmittedFifth);
  if (!r.ok) return fail;

  return {
    ok: true,
    normalized,
    matched: makeCandidate(sym.root, sym.shape.type, sym.bass, r.omitted),
    candidates,
  };
}
