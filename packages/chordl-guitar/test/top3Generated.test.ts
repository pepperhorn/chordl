import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// @ts-expect-error - .mjs build script, no types
import { renderTop3Source, DIAGRAM_FRETS } from "../scripts/build-top3.mjs";
import { INSTRUMENTS } from "../src/instruments";
import { EXPERIENCE_LADDER, levelForTop3 } from "../src/experience";
import { TOP3_GENERATED } from "../src/top3Generated";
import { GUITAR_TOP3_PRESETS } from "../src/staticPresets";

const TABLE_PATH = fileURLToPath(new URL("../src/top3Generated.ts", import.meta.url));

/**
 * The table is checked in as source so a shape change shows up in a diff. That
 * only holds if the file and the generator cannot drift apart.
 */
describe("top3Generated regeneration", () => {
  it("reproduces the checked-in table byte for byte", () => {
    expect(renderTop3Source()).toBe(readFileSync(TABLE_PATH, "utf8"));
  });
});

/**
 * The generator decides which shapes are eligible by how many frets a diagram
 * draws; `staticPresets.top3Window` decides where to draw them by the same
 * number, read from the instrument config. The script cannot import the config
 * — it is plain ESM, the config is TypeScript — so the two are pinned here.
 */
describe("diagram window", () => {
  it("is the same number in the generator and the instrument config", () => {
    expect(DIAGRAM_FRETS).toBe(INSTRUMENTS["guitar-top3"].frets);
  });
});

describe("experience level on the generated table", () => {
  it("gives every entry exactly one level from the ladder", () => {
    for (const e of TOP3_GENERATED) {
      expect(EXPERIENCE_LADDER, `${e.key}${e.suffix}`).toContain(e.level);
    }
  });

  it("carries the level through to the presets", () => {
    for (const p of GUITAR_TOP3_PRESETS) {
      expect(EXPERIENCE_LADDER, `${p.key}${p.suffix}`).toContain(p.level);
    }
  });

  it("puts the open shapes at the beginner rung", () => {
    const openC = TOP3_GENERATED.find((e) => e.key === "C" && e.suffix === "major")!;
    expect(openC.frets).toEqual([0, 1, 0]);
    expect(openC.level).toBe("beginner");
  });

  it("the generator's ranking agrees with the library's", () => {
    for (const e of TOP3_GENERATED) {
      const relative = e.frets.map((f) => (f > 0 ? f : f));
      expect(levelForTop3(relative, e.position ?? 1), `${e.key}${e.suffix}`)
        .toBe(e.level);
    }
  });
});
