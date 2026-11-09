# Handoff: 0040 — board test timeout (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0040 · **Spec/Plan:** none (quick)
- **Branch:** orch/0040-board-test-timeout
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-d013f290
- **PR:** https://github.com/pepperhorn/chordl/pull/107 (draft)
- **Base commit:** a3f6182 (contains dispatch; declared base f94927f verified as ancestor)
- **Implementation commit:** 0c5f105ef7ea7d7f08e584fa911427809ebc6e71
- **Status:** closed (implementation complete; lead review pending)

## Goal
Prevent legitimate board tests from hitting Vitest's default 5-second timeout under load while retaining a finite limit for hangs. Dispatch: [lead → sol](2026-11-09-0040-board-test-timeout--lead-to-sol.md).

## Scope
- **In / files owned:** `packages/chordl-board/vitest.config.ts`, receiver acknowledgement in the dispatch handoff, and this return handoff.
- **Out / do not touch:** test files, other package configs, package.json, lockfile, ledger, runtime code.
- **What changed:** only `testTimeout: 15000` and `hookTimeout: 15000` in the board config; no other code changes.

## Acceptance criteria
- [x] Both timeouts explicitly set and justified by measured loaded test durations below.
- [x] Three loaded board rounds pass (five board-suite executions, 337 tests and 26 files per execution).
- [x] Pool configuration considered and left at its existing defaults: timeout-only change was stable in all load rounds.
- [x] Required build, lint, workspace tests and React site build pass.
- [x] Scope audit and `git diff --check` pass.

## Verify with
```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
# Round 1: run these concurrently, each with its own output log:
pnpm test:run
pnpm --filter @pepperhorn/chordl-board test:run --reporter=json --outputFile=/tmp/chordl-0040-load-1-board.json
# Rounds 2 and 3: run two copies of the board suite concurrently per round,
# with distinct JSON output paths. Keep existing pool/worker defaults.
pnpm --filter @pepperhorn/chordl-board test:run --reporter=json --outputFile=/tmp/chordl-0040-load-N-board.json
pnpm --filter @pepperhorn/chordl-board test:run --reporter=json --outputFile=/tmp/chordl-0040-load-N-parallel.json
# Separate full verification without the extra load process:
pnpm test:run
pnpm --filter @pepperhorn/chordl-react build:site
```

## Load evidence and decisions made
Round 1 ran the board alongside workspace tests. That board suite passed; concurrent workspace tests stopped in core (details below). Rounds 2 and 3 each ran two complete board suites concurrently, satisfying the dispatch's parallel-runs alternative. No worker or pool overrides, retries, or other config changes were used. Host reports 12 online CPUs.

| Round / process | Tests passed / failed | Slowest individual test | Test name |
|---|---|---|---|
| 1 / board | 337 / 0 | 6783.28 ms | BoardEditor instrument and level input words opening a saved guitar card preserves stored controls and values |
| 2 / board | 337 / 0 | 8129.77 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 2 / parallel | 337 / 0 | 9712.51 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 3 / board | 337 / 0 | 8710.97 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 3 / parallel | 337 / 0 | 8225.66 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |

JSON assertion durations establish a 9712.51 ms loaded maximum. 15000 ms leaves 5287.49 ms (~54%) headroom above that measurement, and tests above 5000 ms completed successfully. This is evidence for increasing the old limit; it is not a claim that arbitrary machine load cannot time out. Hooks share the same finite budget for consistency; hooks were not timed independently. The separate Testing Library `waitFor` timeout remains untouched, so failed assertions and real hangs still terminate. No ADR needed.

## Verification output
Install, `pnpm build`, and `pnpm lint`: exit 0. Separate `pnpm test:run`: exit 0, **2807 tests / 155 files passed**.

```text
> @pepperhorn/chordl-voicings@0.4.1 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-voicings
 Test Files  9 passed (9)
      Tests  176 passed (176)
   Duration  756ms (transform 979ms, setup 0ms, import 2.66s, tests 328ms, environment 2ms)
> @pepperhorn/chordl-core@0.6.2 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-core
 Test Files  16 passed (16)
      Tests  576 passed (576)
   Duration  3.06s (transform 4.80s, setup 0ms, import 8.75s, tests 3.21s, environment 4ms)
> @pepperhorn/chordl-listen@0.1.0 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-listen
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  266ms (transform 90ms, setup 0ms, import 111ms, tests 10ms, environment 0ms)
> @pepperhorn/chordl-guitar@0.3.1 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-guitar
 Test Files  19 passed (19)
      Tests  337 passed (337)
   Duration  4.98s (transform 2.42s, setup 0ms, import 4.74s, tests 8.36s, environment 5ms)
> @pepperhorn/chordl-voicing@0.2.0 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-voicing
 Test Files  9 passed (9)
      Tests  161 passed (161)
   Duration  1.52s (transform 4.51s, setup 0ms, import 9.59s, tests 408ms, environment 2ms)
> @pepperhorn/chordl-react@0.5.1 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-react
 Test Files  49 passed (49)
      Tests  385 passed (385)
   Duration  13.57s (transform 11.68s, setup 11.85s, import 27.73s, tests 40.35s, environment 46.18s)
> @pepperhorn/chordl-cards@0.3.0 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-cards
 Test Files  26 passed (26)
      Tests  822 passed (822)
   Duration  21.67s (transform 7.58s, setup 6.27s, import 18.49s, tests 50.05s, environment 24.29s)
> @pepperhorn/chordl-board@0.2.3 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-board
 Test Files  26 passed (26)
      Tests  337 passed (337)
   Duration  11.43s (transform 8.96s, setup 8.88s, import 20.55s, tests 46.88s, environment 31.13s)
```

Site build output (exit 0):
```text
../site-dist/assets/index-Cqs0iaMs.js                    1,124.78 kB │ gzip:   281.52 kB
../site-dist/assets/verovio-module-D0akNUI1.js           7,890.42 kB │ gzip: 2,343.83 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 7.17s
```

Full local logs: `/tmp/chordl-0040-{install,build,lint,workspace-serial,site}.log`; load evidence: `/tmp/chordl-0040-load-{1,2,3}-{board,parallel}.{log,json}` (round 1 has workspace.log instead of parallel artifacts). These temporary logs are local; the durable measurements and verification summaries are pasted above.

## Known gotchas / out-of-scope issues
- GBrain was available. Search `chordl board test timeout` returned no task-specific page; no unrelated pages used and no implementer writeback performed.
- Loaded round 1 workspace command: exit 1 in `packages/chordl-core/test/chord-resolver.test.ts:314`, `alteration fallback with slash bass > every bracketed catalogue alias with every slash bass is correct or throws`. It timed out at the core 5000 ms limit, measured 9001 ms; core result 575 passed / 1 failed. Workspace stopped before later packages. The separate full workspace run passed all 576 core tests and all other packages. Left core untouched, as required by ownership.
- Tests emit jsdom navigation warnings, and site build emits a chunk-size warning; both commands pass.

## Open questions
None for the implementation. Lead owns cross-family review and merge.

## Return
- **Outcome:** done
- **Commits:** receiver ack 6a94bd3; implementation 0c5f105ef7ea7d7f08e584fa911427809ebc6e71; this handoff in the following documentation commit.
- **Follow-ups:** lead may track the independent core catalogue-test timeout under concurrent load as a separate scoped task.
- **For GBrain (lead to promote):** board tests under concurrent test load reached 9.71 seconds; explicit 15-second test/hook budgets passed five loaded suite executions. A separate core catalogue regression test can exceed its own default timeout under contention.

## Receiver ack
Lead acknowledges through the ledger; implementer does not edit it.
