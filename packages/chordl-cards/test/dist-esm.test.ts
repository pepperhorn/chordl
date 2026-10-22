// The built package must load as plain Node ESM: a relative import without an
// extension ("./hands") breaks every Node/Vite SSR consumer (the chords site).
// Runs scripts/check-dist.mjs against dist/ when a build is present.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const built = existsSync(resolve(root, "dist/model.js"));

describe("built dist", () => {
  it.skipIf(!built)("has no extensionless relative imports and its entries load in Node", () => {
    const out = execFileSync("node", ["scripts/check-dist.mjs"], { cwd: root, encoding: "utf8" });
    expect(out).toMatch(/dist\/ ok/);
  });
});
