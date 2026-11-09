# Handoff: 0054 — [quick] cards and core tests: timeouts under load (lead → sol)

- **Date:** 2026-11-10 · **Type:** quick · **Ledger:** 0054 (S12, plus the 0051 review finding)
- **Branch:** orch/0054-cards-core-test-timeout · **Worktree:** created by T3 · **Base commit:** 80ec59c
- **Status:** closed

## Goal
Board and react got explicit test budgets (#107, #108) and faster slow tests (#120). Cards and core still run on vitest's 5s default and time out under load:
- **cards:** `packages/chordl-cards/test/positions.test.ts` fails 2 of 823 tests at 5.2–5.8s in **both** controlled three-suite runs (board, react and cards concurrently, load 10–16 on 12 cores). Source: 0051 review, https://github.com/pepperhorn/chordl/pull/120#pullrequestreview-5832389660.
- **core:** the catalogue regression test exceeds its default timeout under concurrent load (0040 return handoff; S12).

Fix both. First make the slow tests cheaper without weakening them, as 0051 did. Only then, if needed, add an explicit `testTimeout`/`hookTimeout` to that package's vitest config, matching board and react (30000), with the measured numbers that justify it.

## Scope
- **Files you own:** `packages/chordl-cards/test/**`, `packages/chordl-cards/vitest.config.*`, `packages/chordl-core/test/**` (only the catalogue-timeout test and any helper it needs), `packages/chordl-core/vitest.config.*`.
- **Do not touch:** `src/`, and other packages.

## Acceptance criteria
- [ ] Before/after timings for the slow tests, idle and under a three-suite load (cards, core, react concurrently). The cards and core suites must pass in at least 3 loaded runs.
- [ ] No assertion removed or weakened; one line per changed test saying what it still proves.
- [ ] Test count unchanged (2,961 at base).
- [ ] The verify command passes.

## Verify with
```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```
## Open questions
None.

---
## Receiver ack

Acknowledged: optimize the expensive cards positions and core catalogue tests without removing or weakening assertions, confined to the owned tests/configs. Measure idle and three-suite cards/core/react load before and after, obtain three passing loaded runs, preserve 2,961 tests, and run the full verify command. Add explicit 30s budgets only if measured residual cost warrants them. No source changes or other packages; no open questions.
