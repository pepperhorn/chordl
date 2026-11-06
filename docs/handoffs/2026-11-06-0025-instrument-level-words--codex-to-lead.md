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

## Review r1 response

- **Review:** [5796777773](https://github.com/pepperhorn/chordl/pull/98#pullrequestreview-5796777773), originally at 51cbe34.
- **Authority:** fetched origin and read the amended spec directly at `origin/main:docs/specs/0025-instrument-level-words.md`. Did not merge main: its amended spec was available remotely, and no local spec edits were needed. This section supersedes the initial implementation's bare-bass vocabulary and effect-based wiring above.
- **Bass decision:** bare `bass` is no longer an instrument token; existing single-note, chord-symbol, multi-hand, colon and uppercase bass-clef forms are untouched. Bass instrument aliases are `bass4`, `4-string bass`, `4 string bass`, `bass guitar` → bass4, and `bass5`, `5-string bass`, `5 string bass` → bass5. Added vocabulary coverage in all positions/cases across Am/C/E/Bb and exact-result legacy regressions. Explicit `bass4`/`bass5` are masked before legacy bass-note detection too, so `C bass4` cannot be claimed as `C bass`.
- **Saved cards:** removed the parsed-value effects. Only the textbox's user-edit handler applies changed parsed instrument/level values, independently. Loading saved cards and the imperative `setChord` path do not apply them. Added real-component tests opening a Guitar/Established card whose raw text is `uke Am beginner`, asserting the selected Guitar button, Established radio, Display state, every saved version's original text/display/instrument/level, and adapter readback. Also covered a keyboard card, later user edits, and the host `setChord` path. Existing manual-choice tests still run.
- **Keyboard phrases:** protected `PADDING_RE` and `FORMAT_FULL_RE` before instrument extraction. Added exact regressions for `C with 2 keys on either side` → `{chordName:"C",padding:2}` and `C full keys` → `{chordName:"C",format:"exact"}`, with no instrument.
- **Differential verification:** built main's core independently from a `git archive origin/main` extraction under `/tmp`, using its own emitted dist. Compared full serialized `parseChordDescription` results with the branch's built core on **353 unique legacy inputs: zero differences**. Corpus includes all reviewer-listed bass hand/note examples; bass/bass-clef/lh/left-hand prefixes with single notes, minor/major7/slash chords and treble/rh suffixes; key/keys/size named/numeric sizes; every each/either/both padding phrasing across C/Am/Bb/E; full keys/key/layout/height/size; and bass/bottom/lowest note and degree forms. Main parser source was confirmed byte-identical at latest observed `origin/main` cc46b51f010a50e16a10da1ba38b4914f48b7081. No legacy drift found in this corpus; the new vocabulary changes are intentional and tested separately.
- **Verification:** final verification passed: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm lint`, `VITEST_MAX_WORKERS=2 pnpm test:run`, and `pnpm --filter @pepperhorn/chordl-react build:site` all exited 0; 152 test files / 2,721 tests passed (core 526; board 336, including six real integration cases); site built in 7.27s; `git diff --check` passed. The first full run hit the default 5s timeout in the existing multi-transition real-SVG manual-choice test (7.4s under contention, no assertion failure). An isolated rerun passed all six integration cases. Raised only that test’s budget to 15s, preserving every assertion, then restarted the full verify chain.
- **Scope:** only the previously owned implementation/test/changelog files and this return handoff changed. No ledger, spec, plan, persistence API, or progression-parser changes. No GBrain writes; lead may promote the user-edit-only rule and legacy-phrase regressions.

### Review r1 verification output

```text
pnpm install --frozen-lockfile: exit 0
pnpm build: exit 0 (plus focused core rebuild after explicit bass-id corner case)
pnpm lint: exit 0
VITEST_MAX_WORKERS=2 pnpm test:run: exit 0
  chordl-voicings: 9 files, 176 tests passed
  chordl-core: 16 files, 526 tests passed
  chordl-listen: 1 file, 13 tests passed
  chordl-guitar: 19 files, 337 tests passed
  chordl-voicing: 9 files, 161 tests passed
  chordl-react: 47 files, 374 tests passed
  chordl-cards: 25 files, 798 tests passed
  chordl-board: 26 files, 336 tests passed
  Total: 152 files, 2721 tests passed
pnpm --filter @pepperhorn/chordl-react build:site: exit 0, built in 7.27s
node /tmp/chordl-0025-r1-compare.mjs: 353 compared, differences []
git diff --check: exit 0
```

A second uncapped run also hit default 5s timeouts in four unrelated React tests while host load was 28.5. The final complete suite passed with Vitest capped at two workers; no repository-wide test config or unowned tests were changed. jsdom navigation diagnostics and the Vite large-chunk warning were non-fatal. Differential corpus and script remain at `/tmp/chordl-0025-r1-comparison.json` and `/tmp/chordl-0025-r1-compare.mjs` in this environment.
