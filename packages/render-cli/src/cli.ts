#!/usr/bin/env node
// Defensive stubs — PianoKeyboard's transitive imports reference browser globals
// at module load even though the values aren't constructed during SSR.
const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.AudioContext === "undefined") g.AudioContext = class {};
if (typeof g.window === "undefined") g.window = {};

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import type { Manifest } from "./manifest.js";
import { renderChordSvg, resolveEntryProps, defaultFilename } from "./render.js";

function parseArgs(argv: string[]): { manifest: string; outDir?: string } {
  const args: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" || a === "-o") args.out = argv[++i];
    else if (a === "--manifest" || a === "-m") args.manifest = argv[++i];
    else if (a.startsWith("--")) args[a.slice(2)] = argv[++i] ?? "true";
    else positional.push(a);
  }
  const manifest = args.manifest ?? positional[0];
  if (!manifest) {
    console.error("Usage: chordl-render <manifest.json> [--out dir]");
    process.exit(1);
  }
  return { manifest, outDir: args.out };
}

function main() {
  const { manifest: manifestPath, outDir: outDirOverride } = parseArgs(
    process.argv.slice(2)
  );
  const absManifest = resolve(process.cwd(), manifestPath);
  const manifest: Manifest = JSON.parse(readFileSync(absManifest, "utf8"));
  const manifestDir = dirname(absManifest);
  const outDir = resolve(
    manifestDir,
    outDirOverride ?? manifest.outDir ?? "./out"
  );
  mkdirSync(outDir, { recursive: true });

  let ok = 0;
  let failed = 0;
  for (const entry of manifest.entries) {
    try {
      const props = resolveEntryProps(entry, manifest.defaultPreset);
      const svg = renderChordSvg(props);
      const name = entry.filename ?? defaultFilename(entry);
      writeFileSync(join(outDir, `${name}.svg`), svg, "utf8");
      ok++;
    } catch (err) {
      failed++;
      console.error(`✗ ${entry.chord}:`, (err as Error).message);
    }
  }
  console.log(`Rendered ${ok} SVGs to ${outDir}${failed ? ` (${failed} failed)` : ""}`);
}

main();
