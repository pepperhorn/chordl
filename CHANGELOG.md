# Changelog

## 0.3.3 — 2026-05-21

### Added

- **Parser: many more ways to define two-hand note strings.** `parseChordDescription` now accepts:
  - Hand-prefix without "notes": `lh: Eb Gb Bb rh: Db Eb F Gb` (colon optional)
  - Long-form hand words: `left ... right ...`, `bottom ... top ...`, `bass ... treble ...`
  - Polychord `//` separator (top over bottom = rh over lh): `Eb Gb Bb // Db Eb F Gb`
  - Semicolon separator (reading order = lh then rh): `Eb Gb Bb; Db Eb F Gb`
  - Parens + hand suffix: `(Eb Gb Bb) lh (Db Eb F Gb) rh`
  - Bare suffix without "in": `Eb Gb Bb lh, Db Eb F Gb rh`

### Fixed

- **chord-resolver tests** updated to reflect the resolver's actual (and intentional) flat-spelling behavior — `Cm` first inversion is `[Eb, G, C]` and `Bbmaj7` resolves to `[Bb, D, F, A]`. Forcing flats→sharps would mangle display, so the tests were wrong, not the code.

## 0.3.2 — 2026-05-21

### Added

- **Parser: `notes in <hand> <notes>` prefix form.** `parseChordDescription` now accepts inputs like `notes in lh Eb Gb Bb notes in rh Db Eb F Gb` and emits the expected `notesGroups` with correct hand assignments. The existing suffix form (`notes C E G in lh`) is unchanged.

### Changed

- **Dev playground:** Chord Details panel restyled — white background at 40% opacity with a light-blue glow shadow — and the summary now reads "Choose more chord details".

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
