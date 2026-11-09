# Handoff: 0032 — C7alt parser fix (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0032 · **Spec:** none (quick) · **Plan:** none
- **Branch:** orch/0032-c7alt-parse
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-ec8034e7
- **PR:** https://github.com/pepperhorn/chordl/pull/106 (draft against main)
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

## Review r1 response

- **Review:** [5821147423](https://github.com/pepperhorn/chordl/pull/106#pullrequestreview-5821147423), reviewed head 5dd3b21fddc5bd32484a209a3de8568fd1e36a9b.
- **Outcome:** addressed the blocking casing finding and the resolved-notes assertion nit.
- **Changes:** normalize the matched `alt` token to lowercase when assembling `chordName`. Added `C7ALT`, `c7ALT`, and `C7Alt` to the regression table, all expecting `C7alt`. Replaced the self-comparison through `resolveChord` with literal expected pitch classes for every table row (including G/Bb roots and slash bass). Sort copies of both lists to compare pitch-class content independently of bass ordering.
- **Failing-test-first evidence:** with only the test changes, the natural-language suite reported 3 failed / 191 passed; each new casing variant failed the chord-name assertion. After the normalization fix: 194 passed.
- **Verification:** full required command exited 0:
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```
```text
pnpm build: PASS
pnpm lint: PASS
pnpm test:run: PASS (155 files, 2819 tests)
Per-package tests, command order: 176 / 588 / 13 / 337 / 161 / 385 / 822 / 337
pnpm --filter @pepperhorn/chordl-react build:site: PASS (built in 6.03s)
Targeted natural-language suite: 1 file passed, 194 tests passed
```
- **Warnings:** Vite chunk-size and jsdom navigation warnings; no failing suites or timeout reruns.
- **Scope audit:** only the two owned code/test files and this return handoff changed during r1; `git diff --check` passed.
- **Deferred by owner:** spaced `C7 alt`, `C7(alt)`, `C7alt9`, `Calt7`, and the Calt7/C7alt resolver mismatch. Existing clean failure of `Calt`/`Cmaj7alt` accepted. No grammar expansion or resolver changes made.
- **Open questions:** none; ready for re-review. GBrain was searched again, with no relevant additional parser context found; no implementer write-back.
