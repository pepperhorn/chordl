/**
 * Chooses which slice of a piano the keyboard face shows, and pins each chord
 * tone to an exact key within it.
 *
 * Two problems this fixes, both visible on every printed card before it existed:
 *
 * 1. **Chords rendered as inversions.** `PianoKeyboard` matches bare pitch
 *    classes to the *first* key of that name in its range (chordl-react's
 *    `matchHighlightsToKeys`). Handed ["B","D","F#"] on a keyboard starting at
 *    C, it lit the octave's D, F# and B — left to right, D→F#→B — so a card
 *    labelled "Bm" printed a first-inversion shape. Only C-rooted chords came
 *    out root-lowest. chordl supports an octave-qualified form ("B:0"), which
 *    is what this module emits, so each tone lands on the key we mean.
 *
 * 2. **Half the keyboard was blank.** The face was a fixed 14 white keys from
 *    C, but every chord matched inside the lower octave, so the upper seven
 *    keys were dead space on all twenty cards.
 *
 * The window is a fixed `KEYBOARD_WHITE_KEYS` wide on every card — deliberately
 * not sized per chord. The card's diagram box (chordcards' src/layout.ts `diagramBox`) is
 * fixed, so a variable-width keyboard would scale to a different key size on
 * different cards; a beginner comparing two cards side by side should see the
 * same piano, not the same piano at two magnifications.
 */

import { computeKeyboard } from "@pepperhorn/chordl-core";

/**
 * White keys per keyboard face.
 *
 * The widest chord the decks print spans 8 white keys: a maj7 on a black-key
 * root (Ebmaj7, root to seventh), because a black key is measured from the
 * white key beneath it. 8 + 2 + 2 = 12 fits in 13 with a key to spare. Every
 * other seventh spans 7 and gets 3 either side; triads span 5 and get 4. The
 * minimum only decides what fits — padding is centred regardless — so a chord
 * that fitted at 3 keys of context is windowed exactly as it was.
 */
export const KEYBOARD_WHITE_KEYS = 13;

/**
 * Minimum white keys of context guaranteed on each side of the chord. Mirrors
 * themes/crf-default.json's `keyboard.minContextKeys`, which is what the faces
 * actually read; this is the default for callers that pass no dimensions.
 */
export const MIN_CONTEXT_KEYS = 2;

const WHITE_NOTE_ORDER = ["C", "D", "E", "F", "G", "A", "B"] as const;
export type WhiteNote = (typeof WHITE_NOTE_ORDER)[number];

/** Semitone of each white key within an octave: C=0, D=2, E=4, F=5, G=7, A=9, B=11. */
const WHITE_SEMITONES = [0, 2, 4, 5, 7, 9, 11];

/**
 * White-key index of each semitone — a black key maps to the white key it sits
 * on top of (C#→C, D#→D, F#→F, G#→G, A#→A). This is what makes the window
 * measurement correct for chords with black-key roots: F#'s leftmost visual
 * extent is F's key, not F#'s narrow overlay.
 */
const WHITE_INDEX_OF_SEMITONE = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];

const SEMITONE_OF_PITCH_CLASS: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

/**
 * Arbitrary absolute base so intermediate arithmetic never goes negative; the
 * output is relative to the window, so the value itself never escapes.
 */
const BASE_SEMITONE = 48;

/** Absolute white-key index of an absolute semitone. */
function whiteIndexOf(semitone: number): number {
  return Math.floor(semitone / 12) * 7 + WHITE_INDEX_OF_SEMITONE[semitone % 12];
}

/**
 * Stack root-position pitch classes into a rising voicing.
 *
 * `resolveChord` returns tones in interval order from the root (Bm →
 * ["B","D","F#"]), but as bare pitch classes they carry no octave, which is
 * precisely what let the renderer scatter them. Each tone is placed at or above
 * its predecessor, lifting by an octave whenever it would otherwise fall below
 * — the same rule chordl's own `PianoChord` applies (PianoChord.tsx's
 * `prevSemi` loop).
 */
export function voiceAscending(pitchClasses: string[]): number[] {
  if (pitchClasses.length === 0) throw new Error("cannot voice an empty chord");

  const semitones: number[] = [];
  let previous = -1;
  for (const pc of pitchClasses) {
    const base = SEMITONE_OF_PITCH_CLASS[pc];
    if (base === undefined) throw new Error(`unknown pitch class "${pc}"`);
    let semitone = BASE_SEMITONE + base;
    while (semitone <= previous) semitone += 12;
    semitones.push(semitone);
    previous = semitone;
  }
  return semitones;
}

export interface KeyboardWindow {
  /** White key the rendered keyboard starts on. */
  startFrom: WhiteNote;
  /** White keys wide — the theme's `keyboard.whiteKeys`. */
  size: number;
  /**
   * Octave-qualified highlight keys ("B:0", "D:1", …), index-aligned with the
   * pitch classes passed in. The octave is *relative to the window's first
   * key* and increments at each C, matching `computeKeyboard`'s numbering.
   */
  highlightKeys: string[];
  /** White keys of context to the left of the chord. Never below `MIN_CONTEXT_KEYS`. */
  padLeft: number;
  /** White keys of context to the right of the chord. Never below `MIN_CONTEXT_KEYS`. */
  padRight: number;
}

/**
 * Centre a chord in a fixed-width keyboard window.
 *
 * `pitchClasses` must be the chord's tones in root-position interval order —
 * the sharp-spelled identity used for key matching, not the display spelling
 * (see ./faces.ts's `sharpPitchClasses` vs `chordNotes`).
 */
export function keyboardWindow(
  pitchClasses: string[],
  chord: string,
  dims: { whiteKeys: number; minContextKeys: number } = {
    whiteKeys: KEYBOARD_WHITE_KEYS,
    minContextKeys: MIN_CONTEXT_KEYS,
  },
  /**
   * Absolute semitones, index-aligned with `pitchClasses`, in `voiceAscending`'s
   * scale. For voicings that are not a plain rising stack (the hands face puts
   * its R.H. tones an octave above the bass). Defaults to stacking the tones.
   */
  explicitSemitones?: number[],
): KeyboardWindow {
  const { whiteKeys, minContextKeys } = dims;
  const semitones = explicitSemitones ?? voiceAscending(pitchClasses);

  const lowWhite = whiteIndexOf(semitones[0]);
  const highWhite = whiteIndexOf(semitones[semitones.length - 1]);
  const span = highWhite - lowWhite + 1;

  // Fail loudly rather than silently cropping a chord tone off the card. A
  // quality wide enough to trip this needs a wider `keyboard.whiteKeys`, which
  // is a deck-wide layout decision, not something to paper over per chord.
  if (span + minContextKeys * 2 > whiteKeys) {
    throw new Error(
      `chord "${chord}" spans ${span} white keys, which leaves less than ` +
        `${minContextKeys} keys of context either side in a ` +
        `${whiteKeys}-key window. Widen keyboard.whiteKeys in the theme.`,
    );
  }

  const padLeft = Math.floor((whiteKeys - span) / 2);
  const padRight = whiteKeys - span - padLeft;
  const startWhite = lowWhite - padLeft;

  const startFrom = WHITE_NOTE_ORDER[startWhite % 7];
  const startSemitone =
    Math.floor(startWhite / 7) * 12 + WHITE_SEMITONES[startWhite % 7];

  // `computeKeyboard`'s octave is 0 at the first key and increments at each C,
  // so an octave boundary is a multiple of 12 in absolute semitones.
  const startOctave = Math.floor(startSemitone / 12);
  const highlightKeys = pitchClasses.map(
    (pc, i) => `${pc}:${Math.floor(semitones[i] / 12) - startOctave}`,
  );

  return { startFrom, size: whiteKeys, highlightKeys, padLeft, padRight };
}

/**
 * Resolve a window's highlight keys to their index in the rendered key list.
 *
 * This exists for tests: it asks chordl's own `computeKeyboard` where each tone
 * actually lands, so a regression that scatters the chord again (the original
 * bug) is caught by asserting the indices rise, rather than by trusting this
 * module's arithmetic to agree with the renderer's.
 */
export function keyIndicesFor(window: KeyboardWindow, format: "compact" | "exact" = "compact"): number[] {
  const keys = computeKeyboard(window.startFrom, window.size, format);
  return window.highlightKeys.map((hk) => {
    const [note, octave] = hk.split(":");
    const idx = keys.findIndex(
      (k) => k.note === note && k.octave === Number(octave),
    );
    if (idx === -1) throw new Error(`"${hk}" is not a key in this window`);
    return idx;
  });
}

/**
 * Horizontal centre of each highlighted key, in the rendered keyboard SVG's own
 * coordinate space.
 *
 * The template draws its note names on the card, below the keyboard, not inside
 * the keyboard graphic — so they stay upright and undistorted while the
 * keyboard itself is stretched. chordcards' src/card.ts maps these offsets through the same
 * transform it applies to the artwork, which is what keeps a label under its
 * key. Asking chordl for the geometry (rather than recomputing key pitch here)
 * means the labels cannot drift from the keys they belong to.
 */
export function keyCentresFor(
  window: KeyboardWindow,
  format: "compact" | "exact",
): number[] {
  const keys = computeKeyboard(window.startFrom, window.size, format);
  return keyIndicesFor(window, format).map((i) => keys[i].x + keys[i].width / 2);
}
