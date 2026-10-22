/**
 * What each card face draws, as plain data: the renderer-neutral request the
 * print pipeline hashes and hands to its render host, and the web player hands
 * to chordl-react. Moved from chordcards' src/diagrams.ts — the keyboard,
 * keyboard-hands and guitar-top3 parts of `requestFor`, plus the note-label
 * helpers — with no browser, cache or `node:` import.
 *
 * The request objects are byte-identical to what chordcards built (key order
 * included): print keys its disk cache on `JSON.stringify(request)`, so a
 * reordered key would silently retire every cached diagram. See
 * test/faces.test.ts's golden check.
 */

import { INSTRUMENTS, lookupTop3Chord } from "@pepperhorn/chordl-guitar";
import { computeKeyboard } from "@pepperhorn/chordl-core";
import { chordSpelling } from "./catalogue";
import { keyCentresFor, keyboardWindow } from "./keyboard-window";
import { handsWindow } from "./hands";
import { familyOf, toneColor, type Theme } from "./theme";

/** The card faces this package models. */
export type CardFace = "keyboard" | "keyboard-hands" | "guitar-top3";

/** A fretted shape as svguitar takes it (chordl-guitar's `Chord`). */
export type FrettedShape = NonNullable<ReturnType<typeof lookupTop3Chord>>;

export interface KeyboardFaceRequest {
  kind: "keyboard";
  chordLabel: string;
  /** Octave-qualified highlight keys ("B:0", "D:1"), relative to the window's first key. */
  notes: string[];
  /** White key the window starts on. */
  startFrom: string;
  /** White keys wide. */
  size: number;
  format: "compact" | "exact";
  /** Sharp pitch class -> colour, when the theme colours by pitch; else null. */
  pitchColors: Record<string, string> | null;
  /** The card's single highlight when not colouring by pitch; else null. */
  highlightColor: string | null;
  /** keyboard-hands only: indices into `notes` played by each hand. */
  hands?: { lh: number[]; rh: number[] };
}

export interface GuitarFaceRequest {
  kind: "guitar";
  /** Fingers carry per-note colours when the theme's fret colorMode is "pitch". */
  shape: FrettedShape;
  instrument: "guitar-top3";
  fingerColor: string;
  fingerTextColor: string;
  fingerTextSize: number;
  fingerStrokeColor: string;
  fingerStrokeWidth: number;
  diagramColor: string;
  fontFamily: string;
  fingerTextWeight: number;
  labelFontFamily: string;
  labelFontWeight: number;
}

export type FaceRequest = KeyboardFaceRequest | GuitarFaceRequest;

/** Theme tables are keyed by sharp names; a flat-rooted chord maps onto them. */
const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#",
};

const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};
// The chord qualities the keyboard faces can render. ./names.ts's
// QUALITY_LABELS advertises a wider set (sus2, add9); keep the two in step by
// hand. 6, m6, aug, dim, sus2, sus4, dim7, m7b5, mMaj7, 7#5 and maj7#5 are keyboard-only: SUFFIX has no guitar
// presets for them, so the guitar face throws "unsupported chord suffix".
//
// Maps, not object literals: the key is whatever text followed the root, and
// an object literal answers `INTERVALS["constructor"]` with something truthy
// off Object.prototype. A Map has no such inheritance.
const INTERVALS = new Map<string, number[]>([
  ["", [0, 4, 7]], ["m", [0, 3, 7]], ["7", [0, 4, 7, 10]],
  ["m7", [0, 3, 7, 10]], ["maj7", [0, 4, 7, 11]],
  ["6", [0, 4, 7, 9]], ["m6", [0, 3, 7, 9]], ["aug", [0, 4, 8]],
  ["dim", [0, 3, 6]], ["sus4", [0, 5, 7]], ["sus2", [0, 2, 7]],
  ["dim7", [0, 3, 6, 9]], ["m7b5", [0, 3, 6, 10]], ["mMaj7", [0, 3, 7, 11]],
  ["7#5", [0, 4, 8, 10]], ["maj7#5", [0, 4, 8, 11]],
]);
/** Chord-symbol suffix -> the suffix spelling used by the preset tables. */
const SUFFIX = new Map<string, string>([
  ["", "major"], ["m", "minor"], ["7", "7"], ["m7", "m7"], ["maj7", "maj7"],
]);

function split(chord: string): { root: string; rest: string } {
  const m = chord.trim().match(/^([A-G][#b]?)(.*)$/);
  if (!m) throw new Error(`unparseable chord "${chord}"`);
  return { root: m[1], rest: m[2].trim() };
}

/**
 * Sharp-only root-position pitch classes, e.g. Gm -> ["G", "A#", "D"].
 *
 * The keyboard's key-matching identity, never printed — see `chordNotes` for
 * the display spelling. Also the gate that a chord's quality is supported.
 */
export function sharpPitchClasses(chord: string): string[] {
  const { root, rest } = split(chord);
  const r = PC[root];
  if (r === undefined) throw new Error(`unknown root in "${chord}"`);
  const iv = INTERVALS.get(rest);
  if (!iv) throw new Error(`unsupported quality "${rest}" in "${chord}"`);
  return iv.map((i) => PC_NAMES[(r + i) % 12]);
}

/**
 * Root-position note names for display ("Bb", not "A#"), from chordl-core's
 * `resolveChord` — one spelling authority. Gated by `sharpPitchClasses`, so an
 * unsupported quality throws /unsupported/ before chordl-core sees it.
 */
export function chordNotes(chord: string): string[] {
  sharpPitchClasses(chord); // validates root + quality; throws "unsupported ..." otherwise
  return chordSpelling(chord);
}

/**
 * The renderer-neutral description of one card face.
 *
 * `keyboard`: the chord in root position, centred in the theme's window.
 * `keyboard-hands`: the exploded voicing (bass in the L.H., two tones in the
 * R.H.) with the hand split as indices into `notes`. `guitar-top3`: the top-3
 * preset shape, fingers coloured by the pitch each one sounds.
 *
 * Throws, naming the chord, for anything the face cannot print.
 */
export function requestFor(chord: string, face: CardFace, theme: Theme): FaceRequest {
  const root = split(chord).root;
  const rootEntry = theme.roots[root] ?? theme.roots[FLAT_TO_SHARP[root] ?? root];
  if (!rootEntry) throw new Error(`theme has no root entry for "${root}" (chord "${chord}")`);

  if (face === "guitar-top3") {
    const instrument = "guitar-top3" as const;
    const shape = top3ShapeFor(chord);
    return {
      kind: "guitar" as const,
      shape: colourFingers(shape, instrument, root, theme),
      instrument,
      fingerColor: rootEntry.fretCircle,
      fingerTextColor: rootEntry.fretFingerText,
      fingerTextSize: theme.fonts.fretFingerText.size,
      fingerStrokeColor: rootEntry.fretCircleStroke,
      fingerStrokeWidth: theme.fret.circleStrokeWidth,
      diagramColor: theme.fret.diagramColor,
      fontFamily: familyOf(theme, theme.fonts.fretFingerText),
      // svguitar has no weight setting and writes its <text> with none; the
      // renderer stamps these on: finger numbers from fretFingerText, every
      // other run (the tuning row, a "2fr" label) from stringLabel.
      fingerTextWeight: theme.fonts.fretFingerText.weight,
      labelFontFamily: familyOf(theme, theme.fonts.stringLabel),
      labelFontWeight: theme.fonts.stringLabel.weight,
    };
  }

  // Sharp identity for highlightKeys (key-matching); display spelling comes
  // from chordNotes / the voicing. Both stay index-aligned with the window's
  // octave-qualified keys.
  if (face === "keyboard-hands") {
    // The bass and the two R.H. tones, pinned to the keys handsWindow chose.
    // lh/rh index into `notes`, which is bass-first.
    const { window, voicing } = handsWindow(chord);
    const pcs = [...voicing.lh, ...voicing.rh].map((t) => t.pc);
    return {
      kind: "keyboard" as const,
      chordLabel: chord,
      notes: window.highlightKeys,
      startFrom: window.startFrom,
      size: window.size,
      format: theme.keyboard.format,
      pitchColors:
        theme.keyboard.colorMode === "pitch"
          ? Object.fromEntries(pcs.map((pc) => [pc, toneColor(theme, "keyboard", pc, root)]))
          : null,
      highlightColor:
        theme.keyboard.colorMode === "pitch" ? null : rootEntry.keyboardHighlight,
      hands: { lh: [0], rh: [1, 2] },
    };
  }

  const pitchClasses = sharpPitchClasses(chord);
  const window = keyboardWindow(pitchClasses, chord, theme.keyboard);
  return {
    kind: "keyboard" as const,
    chordLabel: chord,
    // Octave-qualified ("B:0", "D:1", …) rather than bare pitch classes: bare
    // ones let chordl match the first key of that name in range, which printed
    // Bm as D-F#-B. See ./keyboard-window.ts.
    notes: window.highlightKeys,
    startFrom: window.startFrom,
    size: window.size,
    format: theme.keyboard.format,
    // Only the tones this card shows, so an unrelated palette entry cannot
    // change this card's request (print's cache key) or its artwork.
    pitchColors:
      theme.keyboard.colorMode === "pitch"
        ? Object.fromEntries(
            pitchClasses.map((pc) => [pc, toneColor(theme, "keyboard", pc, root)]),
          )
        : null,
    highlightColor:
      theme.keyboard.colorMode === "pitch" ? null : rootEntry.keyboardHighlight,
  };
}

/**
 * Attach per-finger colours to a fretted shape so each marker carries the
 * colour of the pitch it sounds.
 *
 * The pitch of a stopped string is its open note transposed up by the fret.
 * svguitar numbers strings from the highest (1) down, while
 * `InstrumentConfig.tuning` is listed low to high, hence `strings - n`.
 * Open (0) and muted ("x") strings are left alone: svguitar draws them as nut
 * glyphs, which have nothing to fill.
 */
function colourFingers(
  shape: FrettedShape,
  instrument: keyof typeof INSTRUMENTS,
  root: string,
  theme: Theme,
): FrettedShape {
  if (theme.fret.colorMode !== "pitch") return shape;

  const cfg = INSTRUMENTS[instrument];
  if (!cfg) return shape;
  const { tuning, strings } = cfg as { tuning: string[]; strings: number };

  // chords-db convention: when the window starts above the nut, finger frets
  // are window-relative and the absolute fret is position + fret - 1.
  const windowStart = (shape as { position?: number }).position ?? 1;

  const fingers = shape.fingers.map((finger) => {
    const [stringNo, fret, existing] = finger as [number, number | string, unknown];
    if (typeof fret !== "number" || fret <= 0) return finger;

    const open = tuning[strings - stringNo];
    if (open === undefined) return finger;
    const absoluteFret = windowStart <= 1 ? fret : windowStart + fret - 1;
    const pc = PC_NAMES[(PC[open]! + absoluteFret) % 12];

    // Preserve any finger-number text svguitar was already given; the third
    // element is a bare string in the preset tables.
    const text = typeof existing === "string" ? existing : undefined;
    return [
      stringNo,
      fret,
      {
        ...(text ? { text } : {}),
        color: toneColor(theme, "fret", pc, root),
        textColor: theme.roots[root]?.fretFingerText ?? theme.fret.diagramColor,
        strokeColor: theme.roots[root]?.fretCircleStroke ?? theme.fret.diagramColor,
        strokeWidth: theme.fret.circleStrokeWidth,
      },
    ];
  });

  // A barre takes the colour of the LOWEST-sounding string it covers: svguitar
  // allows one colour per barre, so one string has to stand for the bar.
  const barres = ((shape as { barres?: unknown[] }).barres ?? []).map((barre) => {
    const b = barre as { fromString: number; toString: number; fret: number };
    if (typeof b.fret !== "number" || b.fret <= 0) return barre;

    // Highest svguitar string number in the span = lowest-sounding string.
    const bassString = Math.max(b.fromString, b.toString);
    const open = tuning[strings - bassString];
    if (open === undefined) return barre;
    const absoluteFret = windowStart <= 1 ? b.fret : windowStart + b.fret - 1;
    const pc = PC_NAMES[(PC[open]! + absoluteFret) % 12];

    return {
      ...b,
      // svguitar emits the bar as an unclassed <rect>; the class makes it
      // addressable (print repaints it, since svguitar hardcodes its fill).
      className: `barre-bar barre-bar-${pc.replace("#", "s")}`,
      color: toneColor(theme, "fret", pc, root),
      textColor: theme.roots[root]?.fretFingerText ?? theme.fret.diagramColor,
      strokeColor: theme.roots[root]?.fretCircleStroke ?? theme.fret.diagramColor,
      strokeWidth: theme.fret.circleStrokeWidth,
    };
  });

  return { ...shape, fingers, barres } as FrettedShape;
}

/** The top-3 preset shape for a chord, or throw naming the chord. */
function top3ShapeFor(chord: string): FrettedShape {
  const { root, rest } = split(chord);
  const suffix = SUFFIX.get(rest);
  if (!suffix) throw new Error(`unsupported chord suffix in "${chord}"`);
  const shape = lookupTop3Chord(root, suffix);
  if (!shape) {
    throw new Error(
      `no top-3 shape for "${chord}". Add it to GUITAR_TOP3_PRESETS in ` +
        `@pepperhorn/chordl-guitar, or drop the chord from the deck.`,
    );
  }
  return shape;
}

// ── Note labels ─────────────────────────────────────────────────────────────

export interface NoteLabel {
  /** Display spelling, e.g. "Bb" not "A#". */
  text: string;
  /** Centre of the key this labels, in the keyboard SVG's coordinate space. */
  x: number;
}

/**
 * Refuse to emit a label with no key to sit under: the names and the key
 * centres come by different routes, and zipping past the end would print a
 * label at x="NaN" — i.e. not at all.
 */
function assertLabelsAlign(
  chord: string,
  names: number,
  centres: number,
  what: string,
): void {
  if (names !== centres) {
    throw new Error(
      `keyboard ${what} labels for "${chord}" do not line up with its keys: ` +
        `${names} note name(s) against ${centres} key centre(s)`,
    );
  }
}

/** Where each note name goes on the plain keyboard face. */
export function keyboardNoteLabels(chord: string, theme: Theme): NoteLabel[] {
  const window = keyboardWindow(sharpPitchClasses(chord), chord, theme.keyboard);
  const centres = keyCentresFor(window, theme.keyboard.format);
  const names = chordNotes(chord);
  assertLabelsAlign(chord, names.length, centres.length, "note");
  return names.map((text, i) => ({ text, x: centres[i] }));
}

/** Note names for the keyboard-hands face: the L.H. bass, then the two R.H. tones. */
export function handsNoteLabels(chord: string, theme: Theme): NoteLabel[] {
  const { window, voicing } = handsWindow(chord);
  const centres = keyCentresFor(window, theme.keyboard.format);
  const names = [...voicing.lh, ...voicing.rh].map((t) => t.name);
  assertLabelsAlign(chord, names.length, centres.length, "note");
  return names.map((text, i) => ({ text, x: centres[i] }));
}

/** "L.H." over the bass key, "R.H." midway between the two R.H. keys. */
export function handLabels(chord: string, theme: Theme): NoteLabel[] {
  const [lh, ...rh] = handsNoteLabels(chord, theme);
  return [
    { text: "L.H.", x: lh.x },
    { text: "R.H.", x: (rh[0].x + rh[rh.length - 1].x) / 2 },
  ];
}

// ── Derived for renderers (new in chordl-cards) ─────────────────────────────

/**
 * Display note names aligned with a keyboard request's `notes` — chordl-react's
 * `displayNoteNames`. Undefined for the guitar face, which shows no names.
 */
export function faceNoteNames(chord: string, face: CardFace): string[] | undefined {
  if (face === "keyboard") return chordNotes(chord);
  if (face === "keyboard-hands") {
    const { voicing } = handsWindow(chord);
    return [...voicing.lh, ...voicing.rh].map((t) => t.name);
  }
  return undefined;
}

export interface HandBracket {
  label: "L.H." | "R.H.";
  /** Indices into the window's rendered keys (`computeKeyboard` order). */
  keyIndices: number[];
}

/**
 * chordl-react `handBrackets` for a request with a hand split, resolving each
 * note to the key it lit. The same mapping chordcards' render host performs.
 */
export function handBracketsFor(req: KeyboardFaceRequest): HandBracket[] | undefined {
  if (!req.hands) return undefined;
  const keys = computeKeyboard(req.startFrom as never, req.size, req.format);
  const indexOf = (i: number) => {
    const [note, octave] = req.notes[i].split(":");
    const idx = keys.findIndex((k) => k.note === note && k.octave === Number(octave));
    if (idx === -1) throw new Error(`"${req.notes[i]}" is not a key in "${req.chordLabel}"'s window`);
    return idx;
  };
  return [
    { label: "L.H.", keyIndices: req.hands.lh.map(indexOf) },
    { label: "R.H.", keyIndices: req.hands.rh.map(indexOf) },
  ];
}
