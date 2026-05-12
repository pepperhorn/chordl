# CRF Presets

CRF (Creative Ranges Foundation) color spec and the render-cli presets that use it.

## Pitch palette

Source of truth: `packages/core/src/themes/crf.ts` → `CRF_PITCH_PALETTE`.

| Note | Hex | CMYK (C/M/Y/K) |
|------|-----|----------------|
| C    | `#f86e6e` | 0 / 56 / 56 / 3 |
| C# / Db | `#f58841` | 0 / 44 / 73 / 4 |
| D    | `#ffbc57` | 0 / 26 / 66 / 0 |
| D# / Eb | `#b8a334` | 0 / 11 / 72 / 28 |
| E    | `#fff56d` | 0 / 4 / 57 / 0 |
| F    | `#b3f888` | 28 / 0 / 45 / 3 |
| F# / Gb | `#93d154` | 30 / 0 / 60 / 18 |
| G    | `#6bc6a0` | 46 / 0 / 19 / 22 |
| G# / Ab | `#7ee8df` | 46 / 0 / 4 / 9 |
| A    | `#88a7f8` | 45 / 33 / 0 / 3 |
| A# / Bb | `#cc97e8` | 12 / 35 / 0 / 9 |
| B    | `#e277b1` | 0 / 47 / 22 / 11 |

Hex values render to screen; CMYK is the print spec. The hex values are derived from the CMYK reference, so on-screen output matches print intent (subject to monitor calibration).

## Render-cli presets using CRF

Defined in `packages/render-cli/src/presets.ts`.

### `crf-brand`

Plain CRF theme — caller supplies all other options (padding, note names, format) per entry.

```ts
{
  theme: "crf",
  uiTheme: "light",
  scale: 1,
  showNoteNames: true,
}
```

### `chord-cards`

Full chord-card preset for print/app graphics. Uses `chordTemplate` so manifest entries stay terse — write `{ "chord": "Cmaj7" }` and the preset expands the natural-language modifiers automatically.

```ts
{
  theme: "crf",
  uiTheme: "light",
  chordTemplate: "full {chord} with 2 notes either side with note names 2xl",
}
```

Expands each chord to: `full {chord} with 2 notes either side with note names 2xl`

Which the chord parser interprets as:
- `full` → `format: "exact"` (full key heights)
- `with 2 notes either side` → `padding: 2` (2 unhighlighted keys flanking the chord)
- `with note names 2xl` → `showNoteNames: true`, `noteNameSize: "2xl"`

## Usage

```bash
# Render the bundled chord-cards manifest
pnpm --filter @pepperhorn/render-cli render manifests/chord-cards.json

# Or write your own manifest using the preset
{
  "outDir": "./out",
  "defaultPreset": "chord-cards",
  "entries": [
    { "chord": "C" },
    { "chord": "Dm7" },
    { "chord": "G7" }
  ]
}
```

Override any field per-entry — e.g. swap to `print-bw` for one chord, or pin a custom `highlightColor`. Merge order: `defaultPreset` < entry `preset` < entry-level inline overrides.

## Importing the palette directly

For Directus uploaders, print pipelines, or design-tool exports, import the palette from core:

```ts
import { CRF_PITCH_PALETTE, formatCmyk } from "@pepperhorn/core";

CRF_PITCH_PALETTE.C;
// → { hex: "#f86e6e", cmyk: [0, 56, 56, 3] }

formatCmyk(CRF_PITCH_PALETTE.C.cmyk);
// → "cmyk(0%, 56%, 56%, 3%)"
```
