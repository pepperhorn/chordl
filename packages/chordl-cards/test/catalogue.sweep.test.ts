/**
 * Every catalogue chord on all 15 roots, and every distinct slash chord, through
 * every face it is allowed: which succeed, and that none throws where it must
 * not. Also chordl-guitar's catalogue coverage (moved here from
 * chordl-guitar/test/catalogueCoverage.test.ts, which could not import this
 * package): which chords get a chords-db shape, a power chord, a generated
 * voicing, or none.
 *
 * A chord without a six-string position needs a rootless or reduced voicing a
 * teacher signs off; adding to that list is a decision, not a fix.
 */
import { describe, expect, it } from "vitest";
import { analyzeChordTones, guitarPositionFor, positionSpellsChord } from "@pepperhorn/chordl-guitar";
import { CHORD_TYPES, ROOTS, spelledChord } from "../src/catalogue";
import { chordNotes, faceNoteNames, keyboardNoteLabels, requestFor, type CardFace } from "../src/faces";
import { slashChordsForBass } from "../src/slash";
import { loadTheme } from "./theme-fixture";

const THEME = loadTheme();

const ROOT_CHORDS = ROOTS.flatMap((root) => CHORD_TYPES.map((type) => ({ chord: root + type.symbol, type })));
const SLASH_CHORDS = ROOTS.flatMap((bass) => slashChordsForBass(bass)).map((c) => c.symbol);

const tryFace = (chord: string, face: CardFace) => {
  try { return requestFor(chord, face, THEME); } catch (e) { return e as Error; }
};

describe("catalogue sweep: keyboard", () => {
  it("every chord and slash chord has a plain keyboard face, labelled in the catalogue's spelling", () => {
    const widths = new Map<number, number>();
    let widest = { size: 0, chords: [] as string[] };
    for (const chord of [...ROOT_CHORDS.map((c) => c.chord), ...SLASH_CHORDS]) {
      const req = tryFace(chord, "keyboard");
      if (req instanceof Error) throw new Error(`${chord}: ${req.message}`);
      if (req.kind !== "keyboard") throw new Error("expected keyboard");
      const names = chordNotes(chord);
      expect(keyboardNoteLabels(chord, THEME).map((l) => l.text), chord).toEqual(names);
      expect(faceNoteNames(chord, "keyboard"), chord).toEqual(names);
      expect(req.notes, chord).toHaveLength(names.length);
      widths.set(req.size, (widths.get(req.size) ?? 0) + 1);
      if (req.size > widest.size) widest = { size: req.size, chords: [chord] };
      else if (req.size === widest.size) widest.chords.push(chord);
    }
    expect(ROOT_CHORDS.length + SLASH_CHORDS.length).toBe(15 * 86 + 2520);
    expect(Object.fromEntries([...widths].sort((a, b) => a[0] - b[0]))).toMatchInlineSnapshot(`
      {
        "12": 453,
        "13": 2259,
        "14": 407,
        "15": 437,
        "16": 178,
        "17": 56,
        "18": 20,
      }
    `);
    expect({ size: widest.size, count: widest.chords.length, first: widest.chords.slice(0, 4) }).toMatchInlineSnapshot(`
      {
        "count": 20,
        "first": [
          "Cadd9/C#",
          "C9/C#",
          "Cadd9/Db",
          "C9/Db",
        ],
        "size": 18,
      }
    `);
  }, 120_000);
});

describe("catalogue sweep: keyboard-hands and guitar-top3 stay restricted", () => {
  it("render exactly where the catalogue's face flags say, on every root", () => {
    const tally = { "keyboard-hands": 0, "guitar-top3": 0 };
    for (const { chord, type } of ROOT_CHORDS) {
      for (const face of ["keyboard-hands", "guitar-top3"] as const) {
        const req = tryFace(chord, face);
        if (type.faces[face]) {
          if (req instanceof Error) throw new Error(`${chord} ${face}: ${req.message}`);
          tally[face]++;
        } else {
          expect(req, `${chord} ${face} should not render`).toBeInstanceOf(Error);
        }
      }
    }
    expect(tally).toMatchInlineSnapshot(`
      {
        "guitar-top3": 75,
        "keyboard-hands": 240,
      }
    `);
  });
});

describe("catalogue sweep: six-string guitar", () => {
  function survey(chords: string[]) {
    const tally = { db: 0, power: 0, generated: 0, impossible: 0 };
    const impossible: string[] = [];
    for (const chord of chords) {
      const req = tryFace(chord, "guitar");
      if (req instanceof Error) {
        expect(req.message, chord).toMatch(/no six-string guitar position/);
        impossible.push(chord);
        tally.impossible++;
        continue;
      }
      if (req.kind !== "guitar") throw new Error("expected guitar");
      // The face's position is the generator's and it spells the chord.
      const s = spelledChord(chord, { strict: true });
      const bass = s.bass && s.bass !== s.root ? s.bass : undefined;
      const pos = guitarPositionFor(s)!;
      expect(positionSpellsChord(pos, analyzeChordTones(s.root, s.pitchClasses, bass)), chord).toBe(true);
      expect(req.generated, chord).toBe(pos.generated);
      if (req.source === "generated") tally.generated++;
      else if (req.source === "chords-db") tally.db++;
      else tally.power++;
    }
    return { tally, impossible };
  }

  // Unavailable under the default root-preserving policy (level 2): these need
  // the stricter ninth AND a root, which no playable grip holds. Not impossible
  // at every level: the explicit rootless opt-in (level 3) voices each, omitting
  // only the root. Consumers do not forward a teaching level yet.
  const NINTH_NEEDS_LEVEL_3 = [
    "C#maj9(#11,#5)", "Dbmaj9(#11,#5)", "F#maj9(#11,#5)", "Gbmaj9(#11,#5)", "Gmaj9(#11,#5)",
    "A9(#11,#5)", "Amaj9(#11,#5)", "B9(#11,#5)", "Bmaj9(#11,#5)",
  ];

  it("the nine ninth-policy symbols: no default position, a rootless one only at level 3", () => {
    for (const chord of NINTH_NEEDS_LEVEL_3) {
      const s = spelledChord(chord, { strict: true });
      expect(guitarPositionFor(s), chord).toBeNull();
      const p = guitarPositionFor(s, { level: 3 });
      expect(p, chord).not.toBeNull();
      if (!p?.generated) throw new Error(`${chord}: expected a generated position`);
      expect(p.rootless, chord).toBe(true);
      expect(p.omitted, chord).toEqual(["1"]);
    }
    const { impossible } = survey(ROOT_CHORDS.map((c) => c.chord));
    for (const chord of NINTH_NEEDS_LEVEL_3) expect(impossible).toContain(chord);
  });

  it("catalogue chords: a position, or a documented impossibility", () => {
    const { tally, impossible } = survey(ROOT_CHORDS.map((c) => c.chord));
    expect(tally).toMatchInlineSnapshot(`
      {
        "db": 539,
        "generated": 691,
        "impossible": 45,
        "power": 15,
      }
    `);
    expect(impossible).toMatchInlineSnapshot(`
      [
        "C7(#11,b9,#5)",
        "C13(b9,b5)",
        "C13(b9,#5)",
        "C13(#11,b9)",
        "C#13(b9,#5)",
        "C#maj9(#11,#5)",
        "Db13(b9,#5)",
        "Dbmaj9(#11,#5)",
        "D7(#11,b9,#5)",
        "Dmaj9(#11,#5)",
        "F13(b9,#5)",
        "F13(#9,#5)",
        "F13(#11,#5)",
        "F#maj9(#11,#5)",
        "F#maj13(#11,#5)",
        "Gbmaj9(#11,#5)",
        "Gbmaj13(#11,#5)",
        "G13(b9,#5)",
        "Gmaj9(#11,#5)",
        "G#13(b9,b5)",
        "G#13(#9,b5)",
        "G#13(#9,#5)",
        "G#13(#11,b9)",
        "G#13(#11,#9)",
        "Ab13(b9,b5)",
        "Ab13(#9,b5)",
        "Ab13(#9,#5)",
        "Ab13(#11,b9)",
        "Ab13(#11,#9)",
        "A9(#11,#5)",
        "A7(#11,b9,#5)",
        "A7(#11,#9,#5)",
        "A13(b9,b5)",
        "A13(#9,b5)",
        "A13(#9,#5)",
        "A13(#11,#5)",
        "A13(#11,b9)",
        "A13(#11,#9)",
        "Amaj9(#11,#5)",
        "Amaj13(#11,#5)",
        "B9(#11,#5)",
        "B7(#11,b9,#5)",
        "B13(b9,b5)",
        "B13(#11,b9)",
        "Bmaj9(#11,#5)",
      ]
    `);
  }, 120_000);

  it("slash chords: a position, or a documented impossibility", () => {
    const { tally, impossible } = survey(SLASH_CHORDS);
    expect(tally).toMatchInlineSnapshot(`
      {
        "db": 61,
        "generated": 2457,
        "impossible": 2,
        "power": 0,
      }
    `);
    expect(impossible).toMatchInlineSnapshot(`
      [
        "Ab9/Eb",
        "G#9/B",
      ]
    `);
  }, 120_000);
});
