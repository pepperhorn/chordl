import { describe, expect, it } from "vitest";
import {
  EXPERIENCE_LADDER,
  levelForFacts,
  levelForTop3,
  selectForExperience,
} from "../src/experience";
import { positionFacts } from "../src/voicingFacts";
import { INSTRUMENTS, lookupGuitarChord } from "../src";
import { TOP3_GENERATED } from "../src/top3Generated";
import { top3Window } from "../src/staticPresets";

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

  // The doc comment claims both accepted input forms — absolute frets at
  // position 1, and window-relative frets at the diagram's real position —
  // yield the same level. Derive both from a real generated row rather than
  // hand-writing numbers, so the test tracks the data instead of a story
  // about it.
  it("agrees between absolute and windowed input for a shape drawn off the nut", () => {
    const entry = TOP3_GENERATED.find((e) => top3Window(e.frets).position > 1);
    expect(entry, "no generated shape has a window off the nut").toBeDefined();
    const window = top3Window(entry!.frets);
    expect(window.position).toBeGreaterThan(1);
    expect(levelForTop3(window.frets, window.position)).toBe(
      levelForTop3(entry!.frets, 1),
    );
  });
});

const factsFor = (label: string) => {
  const res = lookupGuitarChord(label, "guitar")!;
  return res.positions.map((p) => positionFacts(p, guitar, 0));
};

describe("selectForExperience", () => {
  it("returns the matching shapes when the level has some", () => {
    const facts = factsFor("C");
    const sel = selectForExperience(facts, { level: "beginner" });
    expect(sel.indices.length).toBeGreaterThan(0);
    expect(sel.level).toBe("beginner");
    expect(sel.widenedFrom).toBeUndefined();
    for (const i of sel.indices) expect(facts[i].isOpenShape).toBe(true);
  });

  it("widens rather than returning nothing when a level is empty", () => {
    // F has no open shape in the corpus.
    const facts = factsFor("F");
    expect(facts.some((f) => f.isOpenShape)).toBe(false);
    const sel = selectForExperience(facts, { level: "beginner" });
    expect(sel.indices.length).toBeGreaterThan(0);
    expect(sel.widenedFrom).toBe("beginner");
    expect(sel.level).not.toBe("beginner");
  });

  it("drops the shape class BEFORE widening the level", () => {
    // Bm has no beginner (open) positions, so "open" is unsatisfiable at
    // every rung above beginner too — it *is* the beginner predicate
    // (isOpenShape). That makes this the case that tells the two relaxation
    // orders apart:
    //   - drop the class first, then widen: beginner+open empty, drop class,
    //     beginner (no class) still empty, widen to emerging (no class) ->
    //     emerging's real shapes.
    //   - widen first while keeping the class: beginner+open empty, widen to
    //     emerging+open empty, widen to established+open empty -> falls all
    //     the way through to the "return everything" fallback instead.
    // Those two outcomes have different index counts, so the count
    // discriminates the order even though both "succeed".
    const facts = factsFor("Bm");
    const emergingCount = facts.filter((f) => levelForFacts(f) === "emerging").length;
    expect(facts.some((f) => levelForFacts(f) === "beginner")).toBe(false);
    expect(emergingCount).toBeGreaterThan(0);
    expect(emergingCount).toBeLessThan(facts.length);

    const sel = selectForExperience(facts, { level: "beginner", shapeClass: "open" });
    expect(sel.indices.length).toBe(emergingCount);
    expect(sel.level).toBe("emerging");
    expect(sel.widenedFrom).toBe("beginner");
    expect(sel.droppedShapeClass).toBe(true);
  });

  it("never returns empty while any shape exists", () => {
    for (const label of ["C", "F", "Bm", "G", "Am", "E7"]) {
      const facts = factsFor(label);
      for (const level of EXPERIENCE_LADDER) {
        const sel = selectForExperience(facts, { level });
        expect(sel.indices.length, `${label} @ ${level}`).toBeGreaterThan(0);
      }
    }
  });

  it("returns an empty selection only for empty input", () => {
    const sel = selectForExperience([], { level: "beginner" });
    expect(sel.indices).toEqual([]);
  });
});
