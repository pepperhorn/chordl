import { describe, it, expect } from "vitest";
import { levelForVoicing, isCoreQuality } from "../src/experience.js";

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
});
