# Handoff: 0041 — React test timeout (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0041 · **Spec / Plan:** none (quick)
- **Branch:** orch/0041-react-test-timeout
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-ad5310f3
- **PR:** draft PR from this branch against main; URL in implementation return message
- **Base commit:** f557b6c4d915a3c2f01529e7c34b7d2ca45d336e (dispatch); required 6b13fc1 verified ancestor
- **Implementation commit:** 3d52c922c518df580b685fe5ef974ede883d4c02
- **Status:** closed (implementation complete; lead review pending)

## Goal
Match the board test timeout policy so React InteractiveInput tests can complete under contention and workspace tests continue to cards and board. Dispatch: [lead → sol](2026-11-09-0041-react-test-timeout--lead-to-sol.md). Precedent: [0040 return, Review r1 response](2026-11-09-0040-board-test-timeout--sol-to-lead.md#review-r1-response).

## Scope
- **In / Files owned:** `packages/chordl-react/vitest.config.ts`, `packages/chordl-react/test/setup.ts`, acknowledgement in the 0041 dispatch handoff, and this return handoff.
- **Out / Do not touch:** tests, other packages, runtime code, dependencies, ledger, all other docs.
- **What changed:** `testTimeout: 30000`, `hookTimeout: 30000`, and Testing Library `configure({ asyncUtilTimeout: 5000 })`, matching board at 6b13fc1. No pool, worker, CLI timeout, assertions or test-flow changes.

## Acceptance criteria
- [x] All three settings match board at 6b13fc1.
- [x] Two rounds of three concurrent complete React suites: 6/6 exit 0, 385 tests / 49 files each; 2310 passing executions, zero failures.
- [x] Slowest test durations recorded below; no individual test above 15000 ms.
- [x] Per-test timeout overrides inspected and reported without editing tests.
- [x] Build, lint, all 2819 workspace tests / 155 files, and React site build pass.
- [x] `git diff --check` passes; scope audit contains only the two owned configuration files and task handoffs.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
# From packages/chordl-react, three simultaneous copies with distinct output paths:
pnpm exec vitest run --reporter=json --outputFile=/tmp/chordl-0041-load-ROUND-SUITE.json
# Wait for all three to finish, then repeat (ROUND=1,2; SUITE=1,2,3).
```
Setup used `pnpm install --frozen-lockfile`; workspace artifacts were built before lint/tests, and `.env` was copied from the main checkout after build as required. All verification stages ran sequentially and exited 0. Load rounds ran after full verification. VITEST_MAX_WORKERS, VITEST_MIN_WORKERS, VITEST_POOL were unset.

## Load evidence
| Round | Suite | Passed / failed | Slowest test (ms) | Test |
|---|---|---|---|---|
| 1 | 1 | 385 / 0 | 12712.36 | InteractiveInput annotation controls on guitar display disables Note names, Degrees and Fingering only while the display mode is guitar |
| 1 | 2 | 385 / 0 | 10811.41 | editing a legacy guitar card with no stored level does not rewrite the card's stored fret position |
| 1 | 3 | 385 / 0 | 11130.36 | InteractiveInput annotation controls on guitar display disables Note names, Degrees and Fingering only while the display mode is guitar |
| 2 | 1 | 385 / 0 | 11141.59 | editing a legacy guitar card with no stored level does not rewrite the card's stored fret position |
| 2 | 2 | 385 / 0 | 12958.00 | InteractiveInput annotation controls on guitar display disables Note names, Degrees and Fingering only while the display mode is guitar |
| 2 | 3 | 385 / 0 | 11330.67 | InteractiveInput annotation controls on guitar display disables Note names, Degrees and Fingering only while the display mode is guitar |

Host: 12 CPUs. Round 1 elapsed 35.79 s, one-minute load 6.33 → 21.76. Round 2 elapsed 36.58 s, one-minute load 21.76 → 32.58. These are boundary samples, not peak measurements. Largest individual duration: 12958.00 ms, below both the 15s reporting threshold and global 30s budget. Hook duration was not independently measured.

## Per-test timeout overrides (left unchanged)
Searches:
```bash
rg -n -i 'timeout|[0-9]_?000|15_000|30_000' packages/chordl-react/test
rg -n -U '\},\s*[\d_]+\s*\)|testTimeout|hookTimeout|timeout\s*:' packages/chordl-react/test
```
- `test/InteractiveInput.play-mode-hotkey.test.tsx:63`: `it("enters play mode on a bare p while the editing board is shown", ...)` has `10_000` ms per-test override. This stays below the new global budget; recommend lead consider removing it in separately authorized scope so the common budget applies.
- The same test, line 62, explicitly sets `waitFor` timeout 5000 ms (matches new setup default).
- `test/GuitarChordPanel.export.test.tsx:40` explicitly sets `waitFor` timeout 4000 ms in `clickAndWait` (below new default).
- No other Vitest per-test/hook overrides found. Fake timer advances, `setTimeout(..., 0)` and numeric assertions are not test budget overrides.

## Verification output
```text
pnpm build: PASS
pnpm lint: PASS
> @pepperhorn/chordl-core@0.6.2 build /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-core
> @pepperhorn/chordl-listen@0.1.0 build /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-listen
> @pepperhorn/chordl-guitar@0.3.1 build /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-guitar
> @pepperhorn/chordl-guitar@0.3.1 build:data /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-guitar
> @pepperhorn/chordl-voicing@0.2.0 build /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-voicing
> @pepperhorn/chordl-voicing@0.2.0 prepare:schema /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-voicing
> @pepperhorn/chordl-react@0.5.1 build /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-react
> @pepperhorn/chordl-cards@0.3.0 build /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-cards
> @pepperhorn/chordl-board@0.2.3 build /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-board
> @pepperhorn/chordl-voicings@0.4.1 lint /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-voicings
> @pepperhorn/chordl-core@0.6.2 lint /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-core
> @pepperhorn/chordl-listen@0.1.0 lint /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-listen
> @pepperhorn/chordl-guitar@0.3.1 lint /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-guitar
> @pepperhorn/chordl-guitar@0.3.1 build:data /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-guitar
> @pepperhorn/chordl-voicing@0.2.0 lint /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-voicing
> @pepperhorn/chordl-voicing@0.2.0 prepare:schema /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-voicing
> @pepperhorn/chordl-react@0.5.1 lint /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-react
> @pepperhorn/chordl-cards@0.3.0 lint /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-cards
> @pepperhorn/chordl-board@0.2.3 lint /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-board
> @pepperhorn/chordl-voicings@0.4.1 test:run /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-voicings
 Test Files  9 passed (9)
      Tests  176 passed (176)
   Duration  478ms (transform 721ms, setup 0ms, import 1.69s, tests 196ms, environment 1ms)
> @pepperhorn/chordl-core@0.6.2 test:run /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-core
 Test Files  16 passed (16)
      Tests  588 passed (588)
   Duration  2.57s (transform 4.11s, setup 0ms, import 7.00s, tests 2.57s, environment 3ms)
> @pepperhorn/chordl-listen@0.1.0 test:run /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-listen
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  246ms (transform 81ms, setup 0ms, import 105ms, tests 10ms, environment 0ms)
> @pepperhorn/chordl-guitar@0.3.1 test:run /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-guitar
> @pepperhorn/chordl-guitar@0.3.1 build:data /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-guitar
 Test Files  19 passed (19)
      Tests  337 passed (337)
   Duration  3.29s (transform 2.05s, setup 0ms, import 3.53s, tests 5.58s, environment 3ms)
> @pepperhorn/chordl-voicing@0.2.0 test:run /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-voicing
> @pepperhorn/chordl-voicing@0.2.0 prepare:schema /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-voicing
 Test Files  9 passed (9)
      Tests  161 passed (161)
   Duration  1.24s (transform 3.92s, setup 0ms, import 7.98s, tests 345ms, environment 1ms)
> @pepperhorn/chordl-react@0.5.1 test:run /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-react
 Test Files  49 passed (49)
      Tests  385 passed (385)
   Duration  9.86s (transform 7.67s, setup 8.59s, import 19.47s, tests 28.17s, environment 33.95s)
> @pepperhorn/chordl-cards@0.3.0 test:run /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-cards
 Test Files  26 passed (26)
      Tests  822 passed (822)
   Duration  19.75s (transform 6.22s, setup 5.79s, import 15.25s, tests 43.56s, environment 21.23s)
> @pepperhorn/chordl-board@0.2.3 test:run /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-board
 Test Files  26 passed (26)
      Tests  337 passed (337)
   Duration  6.77s (transform 7.16s, setup 4.47s, import 14.97s, tests 23.77s, environment 18.97s)
> @pepperhorn/chordl-react@0.5.1 build:site /home/shaun/.t3/worktrees/chordl/t3-ad5310f3/packages/chordl-react
pnpm --filter @pepperhorn/chordl-react build:site: PASS (built in 5.28s)
Overall exit: 0

```
Warnings were non-fatal: existing jsdom navigation warnings, API Extractor bundled TypeScript version warning, Vite browser-external/module import and chunk-size warnings. Raw local transcripts: `/tmp/chordl-0041-verify.log`, `/tmp/chordl-0041-load.log`, `/tmp/chordl-0041-load-{1,2}-{1,2,3}.{log,json}`, summary `/tmp/chordl-0041-load-summary.json`. Durable counts and measurements are pasted above.

## Known gotchas / decisions made
- GBrain was available: search `chordl react board test timeout` returned unrelated weak-semantic hits, no task-specific page used. No implementer GBrain writeback, per AGENTS.md.
- Matched the prescribed board policy exactly; no new policy or ADR needed. Did not remove the existing 10s override or 4s waitFor limit because tests are outside ownership.
- Finite timeout increases do not establish stability at arbitrarily higher contention. This run's six executions establish the reported local load evidence only.

## Open questions
None for implementation. Lead owns cross-family review and merge.

## Return
- **Outcome:** done
- **Commits:** acknowledgement 0041550; implementation 3d52c92; this return handoff in subsequent documentation commit.
- **Follow-ups:** review the narrower explicit timeout limits above as separate scope if needed; no test exceeded 15 seconds here.
- **For GBrain (lead to promote):** React matches board's 30s test/hook and 5s async utility budgets. Two three-way load rounds passed all 385 tests per suite; slowest 12.96s. Existing hotkey test still has a 10s override and export waitFor has a 4s explicit limit.

## Receiver ack
Lead acknowledges return through the ledger; implementer does not edit it.
