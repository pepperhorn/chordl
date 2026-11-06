# 0026 — Export buttons on the string (guitar) view

- **Status:** approved
- **Ledger:** 0026 · **Plan:** ../plans/0026-string-view-export.md
- **Author:** lead · **Date:** 2026-11-06

## Problem
In the board editor, the keyboard view (`VoicingVariantToggle`) has a **.zip** export button with a This/All menu. The zip holds `<chord>.svg`, `.png`, `.mid`, `_chord.wav` and `_arpeggio.wav` (`packages/chordl-react/src/audio/zip-export.ts`). The string view (`GuitarChordPanel`, used for guitar, ukulele, bass and violin) has no export controls at all, so users can't get an image, MIDI or audio of a fretted shape.

## Goals
1. `GuitarChordPanel` gets the same .zip button and This/All menu, with the same look, placement relative to the variant pills, class names, and title.
2. **This** exports the displayed position. **All** exports every position the panel offers at the current level, one subfolder each (`A_<label>`, `B_<label>`, …), matching `exportAllZip`.
3. Each export contains SVG + PNG of the frame as rendered, plus MIDI and both WAVs of the **sounding pitches** of that shape. Those are the actual strings and octaves, including the ukulele's re-entrant tuning, not note names collapsed into one octave.

## Non-goals
- The header "Preparing .zip…" animation for the string view. It needs a prop threaded through `BoardEditor.tsx`, which 0025 owns, and that's a follow-up.
- Instrument timbre in the WAVs. Keep the existing WAV renderer; matching pitches is enough.
- New file types.

## Constraints
- Reuse `zip-export.ts`, `svg-export.ts`'s `prepareExportClone`, and `downloadBlob`. Don't fork them. If the MIDI/WAV helpers only take note names, extend them so they also accept exact MIDI numbers, and keep the existing call sites' behaviour.
- Keep the keyboard view's zip output byte-for-byte unchanged in what it contains (same files, same names).
- Follow the house style: contextual class names on elements (e.g. `zip-export-container`, as the keyboard view uses).

## Acceptance criteria
- [ ] AC1: the string view shows a .zip button with a This/All menu for every instrument (guitar, ukulele, bass4, bass5, violin).
- [ ] AC2: **This** downloads a zip with `.svg`, `.png`, `.mid`, `_chord.wav` and `_arpeggio.wav` for the displayed position, and the SVG is the frame as shown.
- [ ] AC3: **All** downloads one subfolder per available position.
- [ ] AC4: the MIDI notes equal the shape's sounding MIDI numbers (`positionToSoundingStrings`). This is tested for a guitar shape and a ukulele re-entrant shape (e.g. ukulele C: G4 C4 E4 C5).
- [ ] AC5: the existing keyboard zip tests and behaviour are unchanged.
- [ ] AC6: `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site` passes.

## Open questions
None.
