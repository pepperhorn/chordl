import { describe, it, expect } from "vitest";
import { VOICING_LIBRARY } from "../src/library.js";
import { levelForVoicing } from "../src/experience.js";

describe("the library under the experience rule", () => {
  it("has a stable rung distribution", () => {
    const counts = { beginner: 0, emerging: 0, established: 0 };
    for (const e of VOICING_LIBRARY) counts[levelForVoicing(e.intervals)]++;
    // Pinned so a change to CORE_TEMPLATES or the emerging rule has to be
    // deliberate. Update these numbers WITH a reason, never to make a run green.
    expect(counts.beginner + counts.emerging + counts.established).toBe(VOICING_LIBRARY.length);
    expect(counts).toMatchInlineSnapshot(`
      {
        "beginner": 2,
        "emerging": 40,
        "established": 31,
      }
    `);
  });

  it("leaves most qualities with no beginner voicing, which is the answer", () => {
    const beginnerQualities = new Set(
      VOICING_LIBRARY.filter((e) => levelForVoicing(e.intervals) === "beginner")
        .map((e) => e.quality),
    );
    // m7b5, dim7, 6/9, m6/9, alt, maj7b5 and the adds are not chords a
    // beginner plays. Empty is correct; relaxation covers the request.
    expect(beginnerQualities.has("alt")).toBe(false);
    expect(beginnerQualities.has("m7b5")).toBe(false);
    expect(beginnerQualities.has("6/9")).toBe(false);
  });
});
