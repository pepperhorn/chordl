import { describe, it, expect } from "vitest";
import { readdirSync, statSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : [];
  });

const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)"([^"]+)"/g;

/** "@scope/pkg/sub" -> "@scope/pkg"; "pkg/sub" -> "pkg". */
const packageOf = (spec: string) =>
  spec.split("/").slice(0, spec.startsWith("@") ? 2 : 1).join("/");

/**
 * vite.config.ts externalises exactly what the manifest declares as a runtime
 * dependency. Anything else src imports gets silently inlined into the bundle
 * instead — no build error, no CI signal, and consumers go back to shipping two
 * copies of it. smplr is a devDependency here only so tests can mock the copy
 * chordl-react loads; a direct import of it from src would inline it.
 */
describe("bundle externals", () => {
  it("every package src imports is a declared runtime dependency", () => {
    const declared = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ]);
    const offenders: string[] = [];
    for (const file of walk(src)) {
      for (const [, spec] of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
        if (spec.startsWith(".") || spec.startsWith("node:")) continue;
        const name = packageOf(spec);
        if (!declared.has(name)) {
          offenders.push(`${file.slice(src.length + 1)}: "${spec}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("the model entry", () => {
  it("imports nothing React or node: — print loads it outside a browser", () => {
    const model = ["model.ts", "hands.ts", "keyboard-window.ts", "faces.ts", "playback.ts", "names.ts", "theme.ts", "accidentals.ts", "poppins-metrics.ts"];
    const offenders: string[] = [];
    for (const name of model) {
      for (const [, spec] of readFileSync(join(src, name), "utf8").matchAll(SPECIFIER)) {
        if (spec.startsWith("node:") || spec === "react" || spec.startsWith("react/") || spec === "@pepperhorn/chordl-react") {
          offenders.push(`${name}: "${spec}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
