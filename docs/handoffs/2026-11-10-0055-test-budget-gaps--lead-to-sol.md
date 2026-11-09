# Handoff: 0055 — [quick] Close the remaining test-budget gaps (cards waitFor, guitar, react legacy-level) (lead → sol)

- **Date:** 2026-11-10 · **Type:** quick · **Ledger:** 0055
- **Branch:** orch/0055-test-budget-gaps · **Worktree:** created by T3 · **Base commit:** 4438c76
- **Status:** closed

## Goal
Board, react, cards and core now use 30s test/hook budgets, and board and react raise Testing Library's `asyncUtilTimeout` to 5000 (#107, #108, #121). Three gaps are left, all found under load:
1. **cards `waitFor` is still 1s.** `packages/chordl-cards/test/ChordCardPlayer.test.tsx:181` failed with `waitFor` giving up after about 1s ("still lazy loading") under load around 40 (0052 return handoff). Add `configure({ asyncUtilTimeout: 5000 })` to `packages/chordl-cards/test/setup.ts`, matching board and react.
2. **guitar is the last multi-file suite on vitest's 5s default.** Add `testTimeout`/`hookTimeout` 30000 to `packages/chordl-guitar/vitest.config.ts`, with measured slowest durations, idle and loaded (0054 review suggestion).
3. **react: a `waitFor` in `InteractiveInput.legacy-level.test.tsx` (~37, ~49) expired at about 1s** in a loaded run (0054 review, https://github.com/pepperhorn/chordl/pull/121#pullrequestreview-5833376894), even though react's `test/setup.ts` sets `asyncUtilTimeout: 5000` (#108). Find out why this file doesn't get the 5s budget: a local `timeout`, a different `configure`, or a `waitFor` imported from somewhere setup doesn't reach. Fix the cause, not just this one call. Grep react, board and cards tests for any other `waitFor`/`findBy` that bypasses the configured budget, and list them.

## Scope
- **Files you own:** `packages/chordl-cards/test/setup.ts`, `packages/chordl-guitar/vitest.config.ts`, `packages/chordl-react/test/InteractiveInput.legacy-level.test.tsx`, and any other react/board/cards test file that the grep in item 3 shows bypassing the budget, but only the budget lines.
- **Do not touch:** `src/`, and assertions.

## Acceptance criteria
- [ ] Each of the three is fixed, with the cause stated for item 3.
- [ ] cards, guitar and react pass in 3 runs with three suites going at once.
- [ ] Test count unchanged (2,966 at base).
- [ ] The verify command passes.

## Verify with
```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```
## Open questions
None.

---
## Receiver ack

I understand the task: align cards async waits and guitar test/hook budgets, trace and fix react legacy-level budget bypasses, and audit react/board/cards async waits. I will change only the owned test budget lines, preserve assertions and test counts, measure guitar idle/loaded durations, run three concurrent-suite rounds and the full verification command, then return a committed handoff and draft PR. No open questions.
