import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHORD_TYPES, ROOTS, chordTypeById, parseChordSymbol } from "../src/catalogue";
import {
  SLASH_INTERVALS, SLASH_UPPER_TYPES, slashChordsForBass,
} from "../src/slash";
import { rootSlug, slugFor } from "../src/slug";

const ALL_SLASH = ROOTS.flatMap((bass) => slashChordsForBass(bass));

describe("slash chords", () => {
  it("12 intervals x 15 upper types per bass; #4/b5 twins collapse: 2,520 distinct", () => {
    expect(SLASH_INTERVALS).toEqual(["b2", "2", "b3", "3", "4", "#4", "b5", "5", "b6", "6", "b7", "7"]);
    expect(SLASH_UPPER_TYPES.map((id) => chordTypeById(id)!.label)).toEqual([
      "maj", "min", "6", "7", "maj7", "min7", "m7b5", "add9", "min6", "aug", "dim",
      "sus4", "dim7", "minMaj7", "9",
    ]);
    // Only C, D and G keep #4 and b5 apart (F#/Gb, G#/Ab, C#/Db over them).
    for (const bass of ROOTS) {
      expect(slashChordsForBass(bass), bass).toHaveLength(["C", "D", "G"].includes(bass) ? 180 : 165);
    }
    expect(ALL_SLASH).toHaveLength(15 * 12 * 15 - 12 * 15);
    expect(new Set(ALL_SLASH.map((c) => c.symbol)).size).toBe(ALL_SLASH.length);
  });

  it("every upper root is one of the 15 roots", () => {
    for (const c of ALL_SLASH) expect(ROOTS, c.symbol).toContain(c.upperRoot);
  });

  it("spells the upper root by interval, respelling outside the root set", () => {
    const over = (bass: string, iv: string) =>
      slashChordsForBass(bass).find((c) => c.interval === iv && c.upperType === "maj")!;
    expect(over("C", "b2").upperRoot).toBe("Db");
    expect(over("C", "#4").upperRoot).toBe("F#");
    expect(over("C", "b5").upperRoot).toBe("Gb");
    expect(over("Gb", "b2")).toMatchObject({ spelledRoot: "Abb", upperRoot: "G", respelled: true });
    // Over E, #4 (A#) needs respelling and b5 (Bb) does not: b5 is kept, A# is its alias.
    expect(over("E", "#4")).toBeUndefined();
    expect(over("E", "b5")).toMatchObject({ upperRoot: "Bb", respelled: false, aliases: ["A#/E"] });
    // Over F, #4 (B) is in the set and b5 (Cb) is not: #4 is kept.
    expect(over("F", "#4")).toMatchObject({ upperRoot: "B", aliases: ["Cb/F"] });
    expect(over("F", "b5")).toBeUndefined();
    // Over C both spellings are roots: two chords, no aliases.
    expect(over("C", "#4").aliases).toEqual([]);
    expect(over("C", "6")).toMatchObject({ spelledRoot: "A", upperRoot: "A", respelled: false });
    const respelled = ALL_SLASH.filter((c) => c.respelled).length;
    expect(respelled).toMatchInlineSnapshot(`450`);
  });

  it("contains the sheet's four examples", () => {
    const c = ALL_SLASH.filter((x) => x.bass === "C");
    const find = (sym: string) => {
      const p = parseChordSymbol(sym)!;
      return c.find((x) => x.upperRoot === p.root && x.upperType === p.type.id && x.bass === p.bass);
    };
    expect(find("B♭/C")).toMatchObject({ symbol: "Bb/C", interval: "b7" });
    expect(find("D7/C")).toMatchObject({ symbol: "D7/C", interval: "2" });
    expect(find("F(add9)/C")).toMatchObject({ symbol: "Fadd9/C", interval: "4" });
    expect(find("A♭maj7/C")).toMatchObject({ symbol: "Abmaj7/C", interval: "b6" });
  });

  it("symbols parse back to the same chord", () => {
    for (const c of ALL_SLASH) {
      expect(parseChordSymbol(c.symbol), c.symbol)
        .toEqual({ root: c.upperRoot, type: chordTypeById(c.upperType), bass: c.bass });
    }
  });

  it("every collapsed twin carries the other spelling as an alias", () => {
    const withAlias = ALL_SLASH.filter((c) => c.aliases.length);
    expect(withAlias).toHaveLength(12 * 15);
    for (const c of withAlias) {
      expect(["#4", "b5"]).toContain(c.interval);
      expect(c.aliases[0]).toMatch(new RegExp(`/${c.bass}$`));
      expect(c.aliases[0]).not.toBe(c.symbol);
    }
  });
});

describe("slugFor", () => {
  it("follows the spec's examples", () => {
    expect(slugFor("C13(#11)")).toBe("c-13-sharp11");
    expect(slugFor("Cmaj9(#11/#5)")).toBe("c-maj9-sharp11-sharp5");
    expect(slugFor("C7(b9/b5)")).toBe("c-7-flat9-flat5");
    expect(slugFor("Cm(maj7)")).toBe("c-m-maj7");
    expect(slugFor("B♭/C")).toBe("b-flat-over-c");
    expect(slugFor("D7/C")).toBe("d-7-over-c");
    expect(slugFor("F(add9)/C")).toBe("f-add9-over-c");
    expect(slugFor("A♭maj7/C")).toBe("a-flat-maj7-over-c");
    expect(slugFor({ root: "F#", type: "m7-flat5" })).toBe("f-sharp-m7-flat5");
    expect(slugFor({ root: "Db", type: chordTypeById("maj")!, bass: "Gb" })).toBe("d-flat-over-g-flat");
    expect(rootSlug("C#")).toBe("c-sharp");
  });

  it("throws on what it cannot name", () => {
    expect(() => slugFor("Cfoo")).toThrow(/unknown chord/);
    expect(() => slugFor({ root: "C", type: "nope" })).toThrow(/unknown chord type/);
  });

  it("is unique across 15 roots x every type and every distinct slash chord", () => {
    const slugs = new Map<string, string>();
    const add = (slug: string, what: string) => {
      const prev = slugs.get(slug);
      expect(prev, `${slug}: ${what} and ${prev}`).toBeUndefined();
      slugs.set(slug, what);
    };
    for (const root of ROOTS) for (const t of CHORD_TYPES) add(slugFor({ root, type: t }), root + t.symbol);
    for (const c of ALL_SLASH) {
      expect(c.slug).toBe(slugFor({ root: c.upperRoot, type: c.upperType, bass: c.bass }));
      expect(c.slug).toBe([rootSlug(c.upperRoot), ...c.slugModifiers].join("-"));
      add(c.slug, c.symbol);
    }
    expect(slugs.size).toBe(15 * CHORD_TYPES.length + ALL_SLASH.length);
  });

  it("agrees with every slug already applied in Directus (crf-admin chords)", () => {
    const { chords } = JSON.parse(
      readFileSync(join(__dirname, "fixtures", "directus-slugs.json"), "utf8"),
    ) as { chords: { chord_name: string; slug: string }[] };
    const mismatches: string[] = [];
    const unparsed: string[] = [];
    for (const c of chords) {
      if (!parseChordSymbol(c.chord_name)) { unparsed.push(c.chord_name); continue; }
      const mine = slugFor(c.chord_name);
      if (mine !== c.slug) mismatches.push(`${c.chord_name}: directus ${c.slug}, slugFor ${mine}`);
    }
    expect(chords).toHaveLength(212);
    expect(mismatches).toEqual([]);
    // The archived test record; not a chord.
    expect(unparsed).toEqual(["D#(tmp-test)"]);
  });
});
