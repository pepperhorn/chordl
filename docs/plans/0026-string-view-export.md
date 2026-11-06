# Plan 0026 — Export buttons on the string (guitar) view

- **Spec:** ../specs/0026-string-view-export.md
- **Base:** main @ 1914297
- **Verification (whole item):** `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site`

## Approach
Pull the zip button and its This/All menu out of `VoicingVariantToggle.tsx` into a small shared component (e.g. `components/ZipExportButton.tsx`) that takes an `onExport(mode)` callback. Use it in both views. In `GuitarChordPanel`, build `ZipVariant`s from the positions: the SVG comes from the panel's rendered frame, and the notes come from `positionToSoundingStrings(...).midi`. Extend `ZipVariant` / `addVariantToZip` (and `generateWav`, and `generateMidiFile` in core if needed) to accept exact MIDI numbers.

## Tasks

### T1 — string-view zip export (single task, K = 0026)
- **Depends on:** — (runs in parallel with 0025; the files are disjoint)
- **Route:** implement (alt), Claude Sonnet → reviewed by Codex. This spreads the load while Codex runs 0025.
- **Owns:** `packages/chordl-react/src/components/GuitarChordPanel.tsx`, `packages/chordl-react/src/components/VoicingVariantToggle.tsx`, the new `packages/chordl-react/src/components/ZipExportButton.tsx`, `packages/chordl-react/src/audio/zip-export.ts`, `packages/chordl-react/src/audio/wav-export.ts`, `packages/chordl-core/src/audio/midi-export.ts`, the new `packages/chordl-react/test/GuitarChordPanel.export.test.tsx`, existing zip/midi tests if extended
- **Do not touch:** `CHANGELOG.md` and `packages/chordl-board/**` (0025 owns them; the lead adds the changelog line at merge)
- **Acceptance:** AC1–AC6
- **Verify:** whole-item command above
- **Notes / gotchas:**
  - With several frames on screen, `chordOutputRef.current?.querySelector("svg")` grabs the first SVG. Scope the query to the frame you mean.
  - If you change `generateMidiFile`, it's a public chordl-core export: make the change additive.
  - Port if you run the dev server: 5200 + 26*10 = 5460, with `--host 0.0.0.0`.

## Merge order
Independent of 0025.

## Risks
- PNG rasterisation of frames that use web fonts. Reuse `prepareExportClone`, which the keyboard view already relies on.
