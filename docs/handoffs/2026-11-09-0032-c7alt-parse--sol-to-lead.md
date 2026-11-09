# Handoff: 0032 — C7alt parser fix (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0032 · **Spec:** none (quick) · **Plan:** none
- **Branch:** orch/0032-c7alt-parse
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-ec8034e7
- **PR:** draft against main, opened after this handoff is committed and pushed; URL in task completion.
- **Base commit:** f94927f (dispatch); comparison base origin/main 4e9cca48da461a8a750ce054a2795f193829ebe7
- **Implementation commit:** 7a7c9af4ff52e68a90c4618a3f6e4eb1623a72d9
- **Status:** closed

## Goal
Preserve the `alt` suffix in natural-language chord requests, with modifier handling and note resolution intact.

## Context you need
[Dispatch and receiver acknowledgement](2026-11-09-0032-c7alt-parse--lead-to-sol.md). No spec, plan or ADR for this quick task.

## Scope
- **In / files owned:** packages/chordl-core/src/parser/natural-language.ts and packages/chordl-core/test/natural-language.test.ts, plus this task's dispatch acknowledgement and return handoff.
- **Out / do not touch:** all other code/docs, ledger, dependency versions, resolver behavior, UI, publication and deployment.

## Acceptance criteria
- [x] Failing tests first: six altered-dominant cases failed with the suffix dropped; 185 passed (182 existing and three new prose guards).
- [x] C7alt, G7alt, Bb7alt, C7alt over E, C7alt with degrees, and C7alt/E now preserve their chord symbols; resolved notes match direct resolveChord calls for each expected symbol. Bass-note and degree modifiers remain intact.
- [x] Attached and spaced alto/alternate/alternative are not included in chord names.
- [x] Existing natural-language suite passes (191 tests including nine new cases). Read-only AST extraction of 104 literal parseChordDescription inputs from origin/main core tests and old/current parser comparison found zero differences.
- [x] Scope audit and git diff --check passed; no other files changed.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
GBrain was searched for chordl / C7alt / natural-language parsing. No directly relevant parser context was returned, so no GBrain page informed the implementation. Workspace dependencies were installed with pnpm install --frozen-lockfile and current build artifacts were generated before testing package exports.

## Open questions
None. Lead should arrange the required other-family review; implementer has not merged or watched the PR.

## Return
- **Outcome:** done
- **What changed:** Added `alt\b` to CHORD_RE's quality alternatives and nine table-driven regression cases. The trailing word boundary prevents accepting the prefix of longer words. No public signature changes.
- **Verification output:**
```text
pnpm build: PASS
pnpm lint: PASS
pnpm test:run: PASS (155 files, 2816 tests)
pnpm --filter @pepperhorn/chordl-react build:site: PASS
Test Files  9 passed (9)
Tests  176 passed (176)
Test Files  16 passed (16)
Tests  585 passed (585)
Test Files  1 passed (1)
Tests  13 passed (13)
Test Files  19 passed (19)
Tests  337 passed (337)
Test Files  9 passed (9)
Tests  161 passed (161)
Test Files  49 passed (49)
Tests  385 passed (385)
Test Files  26 passed (26)
Tests  822 passed (822)
Test Files  26 passed (26)
Tests  337 passed (337)
Site build: ✓ built in 9.14s

Targeted natural-language suite: 1 file passed, 191 tests passed.
Baseline parser comparison: {"base":"origin/main","inputs":104,"differences":[]}
```
- **Warnings:** successful runs emitted Vite chunk-size and jsdom navigation warnings; no failed suites or timeout reruns.
- **Decisions made:** Retained the existing suffix grammar, adding only an alt token with a word boundary. Added slash-bass coverage because the token precedes that capture group. No ADR proposed.
- **Out-of-scope issues found:** none requiring work for this task.
- **Follow-ups:** other-family review and lead merge decision.
- **For GBrain (lead to promote):** Natural-language chord matching must explicitly retain resolver-supported suffixes; a trailing word boundary on alt avoids swallowing prose prefixes.
