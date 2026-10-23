// colourFingers is exported for print's extra fretted faces (ukulele, bass,
// violin, guitar voicings), which chordcards draws outside requestFor.
import { describe, expect, it } from "vitest";
import { lookupGuitarChord, dbPositionToChord, INSTRUMENTS } from "@pepperhorn/chordl-guitar";
import { colourFingers, toneColor } from "../src/model";
import { loadTheme } from "./theme-fixture";

const THEME = loadTheme();

describe("colourFingers (exported)", () => {
  it("colours a ukulele C's fretted A string by the pitch it sounds (C)", () => {
    const found = lookupGuitarChord("C", "ukulele")!;
    const shape = dbPositionToChord(found.positions[0], INSTRUMENTS.ukulele.strings);
    const coloured = colourFingers(shape as never, "ukulele", "C", THEME);
    // Ukulele C: 0003 — string 1 (A) at fret 3 sounds C.
    const finger = coloured.fingers.find((f) => f[0] === 1 && f[1] === 3)!;
    expect((finger[2] as { color: string }).color).toBe(toneColor(THEME, "fret", "C", "C"));
  });
});

describe("colourFingers in single fret colour mode", () => {
  const SINGLE = loadTheme();
  SINGLE.fret.colorMode = "single";

  const barred = () => {
    const found = lookupGuitarChord("F", "guitar")!;
    const shape = dbPositionToChord(found.positions[0], INSTRUMENTS.guitar.strings);
    expect(shape.barres?.length, "F's first shape is a barre chord").toBeGreaterThan(0);
    return shape;
  };

  it("paints the barre the root's single dot colour, classed so print can repaint it", () => {
    const coloured = colourFingers(barred() as never, "guitar", "F", SINGLE);
    const barre = (coloured as { barres: Array<{ className?: string; color?: string }> }).barres[0]!;
    // svguitar hardcodes the bar black; print's applyBarreFill repaints any
    // rect carrying a barre-bar-<pitch> class with the barre's colour.
    expect(barre.className).toMatch(/\bbarre-bar-\w+/);
    expect(barre.color).toBe(SINGLE.roots.F!.fretCircle);
  });

  it("leaves the fingers to the request's single fingerColor", () => {
    const shape = barred();
    const coloured = colourFingers(shape as never, "guitar", "F", SINGLE);
    expect(coloured.fingers).toEqual(shape.fingers);
  });

  it("resolves a flat root through its sharp entry, as requestFor does", () => {
    const found = lookupGuitarChord("Bb", "guitar")!;
    const shape = dbPositionToChord(found.positions[0], INSTRUMENTS.guitar.strings);
    const root = SINGLE.roots.Bb ?? SINGLE.roots["A#"]!;
    const coloured = colourFingers(shape as never, "guitar", "Bb", SINGLE);
    const barres = (coloured as { barres?: Array<{ color?: string }> }).barres ?? [];
    expect(barres.length, "Bb's first shape is a barre chord").toBeGreaterThan(0);
    for (const b of barres) expect(b.color).toBe(root.fretCircle);
  });
});
