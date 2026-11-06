# Handoff: 0025 — Instrument and level words in chord input (lead → codex)

- **Date:** 2026-11-06
- **Type:** dispatch
- **Ledger:** 0025 · **Spec:** docs/specs/0025-instrument-level-words.md · **Plan:** docs/plans/0025-instrument-level-words.md (task T1, single task)
- **Branch:** orch/0025-instrument-level-words · **Worktree:** created by T3
- **PR:** (open as a draft)
- **Base commit:** 4d43926
- **Port (if running a server):** 5450
- **Status:** open

## Goal
Typing `ukulele am beginner` (in any word order) into the chordl board editor shows Am on the ukulele frame with Level set to Beginner. Today it shows an E chord. The parser returns structured `instrument` and `level` fields, and the editor applies them.

## Context you need
- The spec has the full vocabulary table and behaviour: docs/specs/0025-instrument-level-words.md
- The plan has the approach and gotchas: docs/plans/0025-instrument-level-words.md
- Parser: `packages/chordl-core/src/parser/natural-language.ts`, `parseChordDescription` (around line 416). It follows the pattern "extract with regexes, strip all matches, take the residual as the chord name". The strip chain starts around line 847.
- Editor state: `packages/chordl-board/src/BoardEditor.tsx`, with `displayMode` (~618), `guitarInstrument` (~630) and `level` (~667). `parseChordDescription(input)` is already called at ~724.
- Instrument ids live in `packages/chordl-guitar/src/instruments.ts` (`InstrumentId`), and levels in `packages/chordl-guitar/src/experience.ts`. Core must **not** import chordl-guitar. Mirror the values as a string union in core types.

## Scope
- **In:** the parser fields + stripping, the `ParsedChordRequest` type, the BoardEditor wiring, tests, and a CHANGELOG Unreleased entry.
- **Out:** progression input (`parseProgressionRequest`), new instruments or levels, persistence changes, the dev site App.tsx.
- **Files you own:** `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/src/types.ts`, `packages/chordl-core/test/natural-language.test.ts`, `packages/chordl-board/src/BoardEditor.tsx`, `packages/chordl-board/test/board-editor-instrument-words.test.tsx` (new), `CHANGELOG.md`, plus your own handoff files for 0025.
- **Do not touch:** anything else. If you need to, stop and note it in your return handoff.

## Acceptance criteria
- [ ] AC1–AC5 from the spec. AC2 is the headline: `ukulele am beginner` → `{ chordName: "Am", instrument: "ukulele", level: "beginner" }`, and `ukulele Am` no longer gives `E`.
- [ ] AC3: the existing bass-note phrasing (`BASS_NOTE_RE`, `OVER_BASS_NOTE_RE`, `BASS_DEGREE_RE` forms, and `C/E`) is unchanged and sets no instrument.
- [ ] AC4: board component tests assert the real Level radio state and the display/instrument state. Don't only assert that a mock was called.

## Verify with
```bash
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
- Decided by the human: switch both the view and the level, and accept common aliases (the table is in the spec).
- "a"/"an" are also the note A (see the top of natural-language.ts). Don't add filler words that eat chord roots.
- Leading words leak into residual extraction: `ukulele Am` → `E` today. Strip instrument and level words before residual extraction.
- In the editor, apply the parsed values only when they **change**: an effect keyed on the parsed instrument/level, not on every keystroke. Otherwise a manual Level click is overwritten while the input still says "beginner".
- `build:site` now type-checks `dev/` (PR #96). Keep it passing.
- Lesson from earlier work in this repo: mocked wrappers can certify inert code, so test the real control state.
- GBrain: nothing chordl-parser-specific found.

## Open questions
None.

---
## Receiver ack

---
## Return (implementer → lead; fill in when done, or in a separate …-to-lead.md)
