import { describe, expect, it } from "vitest";
import { EXPERIENCE_LADDER, levelForFacts, levelForTop3 } from "../src/experience";
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

describe("levelForTop3", () => {
  it("calls an open, one-finger shape beginner", () => {
    // Open C on G-B-E: [0,1,0] at the nut, one finger, two open strings.
    expect(levelForTop3([0, 1, 0], 1)).toBe("beginner");
  });

  it("calls a nut-position three-finger shape emerging", () => {
    // D major [2,3,2] — no open strings, but still first position.
    expect(levelForTop3([2, 3, 2], 1)).toBe("emerging");
  });

  it("calls a shape up the neck established", () => {
    // Fmaj7 sits at the 10th fret.
    expect(levelForTop3([1, 1, 3], 10)).toBe("established");
  });

  it("never returns a level outside the ladder", () => {
    for (const p of [1, 3, 5, 7, 10, 12]) {
      for (const f of [[0, 0, 0], [1, 1, 1], [1, 3, 2], [0, 2, 4]]) {
        expect(EXPERIENCE_LADDER).toContain(levelForTop3(f, p));
      }
    }
  });
});
