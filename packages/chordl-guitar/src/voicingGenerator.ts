/**
 * Playable six-string voicings for chords chords-db has no shape for.
 *
 * chords-db stays the authority wherever it has an entry (see
 * guitarPosition.ts). This fills the gaps — 13(#11,b9), maj9(#11,#5), slash
 * chords over arbitrary basses — with shapes that obey the same physical rules
 * a teacher would check, and flags every one `generated: true` so it can be
 * reviewed before it is trusted.
 *
 * Output is a chords-db position (window-relative frets, baseFret, fingers,
 * barres), so it renders through `dbPositionToChord` like any other shape.
 *
 * ── Which tones must sound (VOICING_RULES) ────────────────────────────────
 *
 * Degrees are named by LETTER distance from the root, not by semitones, so a
 * spelled chord says what it means: D# over C is #9, Eb is b3; F# is #11, Gb
 * is b5; G# is #5, Ab is b13. Each tone then gets a role:
 *
 *   required   must sound
 *   preferred  should sound; dropping it costs heavily and is reported
 *   optional   may be dropped by standard practice; reported in `omitted`
 *   excluded   must NOT sound (it clashes, by convention)
 *
 * | id                     | when                                       | effect                          |
 * |------------------------|--------------------------------------------|---------------------------------|
 * | root                   | always (level 3 dense/comping chords may omit root)     | 1 required                      |
 * | third                  | a 3rd is spelled                           | 3 / b3 required                 |
 * | sus                    | no 3rd; a 2nd or 4th is spelled            | 2 / 4 required (replaces the 3rd) |
 * | seventh                | a 7th is spelled (7, b7, bb7)              | required                        |
 * | sixth                  | 6 with no 7th (6, m6, 6/9)                 | 6 required                      |
 * | add-tension            | 9 / 11 with no 7th (add9, m(add9), 6/9)    | required                        |
 * | altered                | b9 #9 #11 b5 #5 b13                        | required, always                |
 * | omit-unaltered-5th     | perfect 5th in a chord of 4+ tones         | 5 optional                      |
 * | ninth-under-11-or-13   | natural 9 with a 7th and a natural 11 or 13  | 9 optional                      |
 * | eleventh-under-13      | natural 11 with a 7th and a 13             | 11 optional; excluded against a major 3rd |
 * | thirteenth             | 13 / b13 with a 7th                        | required                        |
 * | dominant-11-drops-3    | major 3rd + b7 + natural 11                | 3 excluded (b9 clash with 11)   |
 * | minor-11-prefers-b3    | minor 3rd + b7 + natural 11                | b3 preferred, not required      |
 * | slash-bass             | a bass is given                            | bass required and lowest; a bass outside the chord is not doubled |
 *
 * 13ths keep 3 b7 13; only explicit level-3 policy may omit the root.
 * 11ths keep 1 b7 11.
 *
 * ── What a hand can play ──────────────────────────────────────────────────
 *
 *   - at most 4 fretting fingers; a barre is one finger, only at the lowest
 *     fretted fret, across strings that are all fretted at or above it;
 *     fretted strings below a partial barre sit at most one fret above it
 *     (x32233 yes, 858555 no)
 *   - stretch: highest − lowest fretted fret ≤ 3 (a 4-fret box), ≤ 4 when the
 *     lowest fretted fret is above 5
 *   - at least 3 sounding strings
 *   - the lowest sounding string carries the bass (root, or the slash bass),
 *     and it is the lowest pitch (rootless level 3 permits a guide-tone bass)
 *   - interior mutes: only one, directly above a bass on string 6 or 5 (the
 *     jazz "root, skip, shell" pattern, e.g. 8x89(10)x); anything else is a
 *     pick-hand problem
 *   - open strings only when they are chord tones (every sounding note must be)
 */
import { reviewGuitarPosition, voicingSignals } from "./voicingReview.js";
import type { GuitarReview, TeachingLevel } from "./voicingReview.js";
import type { ChordsDbPosition } from "./instruments.js";
import { INSTRUMENTS } from "./instruments.js";

export type ToneRole = "required" | "preferred" | "optional" | "excluded";

export interface ChordTone {
  note: string;
  pc: number;
  /** Degree as a musician names it in context: 1, b3, 3, 4, b5, 5, #5, 6, b7, 7, b9, 9, #11, 13 … */
  degree: string;
  role: ToneRole;
}

export interface ChordToneAnalysis {
  tones: ChordTone[];
  /** Written root/slash bass; rootless policy may permit guide-tone basses. */
  bassPc: number;
  /** VOICING_RULES ids that applied. */
  rules: string[];
  /** Permitted lowest pitch classes; rootless shapes are further checked at evaluation. */
  bassPcs: number[];
  level: TeachingLevel;
}

export interface VoicingRule {
  id: string;
  description: string;
}

/** The rule table above, as data — `rule` on every GeneratedPosition cites these ids. */
export const VOICING_RULES: VoicingRule[] = [
  { id: "root", description: "1 required except explicit level-3 rootless policy" },
  { id: "rootless-level-3", description: "level 3: dense/comping chords may omit root; guide tone or written slash bass lowest" },
  { id: "third", description: "3 / b3 required" },
  { id: "sus", description: "no 3rd: the 2 or 4 replaces it and is required" },
  { id: "seventh", description: "7, b7 or bb7 required" },
  { id: "sixth", description: "6 with no 7th is required" },
  { id: "add-tension", description: "9 or 11 with no 7th (add chords) is required" },
  { id: "altered", description: "b9, #9, #11, b5, #5, b13 are always required" },
  { id: "omit-unaltered-5th", description: "perfect 5th optional in chords of 4+ tones" },
  { id: "ninth-under-11-or-13", description: "natural 9 optional only under natural 11 or 13 above a 7th" },
  { id: "eleventh-under-13", description: "natural 11 optional in a 13th chord; excluded against a major 3rd" },
  { id: "thirteenth", description: "13 / b13 with a 7th is required" },
  { id: "dominant-11-drops-3", description: "major 3rd excluded against b7 + natural 11" },
  { id: "minor-11-prefers-b3", description: "b3 preferred (droppable at a cost) against b7 + natural 11" },
  { id: "slash-bass", description: "bass required and lowest; a non-chord bass is not doubled" },
];

export interface GeneratedPosition extends ChordsDbPosition {
  generated: true;
  /** VOICING_RULES ids that shaped this voicing, "+"-joined. */
  rule: string;
  /** Optional/preferred degrees this voicing leaves out. */
  omitted: string[];
  /** Lower is better; results are sorted ascending. */
  score: number;
  rootless: boolean;
  review: GuitarReview;
}

export interface ToneOptions {
  /** Default 2. Only level 3 permits root omissions. */
  level?: TeachingLevel;
  /** Explicit comping context: permit root omission in 5+-tone chords at level 3. */
  comping?: boolean;
}

export interface GenerateOptions extends ToneOptions {
  /** Chord root; defaults to pitchClasses[0]. */
  root?: string;
  /** Slash bass; defaults to the root. */
  bass?: string;
  /** How many voicings to return. Default 8. */
  limit?: number;
  /** Highest fret the search may use. Default 15. */
  maxFret?: number;
}

// ── spelling ────────────────────────────────────────────────────────────────

const LETTERS = "CDEFGAB";
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

function parseNote(note: string): { letter: number; pc: number } {
  const t = note.trim();
  const letter = LETTERS.indexOf(t.charAt(0).toUpperCase());
  if (letter < 0) throw new Error(`Unparseable note: ${note}`);
  let acc = 0;
  for (const ch of t.slice(1)) {
    if (ch === "#" || ch === "♯") acc += 1;
    else if (ch === "b" || ch === "♭") acc -= 1;
    else if (ch === "x" || ch === "𝄪") acc += 2;
    else if (ch === "𝄫") acc -= 2;
    else throw new Error(`Unparseable note: ${note}`);
  }
  return { letter, pc: (((NATURAL[letter] + acc) % 12) + 12) % 12 };
}

function accidental(alter: number): string {
  return alter > 0 ? "#".repeat(alter) : "b".repeat(-alter);
}

/** Raw degree by letter step: step 0..6 → 1, 9, 3, 11, 5, 13, 7 families. */
function rawDegree(root: { letter: number; pc: number }, note: { letter: number; pc: number }) {
  const step = (note.letter - root.letter + 7) % 7;
  const semis = (note.pc - root.pc + 12) % 12;
  let alter = semis - NATURAL[step];
  if (alter > 6) alter -= 12;
  if (alter < -6) alter += 12;
  return { step, semis, alter };
}

// ── rule table ──────────────────────────────────────────────────────────────

/**
 * Name each tone in context and give it a role. See the table at the top.
 *
 * @param root - chord root, spelled
 * @param notes - chord tones, spelled (the root may or may not be included)
 * @param bass - slash bass, spelled; omit for root position
 */
export function analyzeChordTones(root: string, notes: string[], bass?: string, options: ToneOptions = {}): ChordToneAnalysis {
  const r = parseNote(root);
  const seen = new Set<number>();
  const raw: Array<{ note: string; pc: number; step: number; alter: number }> = [];
  for (const note of [root, ...notes]) {
    const n = parseNote(note);
    if (seen.has(n.pc)) continue;
    seen.add(n.pc);
    const { step, alter } = rawDegree(r, n);
    raw.push({ note, pc: n.pc, step, alter });
  }

  const has = (step: number, alter?: number) =>
    raw.some((t) => t.step === step && (alter === undefined || t.alter === alter));
  const hasThird = has(2);
  const majorThird = has(2, 0);
  const minorThird = has(2, -1);
  const hasSeventh = has(6, -1) || has(6, 0); // b7 / maj7 — dim7's bb7 acts as a 6
  const hasDim7 = has(6, -2);
  const natural11 = has(3, 0) && hasThird;
  const has13 = hasSeventh && has(5);
  const rules = new Set<string>(["root"]);

  const tones: ChordTone[] = raw.map((t) => {
    const tone = (degree: string, role: ToneRole, ...ids: string[]): ChordTone => {
      ids.forEach((id) => rules.add(id));
      return { note: t.note, pc: t.pc, degree, role };
    };
    const acc = accidental(t.alter);
    switch (t.step) {
      case 0:
        return tone("1", "required", "root");
      case 2: {
        const degree = `${acc}3`;
        if (majorThird && t.alter === 0 && has(6, -1) && natural11 && !has13)
          return tone(degree, "excluded", "dominant-11-drops-3");
        if (minorThird && t.alter === -1 && hasSeventh && natural11 && !has13)
          return tone(degree, "preferred", "minor-11-prefers-b3");
        return tone(degree, "required", "third");
      }
      case 1: {
        if (t.alter !== 0) return tone(`${acc}9`, "required", "altered");
        if (!hasThird && !has(3)) return tone("2", "required", "sus");
        if (!hasSeventh) return tone("9", "required", "add-tension");
        if (has13 || natural11) return tone("9", "optional", "ninth-under-11-or-13");
        return tone("9", "required", "seventh");
      }
      case 3: {
        if (t.alter !== 0) return tone(`${acc}11`, "required", "altered");
        if (!hasThird) return tone("4", "required", "sus");
        if (!hasSeventh) return tone("11", "required", "add-tension");
        if (has13 && majorThird) return tone("11", "excluded", "eleventh-under-13");
        if (has13) return tone("11", "optional", "eleventh-under-13");
        return tone("11", "required", "seventh");
      }
      case 4: {
        if (t.alter !== 0) return tone(`${acc}5`, "required", "altered");
        if (raw.length >= 4) return tone("5", "optional", "omit-unaltered-5th");
        return tone("5", "required");
      }
      case 5: {
        if (hasSeventh) {
          if (t.alter !== 0) return tone(`${acc}13`, "required", "altered", "thirteenth");
          return tone("13", "required", "thirteenth");
        }
        if (t.alter !== 0) return tone(`${acc}6`, "required", "altered");
        return tone("6", "required", "sixth");
      }
      default: {
        if (hasDim7 && t.alter === -2) return tone("bb7", "required", "seventh");
        return tone(`${acc}7`, "required", "seventh");
      }
    }
  });

  let bassPc = r.pc;
  if (bass !== undefined) {
    rules.add("slash-bass");
    const b = parseNote(bass);
    bassPc = b.pc;
    const existing = tones.find((t) => t.pc === b.pc);
    if (existing) existing.role = "required";
    else tones.push({ note: bass, pc: b.pc, degree: `bass ${bass}`, role: "required" });
  }

  const level = options.level ?? 2;
  const rootTone = tones.find(t => t.degree === "1")!;
  const guides = tones.filter(t => /^(b?3|b?b?7)$/.test(t.degree) && t.role !== "excluded");
  const slash = bass !== undefined && bassPc !== r.pc;
  // A written slash bass must still sound. Its promotion can make a ninth
  // impossible even with only five required tones (Ab9/Eb in the review).
  const slashNinth = slash && raw.length >= 5;
  const dense = tones.filter(t => t.role === "required").length >= 6;
  if (level === 3 && guides.length >= 2 &&
      (dense || (tones.length >= 5 && (options.comping || slashNinth))) && (!bass || slash)) {
    rootTone.role = "optional";
    rules.add("rootless-level-3");
    for (const guide of guides) guide.role = "required";
  }
  const bassPcs = rootTone.role === "optional" && !slash ? [bassPc, ...guides.map(t => t.pc)] : [bassPc];
  return { tones, bassPc, bassPcs, level, rules: VOICING_RULES.map((v) => v.id).filter((id) => rules.has(id)) };
}

// ── fingering ───────────────────────────────────────────────────────────────

export interface Fingering {
  /** Finger number per string, low to high (0 = none). */
  fingers: number[];
  /** Absolute fret of the barre, or null. */
  barre: number | null;
  /** Fretting fingers used (a barre counts as one). */
  count: number;
}

/**
 * Fingers for absolute frets, or null if a hand cannot hold it. Individual
 * fingers when four suffice; otherwise one barre at the lowest fret.
 */
function fingerFor(abs: number[]): Fingering | null {
  const fretted = abs.map((f, i) => ({ f, i })).filter((x) => x.f > 0);
  if (fretted.length === 0) return { fingers: abs.map(() => 0), barre: null, count: 0 };
  const lo = Math.min(...fretted.map((x) => x.f));

  type Group = { fret: number; strings: number[] };
  let groups: Group[];
  let barre: number | null = null;
  if (fretted.length <= 4) {
    groups = fretted.map((x) => ({ fret: x.f, strings: [x.i] }));
  } else {
    const atLo = fretted.filter((x) => x.f === lo).map((x) => x.i);
    if (atLo.length < 2) return null;
    const from = atLo[0];
    const to = atLo[atLo.length - 1];
    // A barre usually lies across the bass (E- and A-shape barres start
    // there). A partial barre above a lower fretted string works only when
    // that string sits one fret above it (x32233, x32322); further, the hand
    // cannot reach back over a flat index.
    if (fretted.some((x) => x.i < from && x.f > lo + 1)) return null;
    for (let s = from; s <= to; s++) if (!(abs[s] >= lo)) return null;
    barre = lo;
    groups = [
      { fret: lo, strings: atLo },
      ...fretted.filter((x) => x.f !== lo).map((x) => ({ fret: x.f, strings: [x.i] })),
    ];
    if (groups.length > 4) return null;
  }

  groups.sort((a, b) => a.fret - b.fret || a.strings[0] - b.strings[0]);
  const fingers = abs.map(() => 0);
  let prev = 0;
  groups.forEach((g, k) => {
    // Spread fingers to match fret distance (one finger per fret), keeping
    // room for the groups still to come.
    const desired = Math.min(4, 1 + (g.fret - lo));
    const finger = Math.max(prev + 1, Math.min(desired, 4 - (groups.length - 1 - k)));
    for (const s of g.strings) fingers[s] = finger;
    prev = finger;
  });
  return { fingers, barre, count: groups.length };
}

/**
 * Whether a hand can hold these frets, and with which fingers — the generator's
 * "What a hand can play" rules (stretch, at most four fingers, one barre at
 * the lowest fret) applied to any shape, so a shape moved up the neck can be
 * checked by the same rule that produced it. Null when it cannot be held.
 *
 * Instrument-neutral: strings are listed low to high, as `abs` indices.
 *
 * @param abs - absolute fret per string, low to high: -1 muted, 0 open
 */
export function fingeringFor(abs: number[]): Fingering | null {
  const fretted = abs.filter((f) => f > 0);
  if (fretted.length) {
    const lo = Math.min(...fretted);
    if (Math.max(...fretted) - lo > (lo > 5 ? 4 : 3)) return null;
  }
  return fingerFor(abs);
}

// ── search ──────────────────────────────────────────────────────────────────

const OPEN_MIDI = INSTRUMENTS.guitar.openMidi;
const STRINGS = 6;

const OMIT_COST: Record<ToneRole, number> = { required: 0, preferred: 12, optional: 1, excluded: 0 };

interface Candidate {
  abs: number[];
  score: number;
  fingering: Fingering;
  omitted: string[];
}

function score(abs: number[], fingering: Fingering, analysis: ChordToneAnalysis, omittedCost: number): number {
  const fretted = abs.filter((f) => f > 0);
  const played = abs.filter((f) => f >= 0);
  const lo = fretted.length ? Math.min(...fretted) : 0;
  const hi = fretted.length ? Math.max(...fretted) : 0;
  const opens = abs.filter((f) => f === 0).length;

  const midi = abs.map((f, i) => (f >= 0 ? OPEN_MIDI[i] + f : -1)).filter((m) => m >= 0);
  const counts = new Map<number, number>();
  for (const m of midi) counts.set(m % 12, (counts.get(m % 12) ?? 0) + 1);
  // Doubling the root or 5th is how guitar triads work; doubling a 3rd is
  // mild; doubling a 7th or a tension thickens and is avoided.
  let doubling = 0;
  for (const [p, n] of counts) {
    if (n < 2) continue;
    const degree = analysis.tones.find((t) => t.pc === p)?.degree ?? "";
    const cost = p === analysis.bassPc || degree === "1" || degree === "5" ? 0 : /^b?3$/.test(degree) ? 0.5 : 2;
    doubling += (n - 1) * cost;
  }

  const firstPlayed = abs.findIndex((f) => f >= 0);
  const lastPlayed = STRINGS - 1 - [...abs].reverse().findIndex((f) => f >= 0);
  let interiorMutes = 0;
  for (let i = firstPlayed; i <= lastPlayed; i++) if (abs[i] < 0) interiorMutes++;

  const sorted = [...midi].sort((a, b) => a - b);
  // Shell + tension: in extended chords the note right above the bass is a
  // guide tone (3rd or 7th), as in drop-2/drop-3 jazz grips.
  let guideBonus = 0;
  const guide = analysis.tones.filter((t) => /^(b?3|b?b?7)$/.test(t.degree)).map((t) => t.pc);
  if (analysis.tones.length >= 5 && sorted.length >= 2 && guide.includes(sorted[1] % 12)) guideBonus = 3;
  // Shell + tension: 4-5 notes, nothing doubled — the comping grip.
  const hasSeventh = analysis.tones.some((t) => /^b?b?7$/.test(t.degree));
  const shellBonus =
    analysis.tones.length >= 5 && hasSeventh && midi.length <= 5 && counts.size === midi.length ? 3 : 0;
  // Low-interval limit: a second directly above the bass is mud.
  const signals = voicingSignals(abs, fingering.fingers, analysis);
  // Low thirds cost less: open G7 is idiomatic. Semitones/minor ninths
  // below their register limits need much stronger separation.
  const lowSecond = 12 * signals.lowIntervals + 3 * signals.lowThirds + 18 * signals.lowMinorNinths;
  const bassRegister = Math.max(0, firstPlayed - 1) * (analysis.rules.includes("slash-bass") ? 12 : 6);
  const minorNinth = 4 * signals.minorNinths;
  const spacing = 6 * signals.fingerSpacing;
  // Open strings ringing under a hand that has moved up the neck.
  const openAway = opens * Math.max(0, lo - 3) * 3 + (opens && lo >= 5 ? 30 : 0);

  return (
    2 * fingering.count +
    1.5 * (hi - lo) +
    0.9 * Math.max(0, lo - 1) +
    1.5 * Math.max(0, hi - 9) ** 2 +
    40 * Math.max(0, lo - 9) +
    (fingering.barre !== null ? 2 + 0.75 * signals.barreStrings : 0) +
    omittedCost +
    doubling +
    2.5 * interiorMutes +
    (analysis.tones.length >= 5 ? Math.max(0, 4 - played.length) : 2.5 * (STRINGS - played.length)) +
    openAway +
    lowSecond +
    bassRegister +
    minorNinth +
    spacing +
    2 * signals.unisons -
    guideBonus -
    shellBonus
  );
}

/**
 * Ranked playable voicings, best first. Empty when nothing satisfies the
 * constraints — this never relaxes a hard rule to find something.
 *
 * @param pitchClasses - spelled chord tones, root first unless `options.root` says otherwise
 */
export function generateGuitarVoicings(
  pitchClasses: string[],
  options: GenerateOptions = {},
): GeneratedPosition[] {
  const root = options.root ?? pitchClasses[0];
  const limit = options.limit ?? 8;
  const maxFret = options.maxFret ?? 15;
  const analysis = analyzeChordTones(root, pitchClasses, options.bass, options);
  const allowed = new Set(analysis.tones.filter((t) => t.role !== "excluded").map((t) => t.pc));
  const required = analysis.tones.filter((t) => t.role === "required").map((t) => t.pc);
  const bassIsChordTone = analysis.tones.some(
    (t) => t.pc === analysis.bassPc && !t.degree.startsWith("bass"),
  );

  const found = new Map<string, Candidate>();
  const consider = (abs: number[]) => {
    const key = abs.join(",");
    if (found.has(key)) return;
    const c = evaluate(abs);
    if (c) found.set(key, c);
  };

  const evaluate = (abs: number[]): Candidate | null => {
    const played = abs.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
    if (played.length < 3) return null;
    const first = played[0];
    const last = played[played.length - 1];
    const gaps: number[] = [];
    for (let i = first; i <= last; i++) if (abs[i] < 0) gaps.push(i);
    if (gaps.length > 1) return null;
    if (gaps.length === 1 && (gaps[0] !== first + 1 || first > 1)) return null;

    const midi = played.map((i) => OPEN_MIDI[i] + abs[i]);
    const bassMidi = midi[0];
    if (!analysis.bassPcs.includes(bassMidi % 12)) return null;
    for (let k = 1; k < midi.length; k++) if (midi[k] <= bassMidi) return null;
    if (!bassIsChordTone && midi.slice(1).some((m) => m % 12 === analysis.bassPc)) return null;
    const pcs = new Set(midi.map((m) => m % 12));
    for (const p of required) if (!pcs.has(p)) return null;
    const rootTone = analysis.tones.find(t => t.degree === "1")!;
    // A rooted grip retains the written root/slash bass. Only a genuinely
    // rootless grip may start on a guide tone.
    if (pcs.has(rootTone.pc) && bassMidi % 12 !== analysis.bassPc) return null;

    const fingering = fingeringFor(abs);
    if (!fingering) return null;

    const missing = analysis.tones.filter(
      (t) => (t.role === "optional" || t.role === "preferred") && !pcs.has(t.pc),
    );
    const omittedCost = missing.reduce((s, t) => s + (t.degree === "1" ? 3 : OMIT_COST[t.role]), 0);
    return {
      abs,
      fingering,
      omitted: missing.map((t) => t.degree),
      score: score(abs, fingering, analysis, omittedCost),
    };
  };
  // Every window [w, w + reach]: fretted notes stay inside it, open strings may
  // join any window. Duplicates across windows are collapsed by `found`.
  for (let w = 1; w <= maxFret; w++) {
    const reach = w > 5 ? 4 : 3;
    const options: number[][] = [];
    for (let s = 0; s < STRINGS; s++) {
      const opts = [-1];
      if (allowed.has(OPEN_MIDI[s] % 12)) opts.push(0);
      for (let f = w; f <= Math.min(w + reach, maxFret); f++) {
        if (allowed.has((OPEN_MIDI[s] + f) % 12)) opts.push(f);
      }
      options.push(opts);
    }
    // Phases, low string to high: before the bass, sounding, in the single
    // allowed skip (directly above a 6th/5th-string bass), past the top.
    type Phase = "before" | "sounding" | "skip" | "after";
    const abs: number[] = new Array(STRINGS).fill(-1);
    const walk = (s: number, phase: Phase, skipped: boolean, bassMidi: number) => {
      if (s === STRINGS) {
        if (phase !== "skip") consider([...abs]);
        return;
      }
      for (const f of options[s]) {
        abs[s] = f;
        if (f < 0) {
          if (phase === "before") walk(s + 1, "before", skipped, bassMidi);
          else if (phase === "sounding" || phase === "after") {
            walk(s + 1, "after", skipped, bassMidi);
            const bassString = abs.findIndex((x) => x >= 0);
            if (phase === "sounding" && !skipped && bassString === s - 1 && bassString <= 1) {
              walk(s + 1, "skip", true, bassMidi);
            }
          }
          continue;
        }
        if (phase === "after") continue;
        const m = OPEN_MIDI[s] + f;
        if (phase === "before") {
          if (!analysis.bassPcs.includes(m % 12)) continue;
          walk(s + 1, "sounding", skipped, m);
        } else {
          if (m <= bassMidi) continue;
          walk(s + 1, "sounding", skipped, bassMidi);
        }
      }
      abs[s] = -1;
    };
    walk(0, "before", false, -1);
  }

  const ranked = [...found.values()].sort(
    (a, b) => a.score - b.score || a.abs.join(",").localeCompare(b.abs.join(",")),
  );
  return ranked.slice(0, limit).map((c) => toPosition(c, analysis));
}

function toPosition(c: Candidate, analysis: ChordToneAnalysis): GeneratedPosition {
  const fretted = c.abs.filter((f) => f > 0);
  const hi = fretted.length ? Math.max(...fretted) : 0;
  const lo = fretted.length ? Math.min(...fretted) : 1;
  const baseFret = hi <= 4 ? 1 : lo;
  const rel = (f: number) => (f <= 0 ? f : f - baseFret + 1);
  return {
    frets: c.abs.map(rel),
    fingers: c.fingering.fingers,
    baseFret,
    barres: c.fingering.barre !== null ? [rel(c.fingering.barre)] : [],
    generated: true,
    rule: analysis.rules.join("+"),
    omitted: c.omitted,
    score: Math.round(c.score * 100) / 100,
    rootless: c.omitted.includes("1"),
    review: reviewGuitarPosition({
      frets: c.abs, baseFret: 1, fingers: c.fingering.fingers,
      barres: c.fingering.barre === null ? [] : [c.fingering.barre],
    }, analysis, { level: analysis.level }),
  };
}

/**
 * True when a position (any source) sounds the chord under the rule table:
 * every required tone, nothing outside the chord or excluded, and the bass
 * lowest. chords-db positions are checked with this before they are trusted.
 */
export function positionSpellsChord(pos: ChordsDbPosition, analysis: ChordToneAnalysis): boolean {
  const midi = pos.frets
    .map((f, i) => (f < 0 ? -1 : f === 0 ? OPEN_MIDI[i] : OPEN_MIDI[i] + pos.baseFret + f - 1))
    .filter((m) => m >= 0);
  if (midi.length === 0) return false;
  const lowestPc = Math.min(...midi) % 12;
  if (!analysis.bassPcs.includes(lowestPc)) return false;
  const rootPc = analysis.tones.find(t => t.degree === "1")!.pc;
  if (midi.some(m => m % 12 === rootPc) && lowestPc !== analysis.bassPc) return false;
  const allowed = new Set(analysis.tones.filter((t) => t.role !== "excluded").map((t) => t.pc));
  const pcs = new Set(midi.map((m) => m % 12));
  for (const p of pcs) if (!allowed.has(p)) return false;
  return analysis.tones.every((t) => t.role !== "required" || pcs.has(t.pc));
}
