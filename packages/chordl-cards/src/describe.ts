/**
 * "How to play" text for a card face: plain English for beginner and emerging
 * players, built from the same request the card draws and the same playback it
 * sounds, so the words always match the diagram.
 *
 * Templates only: no AI, no clock, no randomness, so it is pure and
 * deterministic and can run at build time or in a test. Every sentence is
 * written once as a function of a mode and rendered twice:
 *
 * - "text": for the screen. Note names are the ones the card prints ("Bb"),
 *   which `tokenizeChordSymbol` turns into glyphs, and ordinals are numerals.
 * - "spoken": for text-to-speech. Ordinals and counts are words ("second
 *   fret"), accidentals are spoken ("B flat"), and no digit or symbol is left.
 *
 * Fretted faces read strings by where they are in your hands, not by pitch, so
 * a re-entrant ukulele works: the diagram's left string is the one closest to
 * your face. Fingers are never invented: a shape with no finger data says "any
 * finger".
 */

import { INSTRUMENTS } from "@pepperhorn/chordl-guitar";
import { spokenChordSymbol } from "./accidentals";
import { parseChordSymbol } from "./catalogue";
import { chordNotes, faceNoteNames, requestFor, type CardFace, type FaceRequest, type GuitarFaceRequest, type KeyboardFaceRequest } from "./faces";
import { handsWindow } from "./hands";
import { ordinal } from "./inversions";
import { playbackFor } from "./playback";
import type { Theme } from "./theme";

export interface ShapeDescription {
  /** Steps, in the order you would place your fingers (or press the keys). */
  play: string[];
  /** How to read this kind of diagram: short, and the same for every shape of a kind. */
  read: string[];
  /** `play` then `read`, for display, with accidentals as glyph-ready names ("Bb"). */
  text: string;
  /** The same for text-to-speech: "B flat", "second fret", no digits or symbols. */
  spoken: string;
}

export interface DescribeShapeOptions {
  /** The card theme, as `requestFor` takes it. It does not change the words. */
  theme: Theme;
  /**
   * Describe this request instead of `requestFor(chord, face, theme)`'s: one of
   * `positionsFor(chord, face, theme)`'s alternatives, as `ChordCardPlayer` takes it.
   */
  request?: FaceRequest;
}

type Mode = "text" | "spoken";
type Say = (m: Mode) => string;

const say = (text: string): Say => () => text;

// ── Wording helpers ──────────────────────────────────────────────────────────

const ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const ORDINAL_ONES: Record<string, string> = {
  one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth",
};

function cardinalWord(n: number): string {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  return n % 10 === 0 ? tens : `${tens}-${ONES[n % 10]}`;
}

/** 1 -> "first", 21 -> "twenty-first", 20 -> "twentieth". */
function ordinalWord(n: number): string {
  const word = cardinalWord(n);
  const last = word.split("-").pop()!;
  const head = word.slice(0, word.length - last.length);
  const tail = ORDINAL_ONES[last] ?? (last.endsWith("y") ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return head + tail;
}

const ord = (n: number, m: Mode) => (m === "spoken" ? ordinalWord(n) : ordinal(n));
const count = (n: number, m: Mode) => (m === "spoken" ? cardinalWord(n) : String(n));
/** "fret 7" on screen, "the seventh fret" aloud. */
const atFret = (n: number, m: Mode) => (m === "spoken" ? `the ${ordinalWord(n)} fret` : `fret ${n}`);
const note = (name: string, m: Mode) => (m === "spoken" ? spokenChordSymbol(name) : name);

/** "C", "E and G", "C, E and G". */
function listOf(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const render = (steps: Say[], m: Mode) => steps.map((s) => s(m));

// ── Fretted faces ────────────────────────────────────────────────────────────

/** One string of a fretted face, low-tuned first (the diagram's left). */
interface StringState {
  index: number;
  state: "muted" | "open" | "fretted";
  /** Absolute fret, from the nut. */
  fret: number;
  /** 1-4, or 0 when the shape does not say. */
  finger: number;
  barre: boolean;
}

const labelNumber = (label: unknown): number =>
  Number(typeof label === "object" && label !== null ? (label as { text?: unknown }).text : label) || 0;

/**
 * Per-string state of a fretted request. Which strings sound, and the fret on
 * each, come from `playbackFor` (the pitch each note sounds minus the open
 * string); the shape only adds the finger numbers and the barres.
 */
function fretboardFacts(req: GuitarFaceRequest) {
  const cfg = INSTRUMENTS[req.instrument];
  const pb = playbackFor(req);
  const shape = req.shape as {
    fingers: Array<[number, number | string, unknown?]>;
    barres?: Array<{ fromString: number; toString: number; fret: number; text?: string }>;
    position?: number;
  };
  const baseFret = shape.position ?? 1;
  const fretOf = new Map<number, number>();
  pb.strings!.forEach((s, k) => fretOf.set(s, pb.notes[k] - cfg.openMidi[s]));

  const fingerOf = new Map<number, number>();
  for (const [stringNo, fret, label] of shape.fingers) {
    if (typeof fret === "number" && fret > 0) fingerOf.set(cfg.strings - stringNo, labelNumber(label));
  }
  const barres = (shape.barres ?? []).map((b) => {
    const lo = Math.min(b.fromString, b.toString);
    const hi = Math.max(b.fromString, b.toString);
    const strings: number[] = [];
    for (let n = hi; n >= lo; n--) if (fretOf.has(cfg.strings - n)) strings.push(cfg.strings - n);
    return {
      strings,
      fret: baseFret <= 1 ? b.fret : baseFret + b.fret - 1,
      finger: Number(b.text) || 0,
    };
  });

  const states: StringState[] = [];
  for (let index = 0; index < cfg.strings; index++) {
    const fret = fretOf.get(index);
    if (fret === undefined) states.push({ index, state: "muted", fret: -1, finger: 0, barre: false });
    else if (fret === 0) states.push({ index, state: "open", fret: 0, finger: 0, barre: false });
    else {
      const finger = fingerOf.get(index);
      const covering = barres.find((b) => b.strings.includes(index) && b.fret === fret);
      states.push({
        index, state: "fretted", fret,
        finger: finger ?? covering?.finger ?? 0,
        // Drawn by the bar when no finger of its own sits on the string.
        barre: finger === undefined && !!covering,
      });
    }
  }
  return { cfg, baseFret, states, barres };
}

/** Short string names by tuning letter; a letter that repeats is told apart by low and high. */
function stringNames(tuning: string[]): string[] {
  return tuning.map((letter, i) => {
    if (tuning.filter((l) => l === letter).length < 2) return letter;
    return tuning.indexOf(letter) === i ? `low ${letter}` : `high ${letter}`;
  });
}

function describeFretted(req: GuitarFaceRequest): { play: Say[]; read: Say[] } {
  const { cfg, baseFret, states, barres } = fretboardFacts(req);
  const names = stringNames(cfg.tuning);
  const last = cfg.strings - 1;
  // A ukulele's strings are not thickest-to-thinnest across the diagram (its G
  // is re-entrant), so it is told by where the strings sit in your hands.
  const byThickness = req.instrument !== "ukulele";
  const near = "the one closest to you";
  const far = "the one closest to the floor";

  /** The string's name for a step that puts a finger on it, with where it is at either end. */
  const spot = (i: number): string => {
    const where = i === 0
      ? (byThickness ? `the thickest string, ${near}` : near)
      : i === last ? (byThickness ? `the thinnest string, ${far}` : far) : "";
    return `${names[i]} string${where ? ` (${where})` : ""}`;
  };
  const strings = (indices: number[]) => `${listOf(indices.map((i) => names[i]))} string${indices.length > 1 ? "s" : ""}`;

  const play: Say[] = [];
  if (baseFret > 1) {
    play.push((m) => `This shape starts at ${atFret(baseFret, m)} (the number beside the diagram).`);
  }

  // Fingers go down in numbered order; a finger the shape does not name goes last.
  type Step = { finger: number; first: number; say: Say };
  const steps: Step[] = [];
  const who = (finger: number, m: Mode) => (finger > 0 ? `your ${ord(finger, m)} finger` : "any finger");
  for (const b of barres) {
    steps.push({
      finger: b.finger || 99, first: b.strings[0] ?? 0,
      say: (m) => {
        const across = b.strings.length === cfg.strings ? `all ${count(cfg.strings, m)} strings` : `the ${strings(b.strings)}`;
        return `Lay ${who(b.finger, m)} flat across ${across} at ${atFret(b.fret, m)}.`;
      },
    });
  }
  for (const s of states) {
    if (s.state !== "fretted" || s.barre) continue;
    steps.push({
      finger: s.finger || 99, first: s.index,
      say: (m) => `Place ${who(s.finger, m)} on the ${ord(s.fret, m)} fret of the ${spot(s.index)}.`,
    });
  }
  steps.sort((a, b) => a.finger - b.finger || a.first - b.first);
  play.push(...steps.map((s) => s.say));

  const open = states.filter((s) => s.state === "open").map((s) => s.index);
  const muted = states.filter((s) => s.state === "muted").map((s) => s.index);
  const fretted = states.some((s) => s.state === "fretted");
  if (open.length) {
    play.push(
      muted.length === 0 && open.length >= 2
        ? say(fretted ? "All the other strings are open (the O)." : "All the strings are open (the O).")
        : say(`Play the ${strings(open)} open (the O).`),
    );
  }
  if (muted.length) play.push(say(`Don't play the ${strings(muted)} (the X).`));

  const read: Say[] = [
    say("Each vertical line is a string. Each horizontal line is a fret."),
    say("The string on the left is the one closest to your face."),
    // svguitar draws the thick nut only when the window starts at fret 1.
    say(baseFret > 1
      ? "The top line is not the nut. The number beside the diagram is the fret it starts at."
      : "The thick line at the top is the nut."),
    (m) =>
      `A numbered dot is a finger: ${count(1, m)} is your pointing finger, ${count(2, m)} is your middle finger, ` +
      `${count(3, m)} is your ring finger and ${count(4, m)} is your little finger.`,
    say("An O above a string means play it open, with no finger. An X means don't play that string."),
  ];
  return { play, read };
}

// ── Keyboard faces ───────────────────────────────────────────────────────────

const KEYBOARD_READ: Say[] = [
  say("The coloured dots are the keys to press."),
  say("The root dot is the same colour as the card."),
];

function describeKeyboard(chord: string, face: "keyboard" | "keyboard-hands", req: KeyboardFaceRequest) {
  // Keys low to high, as the card plays them: `playbackFor` is the order's source.
  const pitches = playbackFor(req).notes;
  const order = pitches.map((_, i) => i).sort((a, b) => pitches[a] - pitches[b] || a - b);
  const names = faceNoteNames(chord, face)!;
  const slash = parseChordSymbol(chord)?.bass;
  const rootName = face === "keyboard-hands" && !slash ? names[0] : chordNotes(chord)[slash ? 1 : 0];
  const keys = (indices: number[]) => (m: Mode) => listOf(indices.map((i) => note(names[i], m)));
  const play: Say[] = [];

  if (face === "keyboard-hands" || slash) {
    const left = face === "keyboard-hands" ? new Set(req.hands!.lh) : new Set([order[0]]);
    const lh = order.filter((i) => left.has(i));
    const rh = order.filter((i) => !left.has(i));
    const lhName = (m: Mode) => note(names[lh[0]], m);
    play.push(
      slash
        ? (m) => `Your left hand plays the bass note, ${lhName(m)}.`
        : (m) => `Your left hand plays the root, ${lhName(m)}.`,
      (m) => `Your right hand plays the other keys, from low to high: ${keys(rh)(m)}.`,
    );
    if (slash) play.push((m) => `The root is ${note(rootName, m)}.`);
  } else {
    play.push((m) => `Press these keys with your right hand, from low to high: ${keys(order)(m)}.`);
    // Fingers only for a plain three-note shape in one hand: 1-3-5.
    if (order.length === 3) {
      const [low, mid, high] = order;
      play.push((m) => {
        const num = (n: number) => (m === "text" ? ` (${n})` : "");
        return `Use your thumb${num(1)} on ${note(names[low], m)}, your middle finger${num(3)} on ${note(names[mid], m)} ` +
          `and your little finger${num(5)} on ${note(names[high], m)}.`;
      });
    }
    play.push((m) => `The root is ${note(rootName, m)}.`);
  }

  const read = face === "keyboard-hands"
    ? [...KEYBOARD_READ, say("L.H. means left hand and R.H. means right hand.")]
    : KEYBOARD_READ;
  return { play, read };
}

// ── Public ───────────────────────────────────────────────────────────────────

/**
 * Plain-English "how to play" text for a chord face.
 *
 * Describes `options.request` (an alternative from `positionsFor`) when given,
 * else the card shape `requestFor(chord, face, theme)` draws. Throws exactly
 * when `requestFor` does (the face cannot print the chord), and when a request
 * belongs to a different face.
 */
export function describeShape(chord: string, face: CardFace, options: DescribeShapeOptions): ShapeDescription {
  const req = options.request ?? requestFor(chord, face, options.theme);
  let parts: { play: Say[]; read: Say[] };
  if (face === "keyboard" || face === "keyboard-hands") {
    if (req.kind !== "keyboard" || (face === "keyboard-hands") !== !!req.hands) {
      throw new Error(`the request is not a ${face} face's`);
    }
    if (face === "keyboard-hands") handsWindow(chord); // the face's own refusal of a chord with no exploded voicing
    parts = describeKeyboard(chord, face, req);
  } else {
    if (req.kind !== "guitar" || req.instrument !== face) {
      throw new Error(`the request is not a ${face} face's${req.kind === "guitar" ? ` (it is ${req.instrument})` : " (it is keyboard)"}`);
    }
    parts = describeFretted(req);
  }
  const play = render(parts.play, "text");
  const read = render(parts.read, "text");
  return {
    play,
    read,
    text: [...play, ...read].join(" "),
    spoken: [...render(parts.play, "spoken"), ...render(parts.read, "spoken")].join(" "),
  };
}
