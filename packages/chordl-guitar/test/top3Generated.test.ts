import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// @ts-expect-error - .mjs build script, no types
import { renderTop3Source, DIAGRAM_FRETS } from "../scripts/build-top3.mjs";
import { INSTRUMENTS } from "../src/instruments";

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
