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
  // C1/C2 from the whole-branch review: exclusive bucketing (level === query)
  // hid easier shapes behind a harder default, and made top-3's default
  // "established" query miss most of the corpus. Cumulative matching (level
  // <= query) is the fix the user chose: a level answers "can I play this
  // yet", so "established" — the top rung — must include everything easier,
  // not just shapes exactly at that rung.
  it("matches cumulatively: a level includes every easier rung, not just its own", () => {
    // E7 has one stored shape at each rung, plus a second established one.
    const facts = factsFor("E7");
    const levels = facts.map((f) => levelForFacts(f));
    expect(levels).toEqual(["beginner", "emerging", "established", "established"]);

    const beginner = selectForExperience(facts, { level: "beginner" });
    expect(beginner.indices).toEqual([0]);
    expect(beginner.widenedFrom).toBeUndefined();

    const emerging = selectForExperience(facts, { level: "emerging" });
    expect(emerging.indices).toEqual([0, 1]);
    expect(emerging.widenedFrom).toBeUndefined();

    const established = selectForExperience(facts, { level: "established" });
    expect(established.indices).toEqual([0, 1, 2, 3]);
    expect(established.widenedFrom).toBeUndefined();
  });

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

  // NOTE on this test's original intent: under the old EXCLUSIVE matching,
  // this case told apart "drop class, then widen" from "widen while keeping
  // the class" by their differing index counts (see git history for the
  // worked-through trace). Under CUMULATIVE matching that discrimination is
  // no longer just untested but *provably impossible to observe*: every
  // ShapeClass predicate (`open` = levelIdx<=0, `no-barre` = levelIdx<=1,
  // `any` = levelIdx<=2) is itself a cumulative level-prefix, so intersecting
  // it with a cumulative level threshold commutes — "drop class then widen"
  // and "widen while keeping class, then drop" reach the identical (level,
  // indices) for every possible facts distribution. Order between those two
  // steps is no longer an observable choice at all, so no test can (or
  // should try to) discriminate it.
  //
  // What's still real, and what this test now guards: an implementation that
  // never drops the class at all (keeps applying it through every widen step
  // and only reports "everything" as a last resort) diverges from one that
  // does — the "never drop" mutant matches this codebase's actual bug shape
  // more closely and IS caught below (mutation-verified).
  it("drops the shape class when widening finds none that keep it", () => {
    // Bm has no beginner (open) positions, so "open" is unsatisfiable at
    // every rung — it *is* the beginner predicate (isOpenShape), and nothing
    // in the corpus for Bm is open. Widening while still requiring "open"
    // would stay empty all the way to the top rung; dropping the class and
    // widening on level alone finds the real emerging shapes instead.
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

  // Top-3 shapes never carry barres, so `levelForFacts` can never call one
  // "established" no matter how far up the neck it sits — Cm's top-3 preset
  // is a real example: stored level "established" (levelForTop3, off the
  // nut), derived level "emerging" (positionFacts: no barre, not at the nut).
  // A caller holding the authoritative stored level must be able to make it
  // win outright, not just influence the derived one.
  //
  // Under cumulative matching an "established" query can no longer
  // discriminate here — established matches every level, so this shape would
  // match whether the level used is the derived "emerging" or the stored
  // "established". Querying at "emerging" instead is what tells them apart:
  // cumulative emerging matches beginner+emerging but NOT established, so
  // using the derived level wrongly lets this shape through an emerging
  // query (it reads as emerging), while the authoritative stored level
  // correctly excludes it and widens up to established instead. That
  // divergence — a query answering "can a beginner-to-emerging player play
  // this" wrongly including an established-only shape — is exactly the bug
  // threading `levels` through exists to prevent.
  it("uses a supplied level verbatim instead of re-deriving it", () => {
    const cm = lookupGuitarChord("Cm", "guitar-top3")!;
    expect(cm.levels).toEqual(["established"]);
    const facts = cm.positions.map((p) => positionFacts(p, guitar, 0));
    // Confirm the mismatch is real: derived from facts alone, this position
    // is "emerging", not "established" — otherwise the test would prove
    // nothing about which one selectForExperience actually used.
    expect(levelForFacts(facts[0])).toBe("emerging");

    // Without supplied levels: derives "emerging", so an "emerging" query
    // (cumulative: beginner+emerging) wrongly matches it directly.
    const derived = selectForExperience(facts, { level: "emerging" });
    expect(derived.indices).toEqual([0]);
    expect(derived.level).toBe("emerging");
    expect(derived.widenedFrom).toBeUndefined();

    // With supplied levels: the stored "established" is used as-is, so the
    // same emerging query correctly fails to match (established is above
    // emerging on the ladder) and widens up to established instead.
    const supplied = selectForExperience(facts, { level: "emerging" }, cm.levels);
    expect(supplied.indices).toEqual([0]);
    expect(supplied.level).toBe("established");
    expect(supplied.widenedFrom).toBe("emerging");
  });

  it("falls back to the derived level for an index the supplied array omits", () => {
    const facts = factsFor("C");
    // A shorter/sparse levels array: index 0 has no supplied entry, so it
    // must fall back to levelForFacts rather than being treated as unmatched.
    const sel = selectForExperience(facts, { level: "beginner" }, []);
    expect(sel.indices.length).toBeGreaterThan(0);
    for (const i of sel.indices) expect(facts[i].isOpenShape).toBe(true);
  });
});
