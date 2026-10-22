/**
 * Every chord on the PepperHorn sheet, and every slash chord in the catalogue
 * spec, gets a six-string guitar position — or is on the list below of chords
 * that have no voicing under the generator's hard constraints (root bass, four
 * fingers, one barre, a 4-fret box). Adding to the list is a decision, not a
 * fix: these want a rootless or reduced voicing a teacher signs off.
 *
 * At the time of writing (chords-db 0.5.1):
 *   sheet  1,290 chords: 554 chords-db (42.9%), 15 power chord (1.2%),
 *          685 generated (53.1%), 36 impossible (2.8%)
 *   slash  2,700 chords: 61 chords-db (2.3%), 2,637 generated (97.7%),
 *          2 impossible (0.1%)
 */
import { describe, expect, it } from "vitest";
import { guitarPositionFor } from "../src/guitarPosition.js";
import { analyzeChordTones, positionSpellsChord } from "../src/voicingGenerator.js";
import { sheetChords, slashChords } from "./fixtures/sheetCatalogue.js";
import type { CatalogueChord } from "./fixtures/sheetCatalogue.js";

/**
 * Six required tones (root, 3, b7 and three alterations or a 13) over a root
 * bass, or a slash bass that pins the 5th of a 9th chord. Root-dependent:
 * open strings rescue some roots (C13(#9,#5) is playable, G#13(#9,#5) is not).
 */
const IMPOSSIBLE_SHEET = [
  "C7(#11,b9,#5)", "C13(b9,b5)", "C13(b9,#5)", "C13(#11,b9)", "C#13(b9,#5)", "Db13(b9,#5)",
  "D7(#11,b9,#5)", "Dmaj9(#11,#5)", "F13(b9,#5)", "F13(#9,#5)", "F13(#11,#5)",
  "F#maj13(#11,#5)", "Gbmaj13(#11,#5)", "G13(b9,#5)", "G#13(b9,b5)", "G#13(#9,b5)",
  "G#13(#9,#5)", "G#13(#11,b9)", "G#13(#11,#9)", "Ab13(b9,b5)", "Ab13(#9,b5)", "Ab13(#9,#5)",
  "Ab13(#11,b9)", "Ab13(#11,#9)", "A7(#11,b9,#5)", "A7(#11,#9,#5)", "A13(b9,b5)", "A13(#9,b5)",
  "A13(#9,#5)", "A13(#11,#5)", "A13(#11,b9)", "A13(#11,#9)", "Amaj13(#11,#5)",
  "B7(#11,b9,#5)", "B13(b9,b5)", "B13(#11,b9)",
];
const IMPOSSIBLE_SLASH = ["Ab9/Eb", "G#9/B"];

function survey(chords: CatalogueChord[]) {
  const tally = { db: 0, power: 0, generated: 0 };
  const impossible: string[] = [];
  for (const c of chords) {
    const p = guitarPositionFor(c);
    if (!p) {
      impossible.push(c.name);
      continue;
    }
    const bass = c.bass && c.bass !== c.root ? c.bass : undefined;
    expect(positionSpellsChord(p, analyzeChordTones(c.root, c.pitchClasses, bass)), c.name).toBe(true);
    if (p.generated) tally.generated++;
    else if (p.source === "chords-db") tally.db++;
    else tally.power++;
  }
  return { tally, impossible };
}

describe("catalogue coverage", () => {
  it("every sheet chord has a guitar position or is a documented impossibility", () => {
    const { tally, impossible } = survey(sheetChords());
    expect(impossible).toEqual(IMPOSSIBLE_SHEET);
    expect(tally).toEqual({ db: 554, power: 15, generated: 685 });
  }, 60_000);

  it("every slash chord has a guitar position or is a documented impossibility", () => {
    const { tally, impossible } = survey(slashChords());
    expect(impossible).toEqual(IMPOSSIBLE_SLASH);
    expect(tally).toEqual({ db: 61, power: 0, generated: 2637 });
  }, 60_000);
});
