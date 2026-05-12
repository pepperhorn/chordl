# @better-chord/render-cli

Batch-render keyboard chord SVGs server-side using the same React components that power the web app — so output matches the live UI exactly.

## Install

From repo root:

```bash
pnpm install
pnpm --filter @better-chord/react build
```

## Use

```bash
pnpm --filter @better-chord/render-cli render manifests/example.json
# or with explicit out dir
pnpm --filter @better-chord/render-cli render manifests/example.json --out ./dist-svgs
```

## Manifest format

```json
{
  "outDir": "./out",
  "defaultPreset": "app-color",
  "entries": [
    { "chord": "Cmaj7" },
    { "chord": "Dm7", "preset": "print-bw" },
    { "chord": "G7", "highlightColor": "#e63946", "filename": "g7-red" }
  ]
}
```

Merge precedence (lowest to highest):
1. `defaultPreset`
2. entry-level `preset`
3. inline overrides on the entry

## Presets

Edit `src/presets.ts`. Bundled: `app-color`, `app-dark`, `print-bw`, `crf-brand`.

## Bulk generation

```ts
import { expandCombinations } from "@better-chord/render-cli/manifest";

const entries = expandCombinations({
  roots: ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"],
  qualities: ["maj7", "m7", "7", "dim7", "m7b5"],
  presets: ["app-color", "print-bw"],
});
```

12 × 5 × 2 = 120 SVGs in one run.
