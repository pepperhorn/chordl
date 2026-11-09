# Handoff: 0040 — board test timeout (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0040 · **Spec/Plan:** none (quick)
- **Branch:** orch/0040-board-test-timeout
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-d013f290
- **PR:** https://github.com/pepperhorn/chordl/pull/107 (draft)
- **Base commit:** a3f6182 (contains dispatch; declared base f94927f verified as ancestor)
- **Initial implementation commit:** 0c5f105ef7ea7d7f08e584fa911427809ebc6e71
- **Status:** closed (implementation complete; lead review pending)

## Goal
Prevent legitimate board tests from hitting Vitest's default 5-second timeout under load while retaining a finite limit for hangs. Dispatch: [lead → sol](2026-11-09-0040-board-test-timeout--lead-to-sol.md).

## Scope
- **In / Files you own:** `packages/chordl-board/vitest.config.ts`, `packages/chordl-board/test/setup.ts`, `packages/chordl-board/test/board-editor-instrument-words.test.tsx` (only removal of its per-test 15000 override and associated stale comment), receiver acknowledgement in the dispatch handoff, and this return handoff. The lead authorized the expanded review-r1 scope on 2026-11-09.
- **Out / do not touch:** all other test files and changes, other package configs, package.json, lockfile, ledger, runtime code.
- **What changed:** current settings are `testTimeout: 30000` and `hookTimeout: 30000`, Testing Library `asyncUtilTimeout: 5000`, and removal of the instrument test override. The initial 15000 implementation and its evidence below are historical; the Review r1 response supersedes their justification.

## Acceptance criteria
- [x] Both timeouts explicitly set and justified by measured loaded test durations below.
- [x] Review r1: three rounds of three concurrent board suites pass (nine executions; 337 tests / 26 files each).
- [x] Pool configuration considered and left at its existing defaults: timeout changes were stable across nine three-way loaded suite executions.
- [x] Required build, lint, workspace tests and React site build pass.
- [x] Scope audit and `git diff --check` pass.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
# From packages/chordl-board, start three copies concurrently with distinct paths:
pnpm exec vitest run --reporter=json --outputFile=/tmp/chordl-0040-r1-load-ROUND-SUITE.json
# Repeat for three rounds; wait for all three suites before the next round.
```
Current measurements and verification are in [Review r1 response](#review-r1-response). The r0 sections below preserve the first submission's evidence with corrections.

## Initial r0 load evidence and decisions (superseded by Review r1 response)
Round 1 ran the board alongside workspace tests. That board suite passed; concurrent workspace tests stopped in core (details below). Rounds 2 and 3 each ran two complete board suites concurrently, satisfying the dispatch's parallel-runs alternative. No worker or pool overrides, retries, or other config changes were used. Host reports 12 online CPUs.

| Round / process | Tests passed / failed | Slowest individual test | Test name |
|---|---|---|---|
| 1 / board | 337 / 0 | 6783.28 ms | BoardEditor instrument and level input words opening a saved guitar card preserves stored controls and values |
| 2 / board | 337 / 0 | 8129.77 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 2 / parallel | 337 / 0 | 9712.51 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 3 / board | 337 / 0 | 8710.97 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 3 / parallel | 337 / 0 | 8225.66 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |

**Historical r0 evidence (corrected after review):** JSON assertion durations establish a 9712.51 ms loaded maximum; that test had a pre-existing per-test 15000 override, so its duration did not justify the global setting. The slowest globally governed test in that sample was 6783.28 ms. The original reasoning below is retained as history and superseded by the Review r1 response.

Original reasoning: 15000 ms leaves 5287.49 ms (~54%) headroom above that measurement, and tests above 5000 ms completed successfully. This is evidence for increasing the old limit; it is not a claim that arbitrary machine load cannot time out. Hooks share the same finite budget for consistency; hooks were not timed independently. The separate Testing Library `waitFor` timeout was originally untouched. Review r1 established that its 1-second default was itself a confirmed flake source; it is now 5 seconds. No ADR needed.

## Initial r0 verification output
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
- **Commits:** receiver ack 6a94bd3; initial implementation 0c5f105; review-r1 implementation 8b0d10de51eed020315c813b8247fdae3dedfb1c; updated measurements and response in the following documentation commit.
- **Follow-ups:** lead may track the independent core catalogue-test timeout under concurrent load as a separate scoped task.
- **For GBrain (lead to promote):** the original two-suite evidence was insufficient: review found failures around 16 seconds with three concurrent suites and a hidden per-test override. Current budgets and stronger validation are recorded in Review r1 response. A separate core catalogue regression test can exceed its own default timeout under contention.

## Receiver ack
Lead acknowledges through the ledger; implementer does not edit it.

## Review r1 response

Responds to [review 5821171695](https://github.com/pepperhorn/chordl/pull/107#pullrequestreview-5821171695) on bc4ff4c. The lead explicitly expanded ownership to the two test files on 2026-11-09.

### Findings addressed and decisions
1. Set global `testTimeout` and `hookTimeout` to 30000 ms. The reviewer measured 16329/15995 ms failures with three concurrent suites, so the previous 15000 budget was insufficient. This revision measured a 21838.86 ms passing test under still higher load; 30000 leaves about 8161 ms (37%) headroom above that observation. Timeouts remain finite; hooks are not independently timed.
2. Removed the instrument-words test's `15_000` override and its directly associated stale comment; no test assertions or flow changed. The global budget now applies. Corrected the initial handoff's reasoning: its 9712.51 ms worst case was governed by that per-test override, not the global config.
3. Added `configure({ asyncUtilTimeout: 5000 })` from `@testing-library/react` in board setup. The prior 1-second `waitFor` default was a confirmed flake source: [0031 return](2026-11-09-0031-resolver-slash-brackets--sol-to-lead.md#known-gotchas--follow-ups) records a Ukulele `waitFor` failure even with `--testTimeout=30000`. A test timeout alone cannot cover this. Failed async assertions still terminate at a finite 5-second utility budget.
4. **No maxWorkers cap or pool changes:** timeout changes alone passed all nine executions with three suites concurrent, so the conditional worker-cap fallback was unnecessary. No CLI/environment worker or timeout overrides were used (`VITEST_MAX_WORKERS`, `VITEST_MIN_WORKERS`, `VITEST_POOL` all unset). No additional tests, dependencies or runtime behavior changed.

### Three concurrent suites, repeated three times
Each round starts three processes together from `packages/chordl-board`, waits for all three, then starts the next round. Commands use the installed local Vitest version and default pool, equivalent to the reviewer's method:

```bash
# Run three copies concurrently per round, with distinct output paths:
pnpm exec vitest run --reporter=json --outputFile=/tmp/chordl-0040-r1-load-ROUND-SUITE.json
# Repeat for ROUND=1,2,3 and SUITE=1,2,3; log each process independently.
```

**Result:** 9/9 suite executions exit 0, each 337 tests / 26 files passed; 3033 passing test executions total, zero failed. JSON assertion durations, including the test now inheriting the global timeout:

| Round | Suite | Tests passed / failed | Slowest individual test | Test name |
|---|---|---|---|---|
| 1 | 1 | 337 / 0 | 10301.05 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 1 | 2 | 337 / 0 | 11561.51 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 1 | 3 | 337 / 0 | 9021.15 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 2 | 1 | 337 / 0 | 11475.42 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 2 | 2 | 337 / 0 | 11229.53 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 2 | 3 | 337 / 0 | 10388.72 ms | BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear |
| 3 | 1 | 337 / 0 | 21838.86 ms | BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano |
| 3 | 2 | 337 / 0 | 17116.18 ms | BoardEditor embedded in a message draft opens a catalogue chord without overwriting the card being edited |
| 3 | 3 | 337 / 0 | 12229.89 ms | BoardEditor embedded in a message draft keeps p shortcuts and labelled controls local when two boards share a page |

Host: 12 online CPUs. One-minute system load averages from `os.getloadavg()` at round boundaries (these are samples, not peak measurements):
- Round 1: start 6.01, end 20.00; elapsed 26.08 s.
- Round 2: start 20.00, end 33.26; elapsed 28.21 s.
- Round 3: start 33.26, end 44.88; elapsed 36.32 s.

### Full verification after the load rounds
**Result: exit 0 on review-r1 implementation 8b0d10de51eed020315c813b8247fdae3dedfb1c.** Build, lint, all 2807 workspace tests / 155 files, and site build passed in the exact prescribed chain, without worker or timeout overrides:
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

Verification output (exit 0):
```text
pnpm build: passed (board tsc and cards dist check completed)
pnpm lint: passed
> @pepperhorn/chordl-voicings@0.4.1 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-voicings
 Test Files  9 passed (9)
      Tests  176 passed (176)
   Duration  671ms (transform 954ms, setup 0ms, import 2.45s, tests 332ms, environment 2ms)
> @pepperhorn/chordl-core@0.6.2 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-core
 Test Files  16 passed (16)
      Tests  576 passed (576)
   Duration  3.28s (transform 5.28s, setup 0ms, import 9.26s, tests 3.27s, environment 3ms)
> @pepperhorn/chordl-listen@0.1.0 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-listen
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  255ms (transform 83ms, setup 0ms, import 106ms, tests 10ms, environment 0ms)
> @pepperhorn/chordl-guitar@0.3.1 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-guitar
 Test Files  19 passed (19)
      Tests  337 passed (337)
   Duration  7.35s (transform 3.16s, setup 0ms, import 5.99s, tests 11.79s, environment 4ms)
> @pepperhorn/chordl-voicing@0.2.0 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-voicing
 Test Files  9 passed (9)
      Tests  161 passed (161)
   Duration  1.38s (transform 4.11s, setup 0ms, import 8.89s, tests 315ms, environment 2ms)
> @pepperhorn/chordl-react@0.5.1 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-react
 Test Files  49 passed (49)
      Tests  385 passed (385)
   Duration  12.55s (transform 9.44s, setup 11.16s, import 23.89s, tests 38.17s, environment 43.22s)
> @pepperhorn/chordl-cards@0.3.0 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-cards
 Test Files  26 passed (26)
      Tests  822 passed (822)
   Duration  19.63s (transform 6.14s, setup 5.57s, import 14.78s, tests 44.21s, environment 22.46s)
> @pepperhorn/chordl-board@0.2.3 test:run /home/shaun/.t3/worktrees/chordl/t3-d013f290/packages/chordl-board
 Test Files  26 passed (26)
      Tests  337 passed (337)
   Duration  7.36s (transform 6.99s, setup 4.58s, import 14.39s, tests 26.43s, environment 21.79s)
pnpm --filter @pepperhorn/chordl-react build:site: passed; built in 5.20s
```

Full local verify transcript: `/tmp/chordl-0040-r1-verify.log`. Build warnings (API Extractor TypeScript version, Vite module/chunk warnings) and jsdom navigation warnings remain non-fatal. No extra files changed by build/test commands. `git diff --check` passes; code changes are confined to the three authorized files.

Local load logs and full JSON reports: `/tmp/chordl-0040-r1-load-{1,2,3}-{1,2,3}.{log,json}`. Summary: `/tmp/chordl-0040-r1-load-summary.json`. Durable top-five measurements per execution follow; temporary logs are not needed to interpret the results.

### Round 1, suite 1: five slowest tests
- 10301.05 ms — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear (passed)
- 7644.99 ms — BoardEditor embedded in a message draft opens a catalogue chord without overwriting the card being edited (passed)
- 7506.69 ms — BoardEditor cardStyle keeps a per-card note-name size the board does not use (passed)
- 4692.09 ms — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano (passed)
- 3091.70 ms — export libraries load on demand BoardPlayer renders without loading html2canvas or jspdf (passed)

### Round 1, suite 2: five slowest tests
- 11561.51 ms — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear (passed)
- 8568.14 ms — BoardEditor cardStyle keeps a per-card note-name size the board does not use (passed)
- 7607.23 ms — BoardEditor embedded in a message draft host ref attaches a host ref to the next added card only (passed)
- 2834.98 ms — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano (passed)
- 2271.03 ms — export libraries load on demand BoardPlayer renders without loading html2canvas or jspdf (passed)

### Round 1, suite 3: five slowest tests
- 9021.15 ms — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear (passed)
- 8077.41 ms — BoardEditor cardStyle opening a card keeps its own note-name text a card whose names match the board still saves them on open (passed)
- 5588.33 ms — BoardEditor embedded in a message draft host ref attaches a host ref to the next added card only (passed)
- 4703.19 ms — BoardEditor embedded in a message draft keeps p shortcuts and labelled controls local when two boards share a page (passed)
- 4552.19 ms — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano (passed)

### Round 2, suite 1: five slowest tests
- 11475.42 ms — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear (passed)
- 10603.47 ms — BoardEditor embedded in a message draft opens a catalogue chord without overwriting the card being edited (passed)
- 4330.51 ms — BoardEditor cardStyle opening a card on a styled board leaves its chord text alone (passed)
- 3388.19 ms — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano (passed)
- 3169.64 ms — export libraries load on demand BoardPlayer renders without loading html2canvas or jspdf (passed)

### Round 2, suite 2: five slowest tests
- 11229.53 ms — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear (passed)
- 7935.74 ms — BoardEditor cardStyle opening a card on a styled board leaves its chord text alone (passed)
- 6435.22 ms — BoardEditor embedded in a message draft host ref attaches a host ref to the next added card only (passed)
- 5247.42 ms — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano (passed)
- 4891.31 ms — BoardEditor cardStyle keeps a per-card note-name size the board does not use (passed)

### Round 2, suite 3: five slowest tests
- 10388.72 ms — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear (passed)
- 10239.27 ms — BoardEditor embedded in a message draft opens a catalogue chord without overwriting the card being edited (passed)
- 9614.54 ms — BoardEditor cardStyle opening a card keeps its own note-name text a plain card on the same board stays plain on open (passed)
- 5798.52 ms — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano (passed)
- 3019.08 ms — BoardEditor embedded in a message draft loads the host's board, saves edits back once, and leaves playground storage alone (passed)

### Round 3, suite 1: five slowest tests
- 21838.86 ms — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano (passed)
- 12647.71 ms — BoardEditor cardStyle keeps a per-card note-name size the board does not use (passed)
- 11488.15 ms — BoardEditor embedded in a message draft keeps p shortcuts and labelled controls local when two boards share a page (passed)
- 7240.84 ms — BoardEditor embedded in a message draft opens a catalogue chord without overwriting the card being edited (passed)
- 5131.72 ms — export libraries load on demand BoardPlayer renders without loading html2canvas or jspdf (passed)

### Round 3, suite 2: five slowest tests
- 17116.18 ms — BoardEditor embedded in a message draft opens a catalogue chord without overwriting the card being edited (passed)
- 15971.60 ms — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear (passed)
- 11103.55 ms — BoardEditor cardStyle opening a card keeps its own note-name text a plain card on the same board stays plain on open (passed)
- 4159.85 ms — export libraries load on demand BoardPlayer renders without loading html2canvas or jspdf (passed)
- 3487.34 ms — BoardEditor embedded in a message draft loads the host's board, saves edits back once, and leaves playground storage alone (passed)

### Round 3, suite 3: five slowest tests
- 12229.89 ms — BoardEditor embedded in a message draft keeps p shortcuts and labelled controls local when two boards share a page (passed)
- 11988.41 ms — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano (passed)
- 8768.78 ms — BoardEditor cardStyle keeps a per-card note-name size the board does not use (passed)
- 7060.20 ms — export libraries load on demand BoardPlayer renders without loading html2canvas or jspdf (passed)
- 5839.55 ms — BoardEditor cardStyle adds a card without baking the board's note names into its chord (passed)

### Follow-ups for lead
The review's integration-test splitting and workspace-wide contention policy suggestions remain outside this scope. No GBrain page specific to this task was found in a fresh `chordl board timeout 0040` search; implementer leaves writeback to lead. Lead owns cross-family re-review and merge.
