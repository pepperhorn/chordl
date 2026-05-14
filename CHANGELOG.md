# Changelog

## 0.3.1 — 2026-05-14

### Added

- **Bundled SMuFL fonts.** `@pepperhorn/chordl-react` now embeds 6-codepoint subsets of Bravura and Petaluma (~7.5KB total) and auto-injects `@font-face` rules at module load. Consumers no longer need to host woff2 files or declare `@font-face` themselves.
- Font families renamed to `PHBravura` / `PHPetaluma` per the OFL Reserved Font Name clause; `fontFamily` stacks fall back to `Bravura` / `Petaluma` so consumers who provide the full fonts still override the bundled subset.
- OFL.txt shipped alongside the package.

## 0.3.0 — 2026-05-14

### Breaking

- **Renamed packages** with a `chordl-` prefix to make room for other `@pepperhorn/*` product lines:
  - `@pepperhorn/voicings` → `@pepperhorn/chordl-voicings`
  - `@pepperhorn/core` → `@pepperhorn/chordl-core`
  - `@pepperhorn/react` → `@pepperhorn/chordl-react`

  The old packages are deprecated on npm and point to the new names. Update imports accordingly.

## 0.2.0 — 2026-05-12

### Breaking

- **Renamed packages** to the `@pepperhorn` scope:
  - `@better-chord/voicings` → `@pepperhorn/voicings`
  - `@better-chord/core` → `@pepperhorn/core`
  - `@better-chord/react` → `@pepperhorn/react`

  Update any imports in your application accordingly.

### Added

- New types exported from `@pepperhorn/react`: `VariationContext`, `RenderVariationExtras`, `OnVariation`.
- New optional props on `PianoChord`, `VoicingVariantToggle`, `ChordGroup`, `ProgressionView`, and `ChordSheet`:
  - `onVariation?: (ctx: VariationContext) => void` — fires post-render once per `(chord, voicing)` cell. Use it to capture rendered notes + SVG markup.
  - `renderVariationExtras?: (ctx: VariationContext) => ReactNode` — render arbitrary children (rating UI, debug overlays, etc.) alongside each variation cell.

  Both props are fully backwards compatible — when absent, behavior is unchanged.

- First publish to public npm under the `@pepperhorn` scope.
