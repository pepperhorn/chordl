import { describe, it, expect } from "vitest";
import { CHORD_TYPES, ROOTS, spellChord } from "../../chordl-cards/src/catalogue";
import { Note } from "tonal";
import { resolveChord } from "@pepperhorn/chordl-core";

describe("resolveChord", () => {
  it("resolves Cmaj7 to [C, E, G, B]", () => {
    const result = resolveChord("Cmaj7");
    expect(result.notes).toEqual(["C", "E", "G", "B"]);
  });

  it("resolves C major triad to [C, E, G]", () => {
    const result = resolveChord("C");
    expect(result.notes).toEqual(["C", "E", "G"]);
  });

  it("resolves Cm first inversion to [Eb, G, C]", () => {
    const result = resolveChord("Cm", 1);
    expect(result.notes).toEqual(["Eb", "G", "C"]);
  });

  it("resolves Cmaj7#5 to [C, E, G#, B]", () => {
    const result = resolveChord("Cmaj7#5");
    expect(result.notes).toEqual(["C", "E", "G#", "B"]);
  });

  it("resolves Dm7 to [D, F, A, C]", () => {
    const result = resolveChord("Dm7");
    expect(result.notes).toEqual(["D", "F", "A", "C"]);
  });

  it("preserves natural flat spelling for flat-root chords", () => {
    const result = resolveChord("Bbmaj7");
    expect(result.notes).toEqual(["Bb", "D", "F", "A"]);
  });

  it("throws for unknown chords", () => {
    expect(() => resolveChord("Xmaj99")).toThrow("Unknown chord");
  });

  // Compound jazz chords (fallback resolver)
  it("resolves Dmaj7#5#11 via fallback", () => {
    const result = resolveChord("Dmaj7#5#11");
    expect(result.notes).toEqual(["D", "F#", "A#", "C#", "G#"]);
  });

  it("resolves D7#5#11 via fallback", () => {
    const result = resolveChord("D7#5#11");
    expect(result.notes).toEqual(["D", "F#", "A#", "C", "G#"]);
  });

  it("resolves Dm7#11 via fallback", () => {
    const result = resolveChord("Dm7#11");
    expect(result.notes).toEqual(["D", "F", "A", "C", "G#"]);
  });

  it("resolves Cmaj7#5#11 via fallback", () => {
    const result = resolveChord("Cmaj7#5#11");
    expect(result.notes).toEqual(["C", "E", "G#", "B", "F#"]);
  });

  it("still resolves standard chords directly", () => {
    const result = resolveChord("G7#9");
    expect(result.notes).toEqual(["G", "B", "D", "F", "A#"]);
  });
});

describe("chord types tonal leaves unnamed", () => {
  // tonal resolves these to real notes but gives them `type: ""`, because the
  // ChordType carries aliases and no name. An empty type tells a consumer
  // nothing, and `mapToVoicingQuality` reads this field to choose a voicing.
  it("names a chord from its canonical alias when tonal gives none", () => {
    expect(resolveChord("Cadd9").type).toBe("Madd9");
    expect(resolveChord("Cmadd9").type).toBe("madd9");
    expect(resolveChord("CM7b5").type).toBe("M7b5");
    expect(resolveChord("C6#11").type).toBe("M6#11");
  });

  it("leaves the notes and root exactly as they were", () => {
    expect(resolveChord("Cadd9").notes).toEqual(["C", "E", "G", "D"]);
    expect(resolveChord("Cadd9").root).toBe("C");
    expect(resolveChord("CM7b5").notes).toEqual(["C", "E", "Gb", "B"]);
  });

  it("does not touch the chords tonal does name", () => {
    expect(resolveChord("Cmaj7").type).toBe("major seventh");
    expect(resolveChord("C7").type).toBe("dominant seventh");
    expect(resolveChord("C5").type).toBe("fifth");
    expect(resolveChord("Csus2").type).toBe("suspended second");
  });

  it("spells the same chord the same way however it was written", () => {
    // add2, 2 and add9 are one chord; they must not resolve three ways.
    const t = resolveChord("Cadd9").type;
    expect(resolveChord("Cadd2").type).toBe(t);
    expect(resolveChord("C2").type).toBe(t);
  });
});

describe("resolveChord — intervals are populated on every branch", () => {
  // `mapToVoicingQuality` classifies chords by these intervals rather than by
  // the shape of `type`. Two of the three branches below used to leave them
  // undefined, which silently sent those chords back to being classified by
  // name — the mechanism this replaced.
  it("populates them on the tonal branch", () => {
    expect(resolveChord("Cmaj7").intervals).toEqual(["1P", "3M", "5P", "7M"]);
  });

  it("populates them for the hand-built chords tonal cannot parse", () => {
    // buildSpecialChord: tonal returns nothing at all for these three.
    expect(resolveChord("C7omit3").intervals).toEqual(["1P", "5P", "7m"]);
    expect(resolveChord("Cm7sus4").intervals).toEqual(["1P", "3m", "4P", "7m"]);
    expect(resolveChord("Cm6/9").intervals).toEqual(["1P", "3m", "5P", "6M", "9M"]);
  });

  it("populates them on the strip-and-reapply fallback", () => {
    // resolveWithFallback: the type it reports names only the base chord, so
    // the intervals are the only description of what was actually built.
    const resolved = resolveChord("Cm7b5b9");
    expect(resolved.intervals).toBeDefined();
    expect(resolved.intervals!.length).toBe(resolved.notes.length);
    // Every note the chord reports is described by an interval from the root.
    expect(resolved.intervals).toContain("2m");
  });

  it("does not rotate the intervals when the notes are inverted", () => {
    // Intervals describe the chord; notes describe the order it is voiced in.
    // A consumer classifying from a rotated notes array loses the root.
    const root = resolveChord("Cmaj7");
    const inverted = resolveChord("Cmaj7", 1);
    expect(inverted.notes).not.toEqual(root.notes);
    expect(inverted.intervals).toEqual(root.intervals);
  });
});

describe("resolveChord — bracketed extensions", () => {
  it.each([
    ["Bm7b5(b9)", [11, 2, 5, 9, 0]],
    ["G#dim7(b9)", [8, 11, 2, 5, 9]],
    ["Em7(b9)", [4, 7, 11, 2, 5]],
    ["A7(b9)", [9, 1, 4, 7, 10]],
  ])("resolves %s to the expected pitch classes", (symbol, pcs) => {
    const resolved = resolveChord(symbol);
    expect(resolved.notes.map((n) => Note.chroma(n))).toEqual(pcs);
    expect(resolved.intervals).toHaveLength(pcs.length);
  });

  it("resolves both new types on all 15 catalogue roots", () => {
    const roots = ["C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "Bb", "B"];
    for (const root of roots) {
      for (const [suffix, offsets] of [
        ["m7b5(b9)", [0, 3, 6, 10, 1]],
        ["dim7(b9)", [0, 3, 6, 9, 1]],
      ] as const) {
        expect(resolveChord(root + suffix).notes.map((n) => Note.chroma(n)), root + suffix)
          .toEqual(offsets.map((offset) => (Note.chroma(root)! + offset) % 12));
      }
    }
  });

  it.each([
    ["Cm7b5(b9)", "Cm7b5b9"], ["Cm7(b5,b9)", "Cm7b5b9"],
    ["Cdim7(b9)", "Cdim7b9"], ["Cm7(b9)", "Cm7b9"],
    ["C7(b9)", "C7b9"], ["C7(b9,#5)", "C7b9#5"],
  ])("resolves %s like %s", (bracketed, plain) => {
    expect(resolveChord(bracketed)).toEqual(resolveChord(plain));
  });

  it("rotates bracketed chords without changing their intervals", () => {
    const chord = resolveChord("Bm7b5(b9)");
    const inverted = resolveChord("Bm7b5(b9)", 1);
    expect(inverted.notes).toEqual([...chord.notes.slice(1), chord.notes[0]]);
    expect(inverted.intervals).toEqual(chord.intervals);
  });

  it.each(["Cm7(b9", "Cm7b9)", "Cm7(foo)", "Cm7(b9,,b5)"])("rejects malformed %s", (symbol) => {
    expect(() => resolveChord(symbol)).toThrow("Unknown chord");
  });
});

describe("bracket safety and catalogue parity", () => {
  it.each(["C(b5)", "C(#5)", "C(b9)", "C(#9)", "C(#11)", "C(b13)", "C(b5)/E"])(
    "rejects %s without changing the written root", (symbol) => {
      expect(() => resolveChord(symbol)).toThrow("Unknown chord");
    },
  );

  it.each([
    ["C7(b9,b5)", [0, 4, 6, 10, 1]],
    ["C7b9b5", [0, 4, 6, 10, 1]],
    ["C7(#9,b5)", [0, 4, 6, 10, 3]],
    ["C7#9b5", [0, 4, 6, 10, 3]],
    ["C13(b9,b5)", [0, 4, 6, 10, 1, 9]],
    ["C13b9b5", [0, 4, 6, 10, 1, 9]],
    ["C7(#11,b9,#5)", [0, 4, 8, 10, 6, 1]],
    ["C7#11b9#5", [0, 4, 8, 10, 6, 1]],
  ])("replaces the fifth in %s without relabelling it", (symbol, expected) => {
    const result = resolveChord(symbol);
    expect(result.notes.map((n) => Note.chroma(n)).sort()).toEqual([...expected].sort());
    expect(result.intervals).toContain(symbol.includes("#5") ? "5A" : "5d");
    expect(result.intervals).not.toContain("5P");
    if (!symbol.includes("#11")) expect(result.intervals).not.toContain("4A");
  });

  it("every bracketed catalogue spelling resolves correctly or explicitly throws", () => {
    const mismatches: string[] = [];
    const accepted = new Map<string, number>();
    const pcs = (notes: string[]) => notes.map((n) => Note.chroma(n)).sort((a, b) => a! - b!);
    for (const type of CHORD_TYPES) {
      for (const alias of new Set([type.symbol, type.displaySymbol, ...type.aliases].filter((s) => s.includes("(")))) {
        for (const root of ROOTS) {
          let actual;
          try { actual = resolveChord(root + alias); }
          catch (error) {
            expect(String(error)).toContain("Unknown chord");
            continue;
          }
          accepted.set(alias, (accepted.get(alias) ?? 0) + 1);
          if (JSON.stringify(pcs(actual.notes)) !== JSON.stringify(pcs(spellChord(root, type)))) {
            mismatches.push(root + alias + ": " + actual.notes.join(" "));
          }
          expect(Note.chroma(actual.root), root + alias).toBe(Note.chroma(root));
        }
      }
    }
    expect(mismatches).toEqual([]);
    for (const count of accepted.values()) expect(count).toBe(ROOTS.length);
    expect([...accepted.keys()].sort()).toMatchInlineSnapshot(`
      [
        "(add9)",
        "13(#11)",
        "13(#11,#5)",
        "13(#11,#9)",
        "13(#11,b9)",
        "13(#5)",
        "13(#9)",
        "13(#9,#5)",
        "13(#9,b5)",
        "13(b5)",
        "13(b9)",
        "13(b9,#5)",
        "13(b9,b5)",
        "6(add9)",
        "7(#11,#9)",
        "7(#11,#9,#5)",
        "7(#11,b9)",
        "7(#11,b9,#5)",
        "7(#5)",
        "7(#9)",
        "7(#9,#5)",
        "7(#9,b5)",
        "7(b5)",
        "7(b9)",
        "7(b9,#5)",
        "7(b9,b5)",
        "9(#11)",
        "9(#11,#5)",
        "9(#5)",
        "9(b5)",
        "dim7(b9)",
        "m(#5)",
        "m(add9)",
        "m(b5)",
        "m11(b5)",
        "m7(#5)",
        "m7(add11)",
        "m7(b5)",
        "m7(b5,b9)",
        "m7(b9)",
        "m7b5(b9)",
        "m9(#11)",
        "m9(#5)",
        "m9(b5)",
        "maj13(#11)",
        "maj13(#11,#5)",
        "maj7(#5)",
        "maj7(#9)",
        "maj7(b5)",
        "maj7(b9)",
        "maj9(#11)",
        "maj9(#11,#5)",
        "maj9(#5)",
        "maj9(b5)",
        "°7(b9)",
      ]
    `);
  });
});

describe("alteration fallback with slash bass", () => {
  it.each([
    ["Bm7b5(b9)/F", [5, 9, 0, 11, 2]],
    ["C7(b9,b5)/E", [4, 6, 10, 1, 0]],
    ["C7(#9,b5)/G", [7, 0, 4, 6, 10, 3]],
    ["Cdim7(b9)/Eb", [3, 6, 9, 1, 0]],
    ["Cm7(b9)/F#", [6, 0, 3, 7, 10, 1]],
  ])("resolves %s before applying its bass", (symbol, expected) => {
    const actual = resolveChord(symbol);
    expect(actual.notes.map((n) => Note.chroma(n))).toEqual(expected);
    expect(actual.root).toBe(symbol.startsWith("B") ? "B" : "C");
    expect(resolveChord(symbol, 1).notes).toEqual([...actual.notes.slice(1), actual.notes[0]]);
    expect(resolveChord(symbol, 1).intervals).toEqual(actual.intervals);
  });

  it.each(["Bm7b5(b9)", "Cm7b5b9", "Cm7(b5,b9)"])("retains half-diminished quality in %s", (symbol) => {
    expect(resolveChord(symbol).type).toBe("half-diminished (extended)");
    expect(resolveChord(symbol + "/F").type).toBe("half-diminished (extended)");
  });

  it("retains the first alteration's named quality", () => {
    expect(resolveChord("C7#11b9").type).toBe("lydian dominant seventh (extended)");
  });

  it("every bracketed catalogue alias with every slash bass is correct or throws", () => {
    const mismatches: string[] = [];
    const accepted = new Map<string, number>();
    const pcs = (notes: string[]) => [...new Set(notes.map((n) => Note.chroma(n)))].sort();
    for (const type of CHORD_TYPES) {
      for (const alias of new Set([type.symbol, type.displaySymbol, ...type.aliases].filter((s) => s.includes("(")))) {
        for (const root of ROOTS) {
          for (const bass of ROOTS) {
            const symbol = root + alias + "/" + bass;
            let actual;
            try { actual = resolveChord(symbol); }
            catch (error) {
              expect(String(error)).toContain("Unknown chord");
              continue;
            }
            accepted.set(alias, (accepted.get(alias) ?? 0) + 1);
            if (JSON.stringify(pcs(actual.notes)) !== JSON.stringify(pcs([...spellChord(root, type), bass]))) {
              mismatches.push(symbol + ": " + actual.notes.join(" "));
            }
            expect(Note.chroma(actual.notes[0]), symbol).toBe(Note.chroma(bass));
            expect(Note.chroma(actual.root), symbol).toBe(Note.chroma(root));
          }
        }
      }
    }
    expect(mismatches).toEqual([]);
    expect(accepted.size).toBe(55);
    for (const count of accepted.values()) expect(count).toBe(ROOTS.length ** 2);
  });
});
