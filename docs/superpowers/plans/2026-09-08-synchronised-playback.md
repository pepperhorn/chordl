# Synchronised Piano and Frame Playback — Implementation Plan

**Goal:** Make piano and guitar playback visibly follow the performed notes, expose persisted tempo/colour settings, and preserve exact playable voicings for a future playback-only display.

**Architecture:** `chordl-core` owns portable playback fields and fallback validation. `chordl-react` owns a cancellable Web Audio timeline shared by piano and guitar renderers. Piano keys consume active note indices; guitar frames render a transient per-string overlay above svguitar. `chordl-board` persists the resolved playback snapshot in schema v3 while continuing to render static cards.

**Tech Stack:** TypeScript, React 19, Vitest 4, Web Audio API, smplr 0.18.1, svguitar 2.5.x.

**Spec:** `docs/superpowers/specs/2026-09-08-synchronised-playback-design.md`

## Constraints

- Worktree: `/home/shaun/chordl-playback-animation`, branch `feat/synchronised-playback`.
- Preserve the original checkout's uncommitted files; all edits happen in the worktree.
- Audio and visuals must consume one precomputed schedule.
- Visual timing follows `AudioContext.currentTime`, not smplr's early `onStart` notification.
- Guitar arrays are low→high in chords-db order; only svguitar presentation reverses string numbering.
- Board cards stay static and continue passing `showPlayback={false}`.
- Use bundled `electric_guitar_clean`; add no raw-SF2 parser or artifact asset.
- Repo style: double quotes, two-space indentation, additive public APIs.

## Task 1: Portable playback schema

**Files:**
- Modify `packages/chordl-core/src/types.ts`
- Modify `packages/chordl-core/src/chord-sheet/defaults.ts`
- Modify `packages/chordl-core/src/index.ts`
- Test `packages/chordl-core/test/chord-sheet-defaults.test.ts`
- Test `packages/chordl-core/test/chord-sheet-codec.test.ts`

- [ ] Add `PlaybackInstrument`, BPM bounds/defaults, colour validation, and the four playback fields.
- [ ] Resolve tempo and active colour through chord/section/sheet/system defaults.
- [ ] Round-trip exact ordered MIDI pitches and instrument in chord-sheet tokens.
- [ ] Pin invalid-value fallback at the import/public resolution boundary.

## Task 2: Shared playback timeline

**Files:**
- Rewrite `packages/chordl-react/src/audio/playback.ts`
- Add `packages/chordl-react/src/audio/usePlaybackTimeline.ts`
- Test `packages/chordl-react/test/playback.test.ts`

- [ ] Define scheduled events and a cancellable playback controller.
- [ ] Cache one AudioContext and lazy instrument instances for piano and clean electric guitar.
- [ ] Schedule block/arpeggio notes and drive active attacks from the Web Audio clock.
- [ ] Stop voices and animation on replay, cancellation, error and unmount.
- [ ] Keep compatibility wrappers for the exported `playBlock` and `playArpeggiated` functions.

## Task 3: Piano active paint and controls

**Files:**
- Modify `packages/chordl-react/src/components/PlaybackControls.tsx`
- Modify `packages/chordl-react/src/components/PianoKeyboard.tsx`
- Modify `packages/chordl-react/src/components/PianoChord.tsx`
- Modify `packages/chordl-react/src/components/ChordGroup.tsx`
- Modify `packages/chordl-react/src/types.ts`
- Modify `packages/chordl-react/src/index.ts`
- Test `packages/chordl-react/test/PlaybackControls.test.tsx`
- Test `packages/chordl-react/test/PianoKeyboard.playback.test.tsx`

- [ ] Lift active timeline state far enough up that keys and buttons consume the same run.
- [ ] Map each scheduled note back to a specific rendered key, including duplicate pitch classes and split hands.
- [ ] Add a transient SVG overlay/class that preserves base chord paint.
- [ ] Expose tempo, active colour and exact playback snapshot callbacks.
- [ ] Keep MIDI/SVG/PNG/Dottl actions unchanged.

## Task 4: Guitar playback and per-string highlighting

**Files:**
- Modify `packages/chordl-guitar/src/pitch.ts`
- Modify `packages/chordl-guitar/src/index.ts`
- Modify `packages/chordl-react/src/components/GuitarChord.tsx`
- Modify `packages/chordl-react/src/components/GuitarChordPanel.tsx`
- Test `packages/chordl-guitar/test/pitch.test.ts`
- Test `packages/chordl-react/test/GuitarChord.test.tsx`
- Test `packages/chordl-react/test/GuitarChordPanel.test.tsx`

- [ ] Expose string-indexed sounding pitches without losing muted-string gaps.
- [ ] Schedule block and low-to-high arpeggio events using `electric_guitar_clean`.
- [ ] Give open/fretted/barred sounding positions stable overlay targets.
- [ ] Pulse one barre intersection, not the entire barre.
- [ ] Emit the exact ordered MIDI snapshot when chord, instrument or position changes.

## Task 5: Editor controls and chord snapshots

**Files:**
- Modify `packages/chordl-react/dev/App.tsx`
- Modify `packages/chordl-react/dev/index.html`
- Modify `packages/chordl-react/src/components/ChordSheet.tsx`
- Test `packages/chordl-react/test/ChordSheet.test.tsx`

- [ ] Add the always-visible BPM range and playback-highlight colour control.
- [ ] Feed the resolved settings into piano and guitar previews.
- [ ] Capture rendered playback notes/instrument and include them when adding or editing a chord card.
- [ ] Pass chord-sheet playback defaults and snapshots through `ChordRenderer`.

## Task 6: Board schema v3, static rendering

**Files:**
- Modify `packages/chordl-board/src/types.ts`
- Modify `packages/chordl-board/src/io.ts`
- Modify `packages/chordl-board/src/ChordBoard.tsx`
- Modify `packages/chordl-board/src/index.ts`
- Test `packages/chordl-board/test/io.test.ts`
- Test relevant board rendering tests

- [ ] Add validated playback fields to `BoardItem`.
- [ ] Export `chordl.board/v3`; continue reading v1/v2.
- [ ] Preserve playback fields while stripping malformed MIDI, BPM, colour and instrument input.
- [ ] Include playback data in the portable JSON item, but not the render cache key while cards remain static.
- [ ] Assert both piano and guitar board renderers still hide playback controls.

## Task 7: Verification

- [ ] Run focused tests after each task.
- [ ] Run package lint and builds for core, guitar, react and board.
- [ ] Run their complete test suites.
- [ ] Start the source-resolved Vite dev server on an available port and verify HTTP routes.
- [ ] Browser-check piano block/arp animation, the slider, frame block/strum, muted strings, a barre chord, reduced motion and board persistence.
- [ ] Report automated evidence separately from audible/manual verification.
