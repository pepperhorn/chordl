import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
// @ts-expect-error - .mjs build script, no types
import { renderTop3Source } from "../scripts/build-top3.mjs";

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
