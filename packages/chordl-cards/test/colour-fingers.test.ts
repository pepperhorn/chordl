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
