import { describe, it, expect } from "vitest";
import { resolveChord } from "@pepperhorn/chordl-core";
import { requestFor, keyboardNoteLabels, handsNoteLabels, type CardFace } from "../src/faces";
import { loadTheme } from "./theme-fixture";

const ROOTS = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "Bb", "B"];
const QUALITIES = [
  "", "m", "6", "m6", "7", "maj7", "m7", "aug", "dim", "sus4", "sus2",
  "dim7", "m7b5", "mMaj7", "7#5", "maj7#5",
];
const CHORDS = ROOTS.flatMap((r) => QUALITIES.map((q) => r + q));
const theme = loadTheme();

function tryFace(chord: string, face: CardFace): string | null {
  try {
    requestFor(chord, face, theme);
    return null;
  } catch (e) {
    return `${chord}: ${(e as Error).message}`;
  }
}

describe("chord library sweep: 15 roots x 16 qualities", () => {
  it("covers 240 chords", () => expect(CHORDS).toHaveLength(240));

  it("the plain keyboard face renders every chord", () => {
    expect(CHORDS.map((c) => tryFace(c, "keyboard")).filter(Boolean)).toEqual([]);
  });

  it("the keyboard-hands face renders every chord", () => {
    expect(CHORDS.map((c) => tryFace(c, "keyboard-hands")).filter(Boolean)).toEqual([]);
  });

  it("keyboard note labels are resolveChord's spelling, root position", () => {
    for (const c of CHORDS) {
      expect(keyboardNoteLabels(c, theme).map((l) => l.text), c).toEqual(resolveChord(c).notes);
    }
  });

  it("hands note labels are resolveChord's spelling (bass first, R.H. ascending)", () => {
    for (const c of CHORDS) {
      const spelled = resolveChord(c).notes;
      const labels = handsNoteLabels(c, theme).map((l) => l.text);
      expect(labels[0], c).toBe(spelled[0]);
      for (const l of labels) expect(spelled, c).toContain(l);
      expect(labels, c).toHaveLength(3);
    }
  });

  it("guitar-top3 coverage is whatever chordl-guitar has a shape for (reported, not required)", () => {
    const ok = CHORDS.filter((c) => tryFace(c, "guitar-top3") === null);
    // Every success must be a real shape; the count is informational.
    console.info(`guitar-top3: ${ok.length}/${CHORDS.length}`);
    expect(ok.length).toBeGreaterThan(0);
  });
});
