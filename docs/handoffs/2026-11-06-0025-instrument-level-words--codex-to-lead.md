# Handoff: 0025 — Instrument and level words in chord input (codex → lead)

- **Date:** 2026-11-06
- **Type:** return
- **Ledger:** 0025 · **Spec:** [0025](../specs/0025-instrument-level-words.md) · **Plan:** [0025, T1](../plans/0025-instrument-level-words.md)
- **Dispatch / receiver ack:** [lead-to-codex](2026-11-06-0025-instrument-level-words--lead-to-codex.md)
- **Branch:** orch/0025-instrument-level-words
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-65720342
- **PR:** https://github.com/pepperhorn/chordl/pull/98 (draft)
- **Base commit:** 4d43926 (dispatch docs at 0a282d1)
- **Port:** 5450 (no server started)
- **Status:** closed

## Goal
Single-chord input such as `ukulele am beginner` resolves to Am, switches to the ukulele frame, and selects Beginner. All specified aliases work without breaking existing bass-note phrasing.

## Context you need
The linked spec and plan are authoritative. Implementation is complete and ready for the lead to arrange the required Claude-family review. Nothing was merged or published.

## Scope
- **In:** optional core instrument/level unions, extraction and stripping, editor effects, parser/component tests, Unreleased note.
- **Out:** progression parser, persistence changes, new instruments/levels, dev App.tsx.
- **Files owned and changed:** `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/src/types.ts`, `packages/chordl-core/test/natural-language.test.ts`, `packages/chordl-board/src/BoardEditor.tsx`, `packages/chordl-board/test/board-editor-instrument-words.test.tsx`, `CHANGELOG.md`, and the two 0025 handoffs.
- **Do not touch:** all other files; ledger left to the lead.

## Acceptance criteria
- [x] AC1: every vocabulary alias tested in leading, middle, trailing and uppercase forms.
- [x] AC2: all headline word orders return Am/ukulele/beginner; `ukulele Am` regression covered.
- [x] AC3: slash bass, over-note, bass-note and bass-degree forms preserve results and do not set an instrument; existing parser suite passes.
- [x] AC4: real editor and real guitar panel tests assert selected ukulele button, rendered SVG, Display button and Level radio state. Piano returns to Diagram; unrelated typing and requests do not undo manual choices; level-only input preserves display.
- [x] AC5: full prescribed verification passes.

## Verify with
```bash
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
- GBrain was available; search `chordl parser instrument level words` found no relevant parser guidance. No GBrain writes were made (implementer role).
- Built workspace artifacts before tests; sibling packages resolve through dist.
- The real instrument panel currently offers Guitar, Guitar top 3 and Ukulele buttons. Tests assert Ukulele/Guitar with the real panel; no mocked control state is used.

## Open questions
None.

## Receiver ack
Lead to acknowledge this return through the main-checkout ledger.

## Return
- **Outcome:** done
- **Commits:** receiver ack 7014586, followed by implementation and this return on the task branch.
- **What changed:** instrument/level extraction chooses the first matching request, strips all matching words, and protects existing bass and key-size phrases. Editor instrument and level effects have independent parsed-value dependencies.
- **Verification output:** all commands exited 0:
```text
pnpm install --frozen-lockfile: passed
pnpm build: passed (all eight packages)
pnpm lint: passed (all eight packages)
pnpm test:run:
  chordl-voicings: 9 files, 176 tests passed
  chordl-core: 16 files, 512 tests passed
  chordl-listen: 1 file, 13 tests passed
  chordl-guitar: 19 files, 337 tests passed
  chordl-voicing: 9 files, 161 tests passed
  chordl-react: 47 files, 374 tests passed
  chordl-cards: 25 files, 798 tests passed
  chordl-board: 26 files, 333 tests passed
  Total: 152 files, 2704 tests passed
pnpm --filter @pepperhorn/chordl-react build:site: passed, built in 5.48s
  Non-fatal Vite large-chunk warning; tests emitted jsdom navigation diagnostics.
git diff --check: passed
```
- **Decisions made:** strip instrument/level words before the other extractors, not just the final residual pass: otherwise `5-string bass` produces a false `g bass` note match before stripping. Protect spans belonging to existing bass/clef/octave/note-list and key-size syntax first. Core mirrors instrument ids (including guitar-top3) plus piano without importing guitar. Independent effects ensure a changed instrument does not reset a manually changed level, and vice versa. No ADR proposed.
- **Out-of-scope issues found:** none requiring scope expansion.
- **Follow-ups:** Claude-family review and lead merge; no browser/device verification was performed.
- **For GBrain (lead to promote):** new aliases must be removed before bass extraction as well as chord-name extraction; multiword instrument suffixes can otherwise look like bass notes. Real control state tests protect the parsed-value effect dependencies against resetting manual choices.
