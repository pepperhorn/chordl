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
   * "add9", ...). Synonyms are accepted ("major", "Δ", "°7"). `undefined`
   * allows every type tonal knows.
   */
  chordTypes?: string[];
  /** Accept slash names — inversions ("C/E") and pedal basses ("C/Ab"). Default true. */
  allowSlash?: boolean;
  /**
   * Accept pedal-bass (foreign-bass) slash names, whose bass is not a tone of
   * the chord above it: "C/Ab" for Ab–C–E–G, "A/C" for E–A–C#–C. Default
   * true. When false, only inversion slash names ("C/E", "C/G" for C–E–G)
   * are allowed. Has no effect when `allowSlash` is false.
   */
  allowPedalBass?: boolean;
  /** Accept a chord whose perfect 5th is missing (C–D–E → "Cadd9"). Default true. */
  allowOmittedFifth?: boolean;
  /**
   * Accept a chord whose 3rd (major or minor) is missing: D–A–C → "D7",
   * recorded as `omitted: ["3"]`. Default false. Combines with
   * `allowOmittedFifth` (A–C–D → "C6/9", `omitted: ["3", "5"]`) as long as at
   * least three notes sound. Never applies to sus or power chords, which have
   * no 3rd. A name typed with an explicit marker ("D7no3", "D7(omit3)") is
   * accepted whatever this option says.
   */
  allowOmittedThird?: boolean;
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
  /** Chord tones left out of the notes: ["5"], ["3"] or ["3", "5"]. */
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
/** An omitted-3rd or omitted-5th reading must still leave a triad's worth of notes. */
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
  /**
   * Pitch class (relative to the root) of the chord's 3rd, major or minor,
   * when it can be omitted: undefined for sus and power chords, which have
   * none, and when another chord tone shares its pitch class.
   */
  third?: number;
}

function shapeFromIntervals(type: string, intervals: string[]): ChordShape {
  let mask = 0;
  const pcs: number[] = [];
  let third: number | undefined;
  for (const ivl of intervals) {
    const semis = Interval.semitones(ivl);
    if (!Number.isInteger(semis)) continue;
    const pc = ((semis % 12) + 12) % 12;
    mask |= bit(pc);
    pcs.push(pc);
    if (Interval.get(ivl).num === 3) third = pc;
  }
  const shape: ChordShape = { type, mask };
  if (
    third !== undefined &&
    !/sus/.test(type) &&
    pcs.filter((pc) => pc === third).length === 1
  ) {
    shape.third = third;
  }
  return shape;
}

const TONAL_SHAPES: ChordShape[] = ChordType.all().map((t) =>
  shapeFromIntervals(CANONICAL_TYPE[t.aliases[0]] ?? t.aliases[0], t.intervals),
);

/**
 * Chord types chordl names that tonal's dictionary lacks. `resolveChord`
 * already builds these; listing them here lets `identifyChords` find them and
 * the `chordTypes` allow-list name them. Aliases are matched after
 * `normalizeQuality`, so "min7sus4" and "m7(sus4)" need no entry of their own.
 */
const CHORDL_EXTRA_TYPES: { type: string; aliases: string[]; intervals: string[] }[] = [
  // Minor 7th with an added 4th (A–C–D–E–G). "sus" is informal here, as in
  // "msus": the minor 3rd stays.
  { type: "m7sus4", aliases: ["m7sus4", "m7sus", "min7sus4"], intervals: ["1P", "3m", "4P", "5P", "7m"] },
].filter((t) => ChordType.get(t.type).empty);

const EXTRA_SHAPES: ChordShape[] = CHORDL_EXTRA_TYPES.map((t) =>
  shapeFromIntervals(t.type, t.intervals),
);

/** Every chord shape identification considers: tonal's, then chordl's extras. */
const ALL_SHAPES: ChordShape[] = [...TONAL_SHAPES, ...EXTRA_SHAPES];

function extraShape(normalized: string): ChordShape | null {
  const i = CHORDL_EXTRA_TYPES.findIndex((t) =>
    t.aliases.some((a) => normalizeQuality(a) === normalized),
  );
  return i >= 0 ? EXTRA_SHAPES[i] : null;
}

/**
 * Rewrite a typed chord quality into a symbol tonal recognises. Tolerates
 * spaces, parentheses, unicode accidentals and the common written synonyms:
 * maj/major → M, Δ → maj7 (Δ9 → maj9), min/minor/- → m, ø → m7b5, ° → dim,
 * + → aug, sus → sus4,
 * add2 → add9, msus/msus4/m(sus4)/minsus4/-sus4 → madd4 (minor add 4: the
 * informal "msus" keeps its minor 3rd, unlike a true sus chord). The single letters M and m keep their case-sensitive meaning.
 */
function normalizeQuality(raw: string): string {
  let s = raw
    .replace(/[\s()]/g, "")
    .replace(/♯/g, "#")
    .replace(/♭/g, "b")
    // A bare Δ is maj7, as in tonal and jazz usage; Δ before a number is
    // "maj" (Δ7, Δ9, Δ13).
    .replace(/Δ(?=\d)/g, "maj")
    .replace(/Δ/g, "maj7");
  s = s.replace(/^major/i, "maj").replace(/^minor/i, "min");
  s = s.replace(/^min/i, "m").replace(/^-/, "m");
  s = s.replace(/^ø7?/, "m7b5").replace(/^°/, "dim");
  s = s.replace(/maj|dim|aug|sus|add|alt|omit|dom/gi, (w) => w.toLowerCase());
  s = s.replace(/^m(?:maj|M)(?=\d|$)/, "mMaj");
  if (s === "mMaj") s = "mMaj7";
  if (s === "maj" || s === "") s = "M";
  if (s === "+") s = "aug";
  s = s.replace(/sus(?![24])/, "sus4").replace(/add2/, "add9");
  // "msus" is informal: a sus chord replaces its 3rd, but "Amsus" (A–C–D–E)
  // keeps the minor 3rd and adds the 4th, so it is tonal's madd4.
  if (s === "msus4") s = "madd4";
  return s;
}

/** Resolve a typed quality to a chord shape, or null when it is not a chord. */
function shapeForQuality(raw: string): ChordShape | null {
  const s = normalizeQuality(raw);
  const t = ChordType.get(s);
  if (!t.empty) {
    return shapeFromIntervals(CANONICAL_TYPE[t.aliases[0]] ?? t.aliases[0], t.intervals);
  }
  const extra = extraShape(s);
  if (extra) return extra;
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

/**
 * Common chord types first, so that when one set of notes spells several
 * names over the same bass the familiar one leads ("Abmaj7#5" before
 * "AbM7b6"). Types not listed keep tonal's dictionary order after these.
 */
const TYPE_PRIORITY = [
  "M", "m", "7", "maj7", "m7", "dim", "aug", "sus4", "sus2", "m7b5", "dim7",
  "6", "m6", "add9", "madd9", "7sus4", "m7sus4", "9", "maj9", "m9", "maj7#5", "mMaj7",
];
const SHAPE_ORDER = new Map(ALL_SHAPES.map((s, i) => [s.type, i]));

function typePriority(type: string): number {
  const i = TYPE_PRIORITY.indexOf(type);
  return i >= 0 ? i : TYPE_PRIORITY.length + (SHAPE_ORDER.get(type) ?? ALL_SHAPES.length);
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

type Omission = "3" | "5";

interface ParsedSymbol {
  root: string;
  rootPc: number;
  shape: ChordShape;
  bass?: string;
  bassPc?: number;
  /** Tones the name itself marks as left out ("D7no3", "Cmaj7(omit5)"). */
  omit: Omission[];
}

/**
 * One trailing omission marker: "omit3", "no5", "(no3)", " omit 5",
 * "(omit3,5)", "(no3, no5)".
 */
const OMISSION_MARKER =
  /[\s,]*\(?\s*(?:omit|no)\s*([35](?:\s*,\s*(?:(?:omit|no)\s*)?[35])*)\s*\)?\s*$/i;

/** Strip trailing omission markers off a typed quality. */
function stripOmissions(quality: string): { quality: string; omit: Omission[] } {
  const omit = new Set<Omission>();
  let q = quality;
  for (let m = q.match(OMISSION_MARKER); m && m[0].length; m = q.match(OMISSION_MARKER)) {
    for (const d of m[1].match(/[35]/g) ?? []) omit.add(d as Omission);
    q = q.slice(0, m.index);
  }
  return { quality: q, omit: (["3", "5"] as const).filter((d) => omit.has(d)) };
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

  const stripped = stripOmissions(quality);
  const shape = shapeForQuality(stripped.quality);
  if (!shape || !(root in PC_SEMITONES)) return null;
  // A marker must name a tone the chord has: "Csus4no3" and "C5no3" are not chords.
  if (stripped.omit.includes("3") && shape.third === undefined) return null;
  if (stripped.omit.includes("5") && !(shape.mask & bit(FIFTH))) return null;
  return {
    root,
    rootPc: PC_SEMITONES[root],
    shape,
    bass,
    bassPc: bass === undefined ? undefined : PC_SEMITONES[bass],
    omit: stripped.omit,
  };
}

// ── Matching ──

interface Resolved {
  ok: boolean;
  omitted?: string[];
}

interface OmissionRules {
  allowOmittedFifth: boolean;
  allowOmittedThird: boolean;
  /** Omissions the typed name marks explicitly: required, and allowed whatever the options. */
  required?: Omission[];
}

/** Omission sets in ranking order: none, 5th, 3rd, both. */
const OMISSION_SETS: Omission[][] = [[], ["5"], ["3"], ["3", "5"]];

/**
 * Does `shape` on `root`, with an optional slash bass, spell exactly `target`?
 * Tries the whole chord first, then — if allowed — the chord minus its
 * perfect 5th, minus its 3rd, and minus both. At least three notes must
 * remain after any omission. A pedal bass (one that is not a chord tone,
 * "C/Ab") requires the whole chord above it: omitting a tone there yields
 * names like "Abmaj7/E" that describe the notes but no musician would write.
 * A tone that is sounding as the bass cannot be omitted.
 */
function spells(
  shape: ChordShape,
  root: number,
  target: number,
  bassPc: number | undefined,
  rules: OmissionRules,
): Resolved {
  const chord = transpose(shape.mask, root);
  const bassBit = bassPc === undefined ? 0 : bit(bassPc);
  const full = chord | bassBit;
  const isPedal = bassBit !== 0 && !(chord & bassBit);
  const required = rules.required ?? [];
  const fifthPc = (root + FIFTH) % 12;
  const thirdPc = shape.third === undefined ? undefined : (root + shape.third) % 12;
  const can: Record<Omission, boolean> = {
    "5":
      (rules.allowOmittedFifth || required.includes("5")) &&
      !!(shape.mask & bit(FIFTH)) &&
      bassPc !== fifthPc,
    "3":
      (rules.allowOmittedThird || required.includes("3")) &&
      thirdPc !== undefined &&
      bassPc !== thirdPc,
  };
  for (const set of OMISSION_SETS) {
    if (!required.every((o) => set.includes(o))) continue;
    if (set.length === 0) {
      if (full === target) return { ok: true };
      continue;
    }
    if (isPedal || !set.every((o) => can[o])) continue;
    let without = full;
    if (set.includes("5")) without &= ~bit(fifthPc);
    if (set.includes("3")) without &= ~bit(thirdPc!);
    if (without === target && popcount(without) >= MIN_NOTES_AFTER_OMISSION) {
      return { ok: true, omitted: set };
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
 * leads), then omitted-5th readings, then omitted-3rd readings, then readings
 * missing both, then slash names. Within each of those
 * groups, common chord types come before rare ones (see `TYPE_PRIORITY`). A black-key root is
 * offered in both spellings ("C#" and "Db") as separate candidates. Slash
 * names returned here are pedal basses — a non-chord-tone under a chord
 * ("C/Ab"), unless `allowPedalBass` is false — plus, when `inversionAgnostic`
 * is false, inversions ("C/E").
 * Returns `[]` when any note is unparseable or nothing matches.
 */
export function identifyChords(notes: string[], opts: IdentifyOptions = {}): ChordCandidate[] {
  const {
    allowSlash = true,
    allowPedalBass = true,
    allowOmittedFifth = true,
    allowOmittedThird = false,
    inversionAgnostic = true,
  } = opts;
  const rules: OmissionRules = { allowOmittedFifth, allowOmittedThird };
  const parsed = parseNotes(notes);
  if (!parsed) return [];
  const allowed = allowedTypes(opts.chordTypes);
  const shapes = allowed ? ALL_SHAPES.filter((s) => allowed.has(s.type)) : ALL_SHAPES;

  const found: { c: ChordCandidate; rank: number; priority: number }[] = [];
  const push = (rootPc: number, type: string, bassPc: number | undefined, omitted?: string[]) => {
    const bass = bassPc === undefined ? undefined : parsed.spelling.get(bassPc);
    const group = omitted ? OMISSION_SETS.findIndex((s) => s.join() === omitted.join()) : 0;
    const rank =
      (bass ? 2 * OMISSION_SETS.length : 0) + 2 * group + (rootPc === parsed.bass && !bass ? 0 : 1);
    for (const root of rootSpellings(rootPc)) {
      found.push({ c: makeCandidate(root, type, bass, omitted), rank, priority: typePriority(type) });
    }
  };

  // Plain names: the notes are exactly the chord (or the chord minus its 5th and/or 3rd).
  for (const root of pcsOf(parsed.mask)) {
    for (const shape of shapes) {
      const r = spells(shape, root, parsed.mask, undefined, rules);
      if (!r.ok) continue;
      if (inversionAgnostic || root === parsed.bass) push(root, shape.type, undefined, r.omitted);
      else if (allowSlash) push(root, shape.type, parsed.bass, r.omitted);
    }
  }

  // Pedal basses: one note under a chord that does not contain it.
  if (allowSlash && allowPedalBass) {
    const basses = inversionAgnostic ? pcsOf(parsed.mask) : [parsed.bass];
    for (const b of basses) {
      const upper = parsed.mask & ~bit(b);
      if (popcount(upper) < MIN_PEDAL_UPPER_NOTES) continue;
      for (const root of pcsOf(upper)) {
        for (const shape of shapes) {
          // A chord that contains the bass is an inversion, named above.
          if (transpose(shape.mask, root) & bit(b)) continue;
          const r = spells(shape, root, parsed.mask, b, rules);
          if (r.ok) push(root, shape.type, b, r.omitted);
        }
      }
    }
  }

  const seen = new Set<string>();
  return found
    .map((f, i) => ({ ...f, i }))
    .sort((a, b) => a.rank - b.rank || a.priority - b.priority || a.i - b.i)
    .map((f) => f.c)
    .filter((c) => (seen.has(c.symbol) ? false : (seen.add(c.symbol), true)));
}

/**
 * Check a typed chord name against a set of notes.
 *
 * The name is parsed tolerantly (see `normalizeQuality`) and is correct when
 * its pitch-class set equals the notes' set — or equals it with the perfect
 * 5th omitted, when `allowOmittedFifth`, and/or the 3rd omitted, when
 * `allowOmittedThird`. Explicit markers ("D7no3", "Cmaj7(omit5)",
 * "C6/9(no3,5)") require the marked tone to be absent and are accepted
 * whatever the options; `normalized` writes them as "(no3)", "(no5)" or
 * "(no3,5)". A slash bass must be one of the
 * notes; the chord above it may contain it (an inversion, "C/E") or not (a
 * pedal, "C/Ab"; rejected when `allowPedalBass` is false). Whether the bass is
 * a chord tone is judged against the whole chord, so "Cadd9/E" over E–C–D is
 * an inversion even with its 5th omitted. `normalized` is the canonical spelling of whatever parsed,
 * right or wrong, so a UI can echo it back.
 */
export function matchesChordName(
  input: string,
  notes: string[],
  opts: IdentifyOptions = {},
): ChordNameMatch {
  const {
    allowSlash = true,
    allowPedalBass = true,
    allowOmittedFifth = true,
    allowOmittedThird = false,
    inversionAgnostic = true,
  } = opts;
  const candidates = identifyChords(notes, opts);
  const sym = parseSymbol(input);
  if (!sym) return { ok: false, candidates };

  const marker = sym.omit.length ? `(no${sym.omit.join(",")})` : "";
  const normalized =
    sym.root + displaySuffix(sym.shape.type) + marker + (sym.bass ? `/${sym.bass}` : "");
  const fail: ChordNameMatch = { ok: false, normalized, candidates };

  const parsed = parseNotes(notes);
  if (!parsed || popcount(parsed.mask) < 2) return fail;

  const allowed = allowedTypes(opts.chordTypes);
  if (allowed && !allowed.has(sym.shape.type)) return fail;

  const lowest = sym.bassPc ?? sym.rootPc;
  if (sym.bassPc !== undefined) {
    if (!allowSlash || !(parsed.mask & bit(sym.bassPc))) return fail;
    const isChordTone = transpose(sym.shape.mask, sym.rootPc) & bit(sym.bassPc);
    if (!allowPedalBass && !isChordTone) return fail;
  }
  if (!inversionAgnostic && lowest !== parsed.bass) return fail;

  const r = spells(sym.shape, sym.rootPc, parsed.mask, sym.bassPc, {
    allowOmittedFifth,
    allowOmittedThird,
    required: sym.omit,
  });
  if (!r.ok) return fail;

  return {
    ok: true,
    normalized,
    matched: makeCandidate(sym.root, sym.shape.type, sym.bass, r.omitted),
    candidates,
  };
}
