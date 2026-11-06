# Handoff: 0026 — Export buttons on the string view (claude → lead)

- **Date:** 2026-11-06
- **Type:** return
- **Ledger:** 0026 · **Spec:** docs/specs/0026-string-view-export.md · **Plan:** docs/plans/0026-string-view-export.md (task T1)
- **Branch:** orch/0026-string-view-export · **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-18df5969
- **PR:** see PR body / lead (draft against main)
- **Base commit:** 20cd029
- **Status:** closed

## Return
- **Outcome:** done, with one AC1 caveat (below)
- **Commits:** 20cd029..HEAD (ack, refactor + helpers, feature + tests)
- **What changed:**
  - New `ZipExportButton.tsx`: the .zip button + This/All menu, lifted verbatim (markup, styles, class names, title) from `VoicingVariantToggle`, which now uses it. Keyboard zip contents/names unchanged.
  - `generateMidiFile` (core): additive `midiNotes?: number[]` option; written as-is in order, ignoring `notes`/`octave`. Existing callers unaffected.
  - `generateWav`: accepts `Array<string|number>`; numbers are exact MIDI pitches, sorted low→high; names behave as before.
  - `ZipVariant.midiNotes?` drives MIDI + both WAVs when set.
  - `GuitarChordPanel`: shows the button (with `showControls`) in the position row, even when there is only one position. **This** reads the SVG from the displayed frame (scoped to a `.bc-guitar-frame` wrapper, not the first SVG in the panel). **All** mounts hidden off-screen `GuitarChord`s (same component/settings/fret window via shared `fretWindowFor`) for every position visible at the current level, waits (bounded, 3 s) for svguitar to draw, exports, unmounts. Folders `A_fret N`, `B_fret M`, … MIDI/WAV use `positionToSoundingStrings(...).midi`.
  - Tests: `GuitarChordPanel.export.test.tsx` (real JSZip contents + real MIDI note-ons; guitar open C = 48 52 55 60 64; ukulele C = 67 60 64 72; This after switching position; All folder/file set; absent on board cards), `zip-export.midi-notes.test.ts` (MIDI parity with named input; WAV passes sorted numbers to smplr via fake OfflineAudioContext). Only `generateWav` is mocked in the panel test (no OfflineAudioContext in jsdom); the WAV call args are asserted.
- **Verification output:** `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site` all pass (25 files / 330 tests; site built).
- **Decisions made:**
  - Button shows whenever the panel has a shape and `showControls`; board cards (`showControls` false) get none, matching how the position toggle already behaves.
  - **AC1 caveat:** bass4, bass5 and violin currently return "No … shape found" (no chords-db library), so the panel renders its notice and there is nothing to export; no button is shown there. The button appears for guitar, guitar-top3 and ukulele, and would appear for the others the moment they gain shapes. Tests cover guitar, guitar-top3, ukulele.
  - Folder label is `fret <baseFret>` (the panel's own position caption) rather than a chord-voicing name.
  - PNG/SVG for hidden frames come from a fresh draw, so they show no playback highlight; the "This" SVG is the live frame (would include a playback highlight if exported mid-playback).
  - jsdom test shims (viewBox, TextEncoder realm, Blob.arrayBuffer, Image/canvas) are local to the new test file.
- **Out-of-scope issues found:** none.
- **Follow-ups:** header "Preparing .zip…" animation for the string view (needs BoardEditor.tsx prop, after 0025); CHANGELOG line (lead); instrument timbre in WAVs.
- GBrain: unavailable (not used).
