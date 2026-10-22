import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHORD_TYPES, ROOTS, SHEET_ERRATA, chordTypeById, parseChordSymbol, spellChord,
} from "../src/catalogue";
import { qualityLabelFor } from "../src/names";
import { explodedVoicing } from "../src/hands";
import { requestFor } from "../src/faces";
import { loadTheme } from "./theme-fixture";

interface SheetEntry {
  bar: number;
  symbol: string;
  aliases: string[];
  spelling: string[];
  slash?: boolean;
}
const SHEET: { entries: SheetEntry[] } = JSON.parse(
  readFileSync(join(__dirname, "..", "catalogue", "sheet-transcription.json"), "utf8"),
);
const NON_SLASH = SHEET.entries.filter((e) => !e.slash);

describe("the sheet transcription", () => {
  it("has 89 bars: 85 chord types and 4 slash examples", () => {
    expect(SHEET.entries).toHaveLength(89);
    expect(NON_SLASH).toHaveLength(85);
    expect(SHEET.entries.filter((e) => e.slash).map((e) => e.symbol))
      .toEqual(["B♭/C", "D7/C", "F(add9)/C", "A♭maj7/C"]);
  });

  it("maps every non-slash bar to exactly one catalogue type", () => {
    const bars = CHORD_TYPES.flatMap((t) => (t.sheet ? [t.sheet.bar] : []));
    expect(bars.sort((a, b) => a - b)).toEqual(NON_SLASH.map((e) => e.bar));
  });

  it("the sheet symbol and its 'or' aliases all parse to that type", () => {
    for (const e of NON_SLASH) {
      const type = CHORD_TYPES.find((t) => t.sheet?.bar === e.bar)!;
      for (const s of [e.symbol, ...e.aliases]) {
        expect(parseChordSymbol(s), `bar ${e.bar} "${s}"`).toEqual({ root: "C", type });
      }
    }
  });

  it("cSpelling is the sheet's spelling, except the listed errata", () => {
    for (const e of NON_SLASH) {
      const type = CHORD_TYPES.find((t) => t.sheet?.bar === e.bar)!;
      const erratum = SHEET_ERRATA.find((x) => x.bar === e.bar);
      if (erratum) {
        expect(e.spelling, `bar ${e.bar}`).toEqual(erratum.printed);
        expect(type.cSpelling).toEqual(erratum.corrected);
      } else {
        expect(type.cSpelling, `bar ${e.bar} ${e.symbol}`).toEqual(e.spelling);
      }
    }
    expect(SHEET_ERRATA.map((x) => x.bar)).toEqual([55, 62]);
  });
});

describe("CHORD_TYPES", () => {
  it("is the 85 sheet types plus the library's diminished triad", () => {
    expect(CHORD_TYPES).toHaveLength(86);
    expect(CHORD_TYPES.filter((t) => !t.sheet).map((t) => t.id)).toEqual(["dim"]);
  });

  it("every interval set spells to cSpelling on C", () => {
    for (const t of CHORD_TYPES) expect(spellChord("C", t), t.id).toEqual(t.cSpelling);
  });

  it("ids, symbols and slug modifiers are unique; chordTypeById finds each", () => {
    const ids = CHORD_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(CHORD_TYPES.map((t) => t.symbol)).size).toBe(ids.length);
    expect(new Set(CHORD_TYPES.map((t) => t.slugModifiers.join("-"))).size).toBe(ids.length);
    for (const t of CHORD_TYPES) expect(chordTypeById(t.id)).toBe(t);
    expect(chordTypeById("nope")).toBeUndefined();
    expect(chordTypeById("toString")).toBeUndefined();
  });

  it("symbols and labels are ASCII; full names are lower-case words", () => {
    for (const t of CHORD_TYPES) {
      expect(t.symbol, t.id).toMatch(/^[\x20-\x7e]*$/);
      expect(t.label, t.id).toMatch(/^[\x21-\x7e]+$/);
      expect(t.fullName, t.id).toMatch(/^[a-z][a-z -]*[a-z]$/);
      expect(t.slugModifiers.join("-"), t.id).toMatch(/^([a-z0-9]+(-[a-z0-9]+)*)?$/);
    }
  });

  it("displaySymbol uses the web glyphs", () => {
    const d = (id: string) => chordTypeById(id)!.displaySymbol;
    expect(d("aug")).toBe("+");
    expect(d("dim7")).toBe("°7");
    expect(d("half-dim7")).toBe("ø7");
    expect(d("7-flat9-sharp5")).toBe("7(♭9,♯5)");
    expect(d("m-sharp5")).toBe("m+");
    for (const t of CHORD_TYPES) expect(t.displaySymbol, t.id).not.toMatch(/[#]|b\d/);
  });

  it("labels match qualityLabelFor for every quality the library already has", () => {
    const withQuality = CHORD_TYPES.filter((t) => t.quality !== undefined);
    expect(withQuality.map((t) => t.quality).sort()).toEqual(
      ["", "6", "7", "7#5", "add9", "aug", "dim", "dim7", "m", "m6", "m7", "m7b5",
        "mMaj7", "maj7", "maj7#5", "sus2", "sus4"].sort(),
    );
    for (const t of withQuality) expect(t.label, t.id).toBe(qualityLabelFor(`C${t.quality}`));
  });

  it("matches the task's worked example", () => {
    const t = parseChordSymbol("C7(♭9/♯5)")!.type;
    expect(t.symbol).toBe("7(b9,#5)");
    expect(t.intervals).toEqual(["1", "3", "#5", "b7", "b9"]);
    expect(t.fullName).toBe("dominant seventh flat nine sharp five");
    expect(t.label).toBe("7b9#5");
  });
});

describe("faces", () => {
  const theme = loadTheme();
  it("keyboard and guitar are on for every type", () => {
    for (const t of CHORD_TYPES) expect(t.faces.keyboard && t.faces.guitar, t.id).toBe(true);
  });

  it("keyboard-hands is on exactly where the hands face can voice the chord today", () => {
    for (const t of CHORD_TYPES) {
      const supported = t.quality !== undefined && explodedVoicing(`C${t.quality}`) !== undefined;
      expect(t.faces["keyboard-hands"], t.id).toBe(supported);
    }
  });

  it("guitar-top3 is on exactly where the top-3 face renders today", () => {
    for (const t of CHORD_TYPES) {
      let ok = t.quality !== undefined;
      if (ok) {
        try { requestFor(`C${t.quality}`, "guitar-top3", theme); } catch { ok = false; }
      }
      expect(t.faces["guitar-top3"], t.id).toBe(ok);
    }
    expect(CHORD_TYPES.filter((t) => t.faces["guitar-top3"]).map((t) => t.id).sort())
      .toEqual(["7", "m", "m7", "maj", "maj7"]);
  });
});

describe("parseChordSymbol", () => {
  const id = (s: string) => parseChordSymbol(s)?.type.id;

  it("round-trips every canonical symbol, display symbol and alias on every root", () => {
    for (const root of ROOTS) {
      for (const t of CHORD_TYPES) {
        for (const s of [t.symbol, t.displaySymbol, ...t.aliases]) {
          expect(parseChordSymbol(root + s), `${root}${s}`).toEqual({ root, type: t });
        }
      }
    }
  });

  it("no alias belongs to two types", () => {
    const seen = new Map<string, string>();
    for (const t of CHORD_TYPES) {
      for (const s of [t.symbol, t.displaySymbol, ...t.aliases]) {
        const owner = parseChordSymbol(`C${s}`)!.type.id;
        expect(owner, `"${s}" listed on ${t.id}`).toBe(t.id);
        seen.set(s, owner);
      }
    }
  });

  it("accepts the Directus chord_name forms", () => {
    expect(id("C dim")).toBe("dim");
    expect(id("Cdim")).toBe("dim");
    expect(id("Cm7b5")).toBe("m7-flat5");
    expect(id("CmMaj7")).toBe("m-maj7");
    expect(id("C7#5")).toBe("7-sharp5");
    expect(id("Cmaj7#5")).toBe("maj7-sharp5");
    expect(id("Abm7b5")).toBe("m7-flat5");
    expect(parseChordSymbol("Abm7b5")!.root).toBe("Ab");
    expect(parseChordSymbol("C#sus4")!.root).toBe("C#");
  });

  it("reads the sheet's ° as the diminished seventh, as the sheet spells it", () => {
    expect(id("C°")).toBe("dim7");
    expect(id("Co")).toBe("dim7");
    expect(id("Cø7")).toBe("half-dim7");
    expect(id("Cm7(b5)")).toBe("m7-flat5");
  });

  it("reads unicode accidentals and a slash bass", () => {
    expect(parseChordSymbol("B♭/C")).toEqual({ root: "Bb", type: chordTypeById("maj"), bass: "C" });
    expect(parseChordSymbol("F(add9)/C")).toEqual({ root: "F", type: chordTypeById("add9"), bass: "C" });
    expect(parseChordSymbol("A♭maj7/C")).toEqual({ root: "Ab", type: chordTypeById("maj7"), bass: "C" });
    expect(parseChordSymbol("D7/C")?.bass).toBe("C");
    expect(parseChordSymbol("C6/9")).toEqual({ root: "C", type: chordTypeById("6-9") });
    expect(parseChordSymbol("C7(b9/b5)")?.bass).toBeUndefined();
  });

  it("returns undefined for what is not a chord", () => {
    for (const s of ["", "H7", "D#(tmp-test)", "Cfoo", "Ctostring", "CtoString", "C/H"]) {
      expect(parseChordSymbol(s), s).toBeUndefined();
    }
  });
});

describe("spellChord", () => {
  const NAME = /^[A-G](bb|b|##|#)?$/;
  it("spells every type on every root with letters stepwise, at most double accidentals", () => {
    let doubles = 0;
    const doubleChords: string[] = [];
    for (const root of ROOTS) {
      for (const t of CHORD_TYPES) {
        const notes = spellChord(root, t);
        expect(notes).toHaveLength(t.intervals.length);
        for (const n of notes) expect(n, `${root}${t.symbol}`).toMatch(NAME);
        const d = notes.filter((n) => /bb|##/.test(n)).length;
        if (d) { doubles += d; doubleChords.push(`${root}${t.symbol}`); }
      }
    }
    // Pinned so a change to the interval tables shows up here; see the report.
    expect({ doubles, chords: doubleChords.length }).toMatchInlineSnapshot(`
      {
        "chords": 272,
        "doubles": 326,
      }
    `);
  });

  it("uses the interval's letter and accidental", () => {
    expect(spellChord("C", "dim7")).toEqual(["C", "Eb", "Gb", "A"]);
    expect(spellChord("Db", "dim7")).toEqual(["Db", "Fb", "Abb", "Bb"]);
    expect(spellChord("G#", "aug")).toEqual(["G#", "B#", "D##"]);
    expect(spellChord("F#", "7-sharp9")).toEqual(["F#", "A#", "C#", "E", "G##"]);
    expect(spellChord("Gb", "m")).toEqual(["Gb", "Bbb", "Db"]);
    expect(spellChord("Bb", "13-sharp11")).toEqual(["Bb", "D", "F", "Ab", "C", "E", "G"]);
  });

  it("throws on an unknown type or root", () => {
    expect(() => spellChord("C", "nope")).toThrow(/unknown chord type/);
    expect(() => spellChord("H", "maj")).toThrow(/root/);
  });
});
