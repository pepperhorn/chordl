# Handoff: 0055 — Close the remaining test-budget gaps (sol → lead)

- **Date:** 2026-11-10
- **Type:** return
- **Ledger:** 0055; quick item, no spec/plan
- **Branch:** `orch/0055-test-budget-gaps`
- **Worktree:** `/home/shaun/.t3/worktrees/chordl/t3-b963ed7c`
- **Base commit:** `dfcb4a1edd577767b406766a696d8c7df59a4bbd` (contains required `4438c76` ancestor)
- **PR:** https://github.com/pepperhorn/chordl/pull/123 (draft)
- **Implementation / validation commit:** `f002612` (following commit records PR metadata only)
- **Status:** done; confirmed gaps fixed, legacy-level 1s hypothesis disproved; historical flake cause unproven

## Goal / context
Close the remaining confirmed async/test-budget gaps without changing source, assertions, or test count. Dispatch and acceptance criteria: [lead → sol](2026-11-10-0055-test-budget-gaps--lead-to-sol.md). Prior evidence: [0054 return](2026-11-10-0054-cards-core-test-timeout--sol-to-lead.md), [0054 review](https://github.com/pepperhorn/chordl/pull/121#pullrequestreview-5833376894).

## Scope / files owned
Changed only cards `test/setup.ts`, guitar `vitest.config.ts`, react `test/GuitarChordPanel.export.test.tsx`, `test/audio-lazy-loading.test.ts`, `test/verovio-prefetch.test.ts`, and this task's acknowledgement/return handoffs. The three additional react tests qualify under dispatch item 3 (only budget lines changed). No source, assertions, dependencies, public APIs, ledger, or other docs changed.

## What changed / decisions made
- Cards now configures Testing Library `asyncUtilTimeout: 5000`, matching react/board.
- Guitar now sets `testTimeout` and `hookTimeout` to 30000; existing per-test 60-second overrides stay intact.
- React's five `vi.waitFor` calls now pass `{ timeout: 5000 }`. These use Vitest's independent wait implementation and are unaffected by Testing Library `configure`; leaving them at the default 1000ms would preserve a real bypass.
- Remove the export helper's explicit 4000ms wait so it inherits the configured 5000ms budget. Keep the hotkey test's existing explicit 5000ms (already aligned).

## React legacy-level investigation: the reported 1s cause is not present
The prior reviewer said the failure “looks like” a 1s default, based on an 8.4-second total test duration; it did not measure the wait. The legacy-level test imports `waitFor` directly from `@testing-library/react`, has no local timeout/configure/resetModules, and is covered by react's `vitest.config.ts` setup file. Installed Testing Library react 16.3.2 delegates configure and waitFor to the same DOM-library configuration.

A temporary diagnostic in that exact file wrapped the two existing waits (without altering callbacks/assertions), logging `getConfig().asyncUtilTimeout` and elapsed time, and deliberately timed out one additional wait in a temporary hook. Results in `/tmp/0055-legacy-probe.log`:

```text
0055 measured timeout ms 5024.402
0055 wait budget 5000
0055 wait duration ms 56.849689
0055 wait budget 5000
0055 wait duration ms 575.704833
Tests 1 passed (1)
```

All diagnostics were removed; the file is byte-identical to base. There is no demonstrated 1s bypass to fix in legacy-level, so no redundant per-call override was added. The original loaded failure's underlying cause remains unproven; a 5s wait exhausting under contention is possible. Raising react's shared budget beyond 5s or changing lazy-loading behavior is outside this task's prescribed fix. The concurrent verification below records whether it recurs.

## Audit of react / board / cards waits
Searched all three test trees (21 react, 8 board and 2 cards files containing async waits/queries) for `waitFor`, `findBy`, `findAllBy`, `timeout`, `configure`, and module resets. No alternate wait imports or configure overrides found. Every Testing Library wait/find query inherits its suite's 5000ms budget except react's already-aligned explicit 5000ms hotkey wait. The complete bypass list before changes:

| File (under packages/) | Calls / original budget | Resolution |
|---|---|---|
| chordl-cards/test/setup.ts | All cards Testing Library waits inherited 1000ms | Configure 5000ms globally |
| chordl-react/test/audio-lazy-loading.test.ts:62,84 | `vi.waitFor`, 1000ms | Explicit 5000ms on both |
| chordl-react/test/verovio-prefetch.test.ts:190,200,258 | `vi.waitFor`, 1000ms | Explicit 5000ms on all three |
| chordl-react/test/GuitarChordPanel.export.test.tsx:40 | Testing Library waitFor, explicit 4000ms | Inherit global 5000ms |
| chordl-react/test/InteractiveInput.play-mode-hotkey.test.tsx:62 | Explicit 5000ms | Already aligned, unchanged |

## Measurement / verification
Run method: each loaded round launches full cards, guitar and react suites together with Python `ThreadPoolExecutor(3)` and waits for all three before the next round. Commands: `pnpm --filter @pepperhorn/chordl-<package> exec vitest run --reporter=json --outputFile=/tmp/0055-loaded<N>-<package>.json`. Results are in `/tmp/0055-measure.log`; no CLI timeout overrides. All nine suite invocations exited 0.

| Result | Loaded 1 | Loaded 2 | Loaded 3 |
|---|---:|---:|---:|
| cards tests passed | 823/823 | 823/823 | 823/823 |
| guitar tests passed | 337/337 | 337/337 | 337/337 |
| react tests passed | 397/397 | 397/397 | 397/397 |
| cards wall seconds | 66.334 | 97.722 | 53.102 |
| guitar wall seconds | 23.219 | 45.431 | 20.188 |
| react wall seconds | 38.651 | 64.578 | 37.544 |
| legacy-level test seconds | 4.008 | 10.502 | 3.908 |

The shared host was busy throughout (round-start one-minute load 14.32, 28.27, 37.49). “Idle” below means guitar alone, with no other task-owned test/build/lint process running, not an idle host (one-minute load 31.19, recorded in `/tmp/0055-idle-load.txt`). Initial exploratory guitar measurement overlapped the legacy probe and is excluded from the idle column. Durations are JSON assertion durations, not whole-file sums.

| Guitar test seconds | Alone | Loaded 1 | Loaded 2 | Loaded 3 |
|---|---:|---:|---:|---:|
| catalogue constraints (existing 60s override) | 5.060 | 15.482 | 33.653 | 12.888 |
| named ninth under #11 (slowest without an override) | 1.750 | 2.748 | 4.360 | 2.009 |
| 38 missing chords / mini-barres | 1.276 | 2.339 | 3.773 | 1.492 |

These runs do not reproduce the historical 8.4s default-budget guitar failure, but show contention pushing the slowest default-budget test close to 5s. The requested 30s budget matches peer packages. Assertions, test declarations and source remain unchanged.

Exact verification chain (all exit 0):

```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

Output summaries (full logs `/tmp/0055-verify-{build,lint,lint-test,tests,site}.log`):

```text
build: all 8 package builds passed; react dist relative imports/Node entry check passed
lint: all 8 package tsc --noEmit commands passed
lint:test: all 8 package test type-checks passed
voicings: 9 files / 176 tests passed
core: 16 files / 712 tests passed
listen: 1 file / 13 tests passed
guitar: 19 files / 337 tests passed
voicing: 9 files / 161 tests passed
react: 51 files / 397 tests passed
cards: 26 files / 823 tests passed
board: 28 files / 347 tests passed
TOTAL: 2,966 passed, unchanged from dispatch base
site: tsc -p tsconfig.site.json && vite build --config vite.site.config.ts passed
```

`git diff --check` passes. Scope audit compares the task branch to its merge base with main; all changes are the five owned budget/config files and the two 0055 handoffs. Main's concurrent ledger-only update is not a task change. Installed dependencies with frozen lockfile, built before tests, and copied the main checkout's .env without displaying its contents. No dev server or live writes.

## Known gotchas / follow-ups / for GBrain
GBrain search for chordl/test timeout/Testing Library returned unrelated pages only; no GBrain page used and no implementer write made. Lead may promote the distinction between `vi.waitFor` and Testing Library `waitFor`, and the measured correction to the prior review's legacy-level hypothesis. Keep any further investigation of the original legacy-level flake separate from the confirmed budget bypasses. Lead owns cross-family review and merge; implementer will not merge or watch the PR.

## Open questions
No implementation scope questions. Legacy-level's historical failure cause cannot be established from the prior review's total-duration reading.

---
## Receiver ack
Lead acknowledges the return through the ledger.
