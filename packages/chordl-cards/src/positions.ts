/**
 * The card shape and its alternatives elsewhere on the neck, for the fretted
 * faces: the same chord up an octave in the same shape, the other chords-db
 * positions, generated voicings in other windows, the bass pattern rooted on
 * the other string.
 *
 * Item 0 is always exactly `requestFor(chord, face, theme)` — the printed
 * card's shape, untouched (print hashes it). The rest are distinct sounding
 * shapes, ordered up the neck, each one a `GuitarFaceRequest` that renders
 * through the same svguitar path and plays through `playbackFor`.
 *
 * Rules, per face (see `positionsFor`):
 *
 * - every alternative sounds the chord: chords-db positions are checked with
 *   the voicing rule table (`analyzeChordTones`), generated ones are built
 *   under it, and an octave shift keeps the card's pitch classes;
 * - every alternative is playable: moving a shape with open strings up twelve
 *   frets frets those strings at the 12th, so the moved shape is re-fingered
 *   and kept only if chordl-guitar's hand rules (`fingeringFor`: stretch,
 *   four fingers, one barre at the lowest fret) accept it;
 * - every alternative fits the diagram: the window starts at the nut when the
 *   highest fret fits the face's drawn frets, else it slides to the lowest
 *   fretted fret (svguitar prints the fret number), and a slid window never
 *   carries an open string — no window could show both;
 * - nothing above the face's usable neck (`POSITIONS_MAX_FRET`).
 */

import {
  INSTRUMENTS, analyzeChordTones, dbPositionToChord, fingeringFor, generateGuitarVoicings,
  guitarLibraryPositionsFor, guitarPositionFor,
} from "@pepperhorn/chordl-guitar";
import type { ChordsDbPosition } from "@pepperhorn/chordl-guitar";
import { spelledChord } from "./catalogue";
import {
  bassPatternFor, colourFingers, frettedRequest, requestFor, rootEntryFor, top3ShapeFor, ukulelePositionsFor,
  type FrettedShape, type GuitarFaceRequest,
} from "./faces";
import { ordinal } from "./inversions";
import type { Theme } from "./theme";

/** The faces drawn as a fretboard. */
export type FrettedCardFace = GuitarFaceRequest["instrument"];

export interface FacePosition {
  /** "card" for the printed shape; else the sounding frets, low string first ("x-3-5-5-5-3"). */
  id: string;
  /** Short and musician-readable: "Card shape", "5th fret", "Up an octave (12th fret)", "3rd fret, A string". */
  label: string;
  /** What the face draws and plays for this position. Item 0's is `requestFor`'s, byte for byte. */
  request: GuitarFaceRequest;
  /** Generated rather than taken from chords-db or the card (badge it "pending teacher review"). */
  generated: boolean;
  /** Lowest fretted fret, from the nut; 0 when nothing is fretted. */
  fret: number;
  /** Where it came from. */
  kind: "card" | "octave" | "library" | "generated" | "pattern";
}

export interface PositionsOptions {
  /** Most positions to return, the card shape included. Default 4; at least 1. */
  limit?: number;
}

/**
 * The highest fret an alternative may use, per face.
 *
 * - guitar, guitar-top3: 15 — chordl-guitar's generator searches to the 15th
 *   by default, and an acoustic's body joins the neck at the 14th: past 15
 *   the hand is over the body and most teaching guitars have no cutaway.
 * - ukulele: 15 — a concert ukulele, the usual teaching size, has 15 to 18
 *   frets; a soprano's 12-15 still reach the octave shapes this offers.
 * - bass4: 17 — basses have 20-24 frets, but the root-fifth-octave pattern
 *   loses its low end and its frets get cramped above the 17th.
 */
export const POSITIONS_MAX_FRET: Record<FrettedCardFace, number> = {
  guitar: 15,
  "guitar-top3": 15,
  ukulele: 15,
  bass4: 17,
};

/** Alternatives must sit this many frets from every other one, so no two chips read the same. */
const MIN_FRET_GAP = 2;

/** One shape on the neck: absolute frets per string, low to high. */
interface Placement {
  /** -1 muted, 0 open, else the absolute fret. */
  abs: number[];
  /** Finger number per string (0 = none). */
  fingers: number[];
  /** Absolute frets carrying a barre. */
  barres: number[];
  kind: FacePosition["kind"];
  generated: boolean;
  source?: GuitarFaceRequest["source"];
  omitted: string[];
  /** bass4 only: the string the root is on. */
  rootString?: "E" | "A";
}

const keyOf = (abs: number[]) => abs.map((f) => (f < 0 ? "x" : String(f))).join("-");
const lowestFret = (abs: number[]) => {
  const fretted = abs.filter((f) => f > 0);
  return fretted.length ? Math.min(...fretted) : 0;
};

/** A chords-db position (window-relative frets) on the neck. */
function fromDbPosition(pos: ChordsDbPosition): Pick<Placement, "abs" | "fingers" | "barres"> {
  const base = pos.baseFret || 1;
  const abs = (f: number) => (f <= 0 ? f : base + f - 1);
  return { abs: pos.frets.map(abs), fingers: [...pos.fingers], barres: pos.barres.map(abs) };
}

/** An svguitar shape (strings numbered high to low, window-relative frets) on the neck. */
function fromShape(shape: FrettedShape, strings: number): Pick<Placement, "abs" | "fingers" | "barres"> {
  const base = (shape as { position?: number }).position ?? 1;
  const absOf = (f: number) => (f <= 0 || base <= 1 ? f : base + f - 1);
  const frets: Array<number | undefined> = new Array(strings).fill(undefined);
  const fingers: number[] = new Array(strings).fill(0);
  const labelOf = (label: unknown) =>
    Number(typeof label === "object" && label !== null ? (label as { text?: unknown }).text : label) || 0;
  for (const [stringNo, fret, label] of shape.fingers as Array<[number, number | string, unknown?]>) {
    const i = strings - stringNo;
    frets[i] = typeof fret === "number" ? absOf(fret) : -1;
    if (typeof fret === "number" && fret > 0) fingers[i] = labelOf(label);
  }
  const barres: number[] = [];
  for (const b of ((shape as { barres?: unknown[] }).barres ?? []) as Array<{ fromString: number; toString: number; fret: number; text?: string }>) {
    const fret = absOf(b.fret);
    barres.push(fret);
    for (let s = Math.min(b.fromString, b.toString); s <= Math.max(b.fromString, b.toString); s++) {
      const i = strings - s;
      if (frets[i] === undefined) {
        frets[i] = fret;
        fingers[i] = Number(b.text) || 1;
      }
    }
  }
  return { abs: frets.map((f) => f ?? -1), fingers, barres };
}

/**
 * The chords-db position this placement draws as, in the face's window, or
 * null when it does not fit one (see the module comment).
 */
function toDbPosition(p: Placement, diagramFrets: number): ChordsDbPosition | null {
  const fretted = p.abs.filter((f) => f > 0);
  const hi = fretted.length ? Math.max(...fretted) : 0;
  const lo = fretted.length ? Math.min(...fretted) : 0;
  // dbPositionToChord draws each barre across the strings stopped at its fret;
  // a string between them stopped lower (or open) would sound the barre
  // instead — some chords-db positions do this (x-6-5-6-6-6 under a barre at 6).
  for (const b of p.barres) {
    const at = p.abs.flatMap((f, i) => (f === b ? [i] : []));
    for (let i = Math.min(...at); i <= Math.max(...at); i++) if (p.abs[i] >= 0 && p.abs[i] < b) return null;
  }
  let base = 1;
  if (hi > diagramFrets) {
    if (p.abs.includes(0) || hi - lo + 1 > diagramFrets) return null;
    base = lo;
  }
  const rel = (f: number) => (f <= 0 ? f : f - base + 1);
  return { frets: p.abs.map(rel), fingers: [...p.fingers], baseFret: base, barres: p.barres.map(rel) };
}

/**
 * The card shape moved `by` frets (±12): open strings become fretted at 12, so
 * such a shape is re-fingered and kept only if a hand can hold it.
 */
function shifted(card: Placement, by: number, maxFret: number): Placement | null {
  if (by < 0 && card.abs.includes(0)) return null; // an open string cannot go down
  const abs = card.abs.map((f) => (f < 0 ? -1 : f + by));
  const fretted = abs.filter((f) => f > 0);
  if (!fretted.length || Math.max(...fretted) > maxFret || Math.min(...abs.filter((f) => f >= 0)) < 1) return null;
  const base = { ...card, abs, kind: "octave" as const };
  if (!card.abs.includes(0)) {
    return { ...base, barres: card.barres.map((b) => b + by) };
  }
  const fingering = fingeringFor(abs);
  if (!fingering) return null;
  return { ...base, fingers: fingering.fingers, barres: fingering.barre === null ? [] : [fingering.barre] };
}

/** Pitch classes a placement sounds. */
function soundingPcs(abs: number[], openMidi: number[]): Set<number> {
  return new Set(abs.flatMap((f, i) => (f < 0 ? [] : [(openMidi[i] + f) % 12])));
}

/** True when the sounding set holds every required tone and nothing outside the chord (no bass rule: reentrant). */
function soundsChord(abs: number[], openMidi: number[], analysis: ReturnType<typeof analyzeChordTones>): boolean {
  const pcs = soundingPcs(abs, openMidi);
  if (pcs.size === 0) return false;
  const allowed = new Set(analysis.tones.filter((t) => t.role !== "excluded").map((t) => t.pc));
  for (const pc of pcs) if (!allowed.has(pc)) return false;
  return analysis.tones.every((t) => t.role !== "required" || pcs.has(t.pc));
}

// ── Candidates per face ─────────────────────────────────────────────────────

const libraryPlacement = (pos: ChordsDbPosition, generated: boolean, omitted: string[] = []): Placement => ({
  ...fromDbPosition(pos),
  kind: generated ? "generated" : "library",
  generated,
  source: generated ? "generated" : "chords-db",
  omitted,
});

function guitarCandidates(chord: string, maxFret: number): { card: Placement; others: Placement[] } {
  const spelled = spelledChord(chord, { strict: true });
  const pos = guitarPositionFor(spelled)!; // requestFor already proved it exists
  const card: Placement = {
    ...fromDbPosition(pos),
    kind: "card",
    generated: pos.generated,
    source: pos.generated ? "generated" : pos.source,
    omitted: pos.generated ? [...pos.omitted] : [],
  };
  const bass = spelled.bass;
  const library = guitarLibraryPositionsFor(spelled).map((p) => libraryPlacement(p, false));
  const generated = generateGuitarVoicings(spelled.pitchClasses, {
    root: spelled.root, ...(bass ? { bass } : {}), limit: 60, maxFret,
  }).map((p) => libraryPlacement(p, true, p.omitted));
  // Up the neck a position is a movable grip: generated voicings with open
  // strings (x-3-5-0-5-0 for C) go after the closed ones (x-3-5-5-5-3), each
  // group kept in the generator's rank order.
  const closedFirst = [...generated.filter((p) => !p.abs.includes(0)), ...generated.filter((p) => p.abs.includes(0))];
  return { card, others: [...octaves(card, maxFret), ...library, ...closedFirst] };
}

function ukuleleCandidates(chord: string, maxFret: number): { card: Placement; others: Placement[] } {
  const [first, ...rest] = ukulelePositionsFor(chord);
  const card: Placement = { ...fromDbPosition(first), kind: "card", generated: false, omitted: [] };
  const spelled = spelledChord(chord, { strict: true });
  const analysis = analyzeChordTones(spelled.root, spelled.pitchClasses);
  const openMidi = INSTRUMENTS.ukulele.openMidi;
  // The card is printed as chords-db has it; an alternative must sound the
  // chord (C9's card shape leaves out the root, so its octave is not offered).
  const others = [...octaves(card, maxFret), ...rest.map((p) => libraryPlacement(p, false))]
    .filter((p) => soundsChord(p.abs, openMidi, analysis));
  return { card, others };
}

/**
 * Top 3: the card's shape an octave away, then the other close voicings on
 * G B E — every inversion of the three tones the card voices (a triad's
 * three; a seventh chord's root, 3rd and 7th, as the presets do), found by
 * search and flagged generated.
 */
function top3Candidates(chord: string, maxFret: number): { card: Placement; others: Placement[] } {
  const strings = INSTRUMENTS["guitar-top3"].strings;
  const card: Placement = { ...fromShape(top3ShapeFor(chord), strings), kind: "card", generated: false, omitted: [] };
  const openMidi = INSTRUMENTS["guitar-top3"].openMidi;
  const tones = [...soundingPcs(card.abs, openMidi)];
  const others = [...octaves(card, maxFret)];
  if (tones.length === 3) {
    const found: Placement[] = [];
    const top = [3, 4, 5]; // G B E, as abs indices
    const options = top.map((i) => {
      const opts: number[] = [];
      for (let f = 0; f <= maxFret; f++) if (tones.includes((openMidi[i] + f) % 12)) opts.push(f);
      return opts;
    });
    for (const g of options[0]) for (const b of options[1]) for (const e of options[2]) {
      const abs = [-1, -1, -1, g, b, e];
      if (soundingPcs(abs, openMidi).size !== 3) continue;
      const fingering = fingeringFor(abs);
      if (!fingering) continue;
      found.push({
        abs, fingers: fingering.fingers, barres: fingering.barre === null ? [] : [fingering.barre],
        kind: "generated", generated: true, source: "generated", omitted: [],
      });
    }
    found.sort((a, b) => lowestFret(a.abs) - lowestFret(b.abs) || keyOf(a.abs).localeCompare(keyOf(b.abs)));
    others.push(...found);
  }
  return { card, others };
}

const BASS_OPEN: Record<"E" | "A", number> = { E: 4, A: 9 };

/**
 * Bass: the root-fifth-octave pattern (root 1, fifth 3, octave 4) rooted on
 * the E and the A string, at both octaves the neck allows; never on an open
 * string — the pattern is the movable shape.
 */
function bassCandidates(chord: string, maxFret: number): { card: Placement; others: Placement[] } {
  const strings = INSTRUMENTS.bass4.strings;
  const card: Placement = { ...fromShape(bassPatternFor(chord), strings), kind: "card", generated: false, omitted: [] };
  const rootIndex = card.abs[0] > 0 ? 0 : 1;
  card.rootString = rootIndex === 0 ? "E" : "A";
  const rootPc = (INSTRUMENTS.bass4.openMidi[rootIndex] + card.abs[rootIndex]) % 12;
  const others: Placement[] = [];
  for (const string of ["E", "A"] as const) {
    const first = (rootPc - BASS_OPEN[string] + 12) % 12;
    for (const r of [first, first + 12]) {
      if (r < 1 || r + 2 > maxFret) continue;
      const i = string === "E" ? 0 : 1;
      const abs = [-1, -1, -1, -1];
      const fingers = [0, 0, 0, 0];
      abs[i] = r; abs[i + 1] = r + 2; abs[i + 2] = r + 2;
      fingers[i] = 1; fingers[i + 1] = 3; fingers[i + 2] = 4;
      const octave = string === card.rootString && Math.abs(r - card.abs[i]) === 12;
      others.push({ abs, fingers, barres: [], kind: octave ? "octave" : "pattern", generated: false, omitted: [], rootString: string });
    }
  }
  // The card's own octave first, so it wins a tie for a slot.
  others.sort((a, b) => Number(b.kind === "octave") - Number(a.kind === "octave"));
  return { card, others };
}

function octaves(card: Placement, maxFret: number): Placement[] {
  return [shifted(card, 12, maxFret), shifted(card, -12, maxFret)].filter((p): p is Placement => p !== null);
}

// ── Assembly ────────────────────────────────────────────────────────────────

function labelFor(p: Placement, cardFret: number): string {
  const fret = lowestFret(p.abs);
  const where = fret === 0 ? "Open strings" : `${ordinal(fret)} fret`;
  const string = p.rootString ? `, ${p.rootString} string` : "";
  if (p.kind === "octave") return `${fret > cardFret ? "Up" : "Down"} an octave (${where}${string})`;
  return `${where}${string}`;
}

/**
 * The card shape and up to `limit - 1` alternatives elsewhere on the neck.
 *
 * Throws exactly when `requestFor` throws (the face cannot print the chord),
 * and for a keyboard face, which has no neck.
 *
 * - `guitar`: the card shape up/down an octave, then the other chords-db
 *   positions that spell the chord, then generated voicings (flagged).
 * - `ukulele`: the octave, then the other chords-db positions that sound the
 *   chord (every required tone, nothing outside it).
 * - `guitar-top3`: the octave, then the other inversions on G B E (generated).
 * - `bass4`: the pattern rooted on the other string, and an octave up.
 *
 * Alternatives are taken in that priority, skipping any that duplicate a
 * sounding shape or sit within `MIN_FRET_GAP` frets of one already taken
 * (bass excepted: its string tells two apart), then ordered up the neck after
 * the card shape.
 */
export function positionsFor(
  chord: string,
  face: FrettedCardFace,
  theme: Theme,
  { limit = 4 }: PositionsOptions = {},
): FacePosition[] {
  const cardRequest = requestFor(chord, face, theme);
  if (cardRequest.kind !== "guitar") throw new Error(`the ${face} face has no fretboard positions`);
  const maxFret = POSITIONS_MAX_FRET[face];
  const { card, others } =
    face === "guitar" ? guitarCandidates(chord, maxFret)
    : face === "ukulele" ? ukuleleCandidates(chord, maxFret)
    : face === "guitar-top3" ? top3Candidates(chord, maxFret)
    : bassCandidates(chord, maxFret);

  const cardFret = lowestFret(card.abs);
  const out: FacePosition[] = [{
    id: "card", label: "Card shape", request: cardRequest, generated: !!cardRequest.generated, fret: cardFret, kind: "card",
  }];

  const inst = INSTRUMENTS[face];
  const root = chord.trim().match(/^([A-G][#b]?)/)![1];
  const rootEntry = rootEntryFor(chord, theme)!;
  const seen = new Set([keyOf(card.abs)]);
  const taken: number[] = [cardFret];
  const picked: FacePosition[] = [];
  for (const p of others) {
    if (picked.length >= Math.max(1, limit) - 1) break;
    const key = keyOf(p.abs);
    if (seen.has(key)) continue;
    const fret = lowestFret(p.abs);
    if (face !== "bass4" && taken.some((t) => Math.abs(t - fret) < MIN_FRET_GAP)) continue;
    if (Math.max(...p.abs) > maxFret) continue;
    const pos = toDbPosition(p, inst.frets);
    if (!pos) continue;
    seen.add(key);
    taken.push(fret);
    const shape = colourFingers(dbPositionToChord(pos, inst.strings) as FrettedShape, face, root, theme);
    const base = frettedRequest(shape, face, root, rootEntry, theme);
    const request: GuitarFaceRequest =
      face === "guitar"
        ? { ...base, generated: p.generated, source: p.source ?? "chords-db", omitted: [...p.omitted] }
        : p.generated ? { ...base, generated: true, source: "generated", omitted: [...p.omitted] } : base;
    picked.push({ id: key, label: labelFor(p, cardFret), request, generated: p.generated, fret, kind: p.kind });
  }
  picked.sort((a, b) => a.fret - b.fret || a.id.localeCompare(b.id));
  return [...out, ...picked];
}
