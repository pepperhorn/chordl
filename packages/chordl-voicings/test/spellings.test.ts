import { describe, it, expect } from "vitest";
import { spellingsFor } from "../src/spellings.js";

describe("spellingsFor", () => {
  it("names every rotation of a symmetric chord", () => {
    // C-E-G# is equally E-G#-C and Ab-C-E. All three are in the beginner set,
    // so a learner meets genuine spelling ambiguity early.
    const names = spellingsFor(["C", "E", "G#"]);
    expect(names).toHaveLength(3);
    expect(names).toEqual(expect.arrayContaining(["Caug", "Eaug", "G#aug"]));
  });

  it("names all four spellings of a diminished seventh", () => {
    expect(spellingsFor(["C", "D#", "F#", "A"])).toHaveLength(4);
  });

  it("returns exactly one name for an unambiguous chord", () => {
    expect(spellingsFor(["C", "E", "G"])).toEqual(["C"]);
  });

  it("returns nothing it cannot name", () => {
    expect(spellingsFor(["C", "C#"])).toEqual([]);
  });

  it("drops an unparseable name rather than letting it through as a false pitch class", () => {
    // Note.chroma returns NaN, not null/undefined, for a name it cannot
    // parse — a `!= null` filter does not catch NaN. This pins that the
    // implementation actually excludes it, using a real major triad plus one
    // garbage entry.
    expect(spellingsFor(["C", "E", "G", "Nonsense"])).toEqual(["C"]);
  });
});
