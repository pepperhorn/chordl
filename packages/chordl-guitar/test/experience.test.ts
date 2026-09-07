import { describe, expect, it } from "vitest";
import { EXPERIENCE_LADDER, levelForFacts } from "../src/experience";
import { positionFacts } from "../src/voicingFacts";
import { INSTRUMENTS, lookupGuitarChord } from "../src";

const guitar = INSTRUMENTS.guitar.openMidi;

describe("levelForFacts", () => {
  it("ranks an open C as beginner", () => {
    const c = lookupGuitarChord("C", "guitar")!;
    // X32010 — barre-free and at the nut.
    const facts = positionFacts(c.positions[0], guitar, 0);
    expect(facts.isOpenShape).toBe(true);
    expect(levelForFacts(facts)).toBe("beginner");
  });

  it("ranks a barre F as established", () => {
    const f = lookupGuitarChord("F", "guitar")!;
    const barre = f.positions.find((p) => p.barres.length > 0)!;
    expect(levelForFacts(positionFacts(barre, guitar, 5))).toBe("established");
  });

  it("ranks a barre-free shape away from the nut as emerging", () => {
    const e = lookupGuitarChord("E", "guitar")!;
    const moved = e.positions.find(
      (p) => p.barres.length === 0 && p.baseFret > 1,
    )!;
    expect(levelForFacts(positionFacts(moved, guitar, 2))).toBe("emerging");
  });

  it("orders the ladder easiest first", () => {
    expect(EXPERIENCE_LADDER).toEqual(["beginner", "emerging", "established"]);
  });

  // Derived, not tabulated: assert against the facts across the whole corpus
  // rather than restating a list that can drift from the data.
  it("agrees with the facts for every stored guitar position", () => {
    for (const label of ["C", "G", "Am", "F", "Bm", "E7", "Dm7"]) {
      const res = lookupGuitarChord(label, "guitar")!;
      for (const pos of res.positions) {
        const facts = positionFacts(pos, guitar, 0);
        const level = levelForFacts(facts);
        if (facts.isOpenShape) expect(level).toBe("beginner");
        else if (!facts.hasBarre) expect(level).toBe("emerging");
        else expect(level).toBe("established");
      }
    }
  });
});
