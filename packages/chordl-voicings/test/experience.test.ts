import { describe, it, expect } from "vitest";
import { levelForVoicing, isCoreQuality } from "../src/experience.js";
import { VOICING_LIBRARY } from "../src/library.js";
import { generateVariants } from "../src/variant-generator.js";

describe("isCoreQuality", () => {
  it("recognises the core set and its inversions", () => {
    expect(isCoreQuality([0, 4, 7])).toBe(true);        // major triad
    expect(isCoreQuality([4, 7, 12])).toBe(true);       // 1st inversion, same set
    expect(isCoreQuality([0, 3, 7])).toBe(true);        // minor
    expect(isCoreQuality([0, 3, 6])).toBe(true);        // diminished
    expect(isCoreQuality([0, 4, 8])).toBe(true);        // augmented
    expect(isCoreQuality([0, 4, 7, 11])).toBe(true);    // maj7
    expect(isCoreQuality([0, 4, 7, 10])).toBe(true);    // dom7
    expect(isCoreQuality([0, 2, 7])).toBe(true);        // sus2
    expect(isCoreQuality([0, 5, 7])).toBe(true);        // sus4
    expect(isCoreQuality([0, 7])).toBe(true);           // power chord
  });

  it("rejects everything outside it", () => {
    expect(isCoreQuality([0, 3, 7, 10])).toBe(false);   // min7 — deliberately not core
    expect(isCoreQuality([0, 3, 6, 10])).toBe(false);   // m7b5
    expect(isCoreQuality([4, 10, 15, 20])).toBe(false); // rootless alt
  });
});

describe("levelForVoicing", () => {
  it("ranks a core triad and every inversion beginner", () => {
    expect(levelForVoicing([0, 4, 7])).toBe("beginner");
    expect(levelForVoicing([4, 7, 12])).toBe("beginner");
    expect(levelForVoicing([7, 12, 16])).toBe("beginner");
  });

  it("ranks every inversion of a core seventh beginner", () => {
    expect(levelForVoicing([0, 4, 7, 11])).toBe("beginner");  // span 11, at the bound
    expect(levelForVoicing([4, 7, 11, 12])).toBe("beginner");
    expect(levelForVoicing([7, 11, 12, 16])).toBe("beginner");
    expect(levelForVoicing([11, 12, 16, 19])).toBe("beginner");
  });

  it("rejects a core quality spread past a major 7th", () => {
    // Same pitch classes as a maj7, but spread — the hand cannot hold it.
    expect(levelForVoicing([0, 7, 16, 23])).not.toBe("beginner");
  });

  it("rejects a fifth note even inside the span bound", () => {
    expect(levelForVoicing([0, 2, 4, 7, 11])).not.toBe("beginner");
  });

  it("ranks a non-core quality above beginner however easy it is to play", () => {
    // A rootless Type A min7: four close notes any hand can play, and not a
    // beginner's chord. This is the case that makes the rule a hybrid.
    expect(levelForVoicing([3, 7, 10, 14])).toBe("emerging");
  });

  it("treats an octave doubling as free, not as a tension", () => {
    // spread-madd9: the 15 is its own b3 an octave up, not a #9.
    expect(levelForVoicing([0, 7, 14, 15])).toBe("emerging");
  });

  it("puts a genuine alteration at established", () => {
    expect(levelForVoicing([0, 4, 10, 15])).toBe("established");  // #9 over a dom7
    expect(levelForVoicing([4, 10, 21, 25, 28])).toBe("established");
  });

  it("gives the power chord a beginner voicing", () => {
    const shell = VOICING_LIBRARY.find((e) => e.id === "power-5-shell");
    expect(shell).toBeDefined();
    expect(shell!.intervals).toEqual([0, 7]);
    expect(levelForVoicing(shell!.intervals)).toBe("beginner");
  });

  it("cannot make a three-note power chord beginner", () => {
    // Structural, not a choice: [0,7,12] spans exactly 12, one past the bound.
    expect(levelForVoicing([0, 7, 12])).not.toBe("beginner");
  });
});

describe("generateVariants attaches a level to library-sourced variants", () => {
  // Spec's Testing item 3: "a library entry ranks on its `intervals`, an
  // inversion variant on its stacked pitch classes." Nothing exercised the
  // library side of that split — deleting both `level:
  // levelForVoicing(entry.intervals)` assignments in variant-generator.ts
  // (the slot-A path and the by-style-loop path) left every existing test
  // green, because an unranked variant falls back to "established" in
  // `selectVoicingsForExperience` and the pill counts happened to match.
  // These two assertions each depend on one of those two call sites, so
  // deleting either one breaks a `.level` here from a concrete rung to
  // `undefined`.
  it("carries a level, computed from the entry's declared intervals, on both the slot-A and by-style library paths", () => {
    // styleHint "Shell" puts shell-dom7-r7 in slot A (variant-generator.ts:112)
    // and leaves shell-dom7-r3 — same style, so it fills the "Shell" slot in
    // the by-style loop (variant-generator.ts:169) since only the exact
    // slot-A id is excluded from that loop, not its whole style.
    const variants = generateVariants("C", "dom7", ["C", "E", "G", "Bb"], 9, {
      styleHint: "Shell",
    });

    const slotA = variants.find((v) => v.id === "shell-dom7-r7");
    const byStyle = variants.find((v) => v.id === "shell-dom7-r3");
    expect(slotA).toBeDefined();
    expect(byStyle).toBeDefined();

    const slotAEntry = VOICING_LIBRARY.find((e) => e.id === "shell-dom7-r7")!;
    const byStyleEntry = VOICING_LIBRARY.find((e) => e.id === "shell-dom7-r3")!;
    expect(slotA!.level).toBe(levelForVoicing(slotAEntry.intervals));
    expect(byStyle!.level).toBe(levelForVoicing(byStyleEntry.intervals));
  });

  it("ranks shell-maj7-tenth on its declared tenth, not the span its two pitch classes would draw restacked", () => {
    // shell-maj7-tenth is unreachable through generateVariants itself: the
    // one-per-style dedup in the by-style loop always keeps shell-maj7-r7,
    // the first "Shell"-style maj7 entry in the library. So test
    // levelForVoicing directly on the entry — exactly what generateVariants
    // calls it on for every library-sourced variant, per its own comment at
    // variant-generator.ts:110-112.
    //
    // Its declared interval is [0, 16] — a root and a tenth. Reduced to bare
    // pitch classes and restacked the way an inversion variant is (see
    // `voicingOctaveOffsets`'s comment on this same entry), the two notes
    // collapse to [0, 4] — root to a major third a full octave lower. Both
    // happen to land on "emerging" here — neither is a core triad/seventh
    // shape, so the beginner span bound never comes into play for either —
    // but the value actually passed is the declared one, not the
    // restacked one, and that is what the wiring test above pins.
    const entry = VOICING_LIBRARY.find((e) => e.id === "shell-maj7-tenth")!;
    expect(entry.intervals).toEqual([0, 16]);
    expect(levelForVoicing(entry.intervals)).toBe("emerging");
  });
});

describe("generateVariants inversions rank by the letter-stacked span they draw", () => {
  it("ranks a C#maj7 inversion by its drawn span, not its pitch-walk span", () => {
    // C#maj7 resolves to C# F G# C — its major third (E#) is spelled F, and
    // its major seventh (C##) is spelled C, so both the 2nd and 3rd
    // resolvedNotes carry a letter that repeats on the way up (C then C#, F
    // then... this inversion in particular starts on F and ends the octave
    // on C then C#, both letter repeats). A pitch-only walk bumps the octave
    // only when the pitch itself fails to rise, so it never notices the
    // repeated letters and stacks this inversion into a single octave: pitch
    // offsets [4, 7, 11, 12], span 8 — "beginner". The renderer, which
    // stacks by letter, actually draws F4 G#4 C5 C#6 — offsets [4, 7, 11,
    // 24], span 20, because the letter "C" repeats twice (F->G# is fine, but
    // G#->C and C->C# both fail to advance the letter and each bumps an
    // octave). This is the regression #57-shaped fix in `semitonesFromStack`
    // is pinned against: rank by the drawn span, not the pitch-walk span.
    const variants = generateVariants("C#", "maj7", ["C#", "F", "G#", "C"], 4);
    const firstInversion = variants.find((v) => v.id === "inv-1");
    expect(firstInversion).toBeDefined();
    expect(firstInversion!.notes).toEqual(["F", "G#", "C", "C#"]);
    // Not "beginner": the drawn span is 20, well past the beginner bound of 11.
    expect(firstInversion!.level).not.toBe("beginner");
    expect(firstInversion!.level).toBe("emerging");
  });
});
