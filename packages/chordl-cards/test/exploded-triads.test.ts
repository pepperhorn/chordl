import { describe, it, expect } from "vitest";
import { resolveChord } from "@pepperhorn/chordl-core";
import { loadTheme } from "./theme-fixture";
import {
  keyboardNoteLabels, handsNoteLabels, handLabels, sharpPitchClasses,
} from "../src/faces";
import { keyboardWindow } from "../src/keyboard-window";
import { qualityLabelFor } from "../src/names";

/**
 * The Exploded Triads deck: every root against every quality it teaches, with
 * the exploded face on the front and the plain root-position keyboard behind.
 *
 * Both faces are pure up to the browser render — window, note names, hand
 * captions, title label — so the sweep checks all 120 cards without one.
 */
const ROOTS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const QUALITIES = ["", "m", "6", "m6", "7", "maj7", "m7", "aug", "dim", "sus4"];
const CHORDS = ROOTS.flatMap((r) => QUALITIES.map((q) => r + q));

const THEME = loadTheme();

describe("every Exploded Triads chord", () => {
  it("is 120 chords", () => expect(CHORDS).toHaveLength(120));

  it.each(CHORDS)("%s fits the plain keyboard, one label per tone, spelled by chordl-core", (chord) => {
    const tones = resolveChord(chord).notes;
    const w = keyboardWindow(sharpPitchClasses(chord), chord, THEME.keyboard);
    expect(w.highlightKeys).toHaveLength(tones.length);
    expect(w.padLeft).toBeGreaterThanOrEqual(THEME.keyboard.minContextKeys);
    expect(w.padRight).toBeGreaterThanOrEqual(THEME.keyboard.minContextKeys);

    const labels = keyboardNoteLabels(chord, THEME);
    expect(labels.map((l) => l.text)).toEqual(tones);
    for (const l of labels) expect(Number.isFinite(l.x), `${chord} ${l.text}`).toBe(true);
  });

  it.each(CHORDS)("%s builds the hands face: bass plus an R.H. pair, captions placed", (chord) => {
    const tones = resolveChord(chord).notes;
    const labels = handsNoteLabels(chord, THEME);
    expect(labels).toHaveLength(3);
    // L.H. is the root; the R.H. pair are chord tones in chordl-core's spelling.
    expect(labels[0].text).toBe(tones[0]);
    for (const l of labels.slice(1)) expect(tones, `${chord} R.H.`).toContain(l.text);

    const captions = handLabels(chord, THEME);
    expect(captions.map((c) => c.text)).toEqual(["L.H.", "R.H."]);
    for (const c of captions) expect(Number.isFinite(c.x), `${chord} ${c.text}`).toBe(true);
  });

  it("titles each quality the way the card sets it", () => {
    const TITLES = ["maj", "min", "6", "min6", "7", "maj7", "min7", "aug", "dim", "sus4"];
    for (const root of ROOTS) {
      QUALITIES.forEach((q, i) => expect(qualityLabelFor(root + q), root + q).toBe(TITLES[i]));
    }
  });

  it("windows every chord that fitted at 3 keys of context exactly as before", () => {
    // Padding is centred by (whiteKeys - span) / 2 whatever the minimum, so
    // lowering keyboard.minContextKeys from 3 to 2 only admits the black-key
    // maj7s (8 white keys); every other card keeps its keys, byte for byte.
    const at = (min: number, chord: string) =>
      keyboardWindow(sharpPitchClasses(chord), chord, { whiteKeys: THEME.keyboard.whiteKeys, minContextKeys: min });
    let fitted = 0;
    for (const chord of CHORDS) {
      let before;
      try { before = at(3, chord); } catch { continue; }
      fitted++;
      expect(at(2, chord), chord).toEqual(before);
    }
    expect(fitted).toBe(115);
  });

  it("spells the awkward ones as chordl-core does", () => {
    for (const chord of ["Ebm6", "Bbdim", "Gaug", "C#maj7", "Absus4"]) {
      expect(keyboardNoteLabels(chord, THEME).map((l) => l.text), chord)
        .toEqual(resolveChord(chord).notes);
    }
    expect(qualityLabelFor("Ebm6")).toBe("min6");
    expect(qualityLabelFor("Gaug")).toBe("aug");
  });
});

// Not ported: the decks/exploded-triads.json checks, which test chordcards'
// deck file and manifest parser.
