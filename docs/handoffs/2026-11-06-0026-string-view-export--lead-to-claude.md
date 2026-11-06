# Handoff: 0026 — Export buttons on the string view (lead → claude)

- **Date:** 2026-11-06
- **Type:** dispatch
- **Ledger:** 0026 · **Spec:** docs/specs/0026-string-view-export.md · **Plan:** docs/plans/0026-string-view-export.md (task T1, single task)
- **Branch:** orch/0026-string-view-export · **Worktree:** created by T3
- **PR:** (open as a draft)
- **Base commit:** 1914297
- **Port (if running a server):** 5460
- **Status:** open

## Goal
The string view (`GuitarChordPanel`) gets the same .zip export (This/All) as the keyboard view. Each zip has SVG, PNG, MIDI and two WAVs, and the MIDI/WAV use the shape's real sounding pitches.

## Context you need
- The spec: docs/specs/0026-string-view-export.md. The plan, with approach and gotchas: docs/plans/0026-string-view-export.md
- Keyboard implementation: `packages/chordl-react/src/components/VoicingVariantToggle.tsx`, with `handleZipExport` around line 289 and the button and menu around 431–510.
- Zip contents: `packages/chordl-react/src/audio/zip-export.ts` (`addVariantToZip`). WAV: `audio/wav-export.ts` (`generateWav(notes, mode, octave?)`). MIDI: `packages/chordl-core/src/audio/midi-export.ts` (`generateMidiFile`).
- Sounding pitches: `GuitarChordPanel.tsx` around line 390 (`positionToSoundingStrings`, `soundingMidis`).

## Scope
- **In:** the shared zip button, the string-view export, MIDI-number support in the helpers, and tests.
- **Out:** the header export animation for the string view (it needs BoardEditor.tsx, which 0025 owns), instrument timbre in WAVs, and CHANGELOG.md.
- **Files you own:** see the plan's T1 **Owns** list, plus your own 0026 handoff files.
- **Do not touch:** `CHANGELOG.md`, `packages/chordl-board/**`, `packages/chordl-core/src/parser/**`, `packages/chordl-core/src/types.ts` (another implementer is working there right now).

## Acceptance criteria
- [ ] AC1–AC6 from the spec.

## Verify with
```bash
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
- The human reported that the string view lacks the keyboard's export buttons (img, midi, etc.). Parity is the goal: match the keyboard UI, don't redesign it.
- `build:site` type-checks `dev/` (PR #96). Keep it passing.
- Lesson from earlier work in this repo: mocked wrappers can certify inert code. Test the real zip contents (JSZip can read the blob back) and the real MIDI note numbers, not just that a mock was called.
- GBrain: nothing specific found.

## Open questions
None.

---
## Receiver ack

---
## Return (implementer → lead; fill in when done, or in a separate …-to-lead.md)
