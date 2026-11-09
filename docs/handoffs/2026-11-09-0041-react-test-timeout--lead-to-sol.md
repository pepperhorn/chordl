# Handoff: 0041 — [quick] chordl-react tests: same timeout budget as board (lead → sol)

- **Date:** 2026-11-09
- **Type:** quick
- **Ledger:** 0041 · **Spec:** none (quick) · **Plan:** none
- **Branch:** orch/0041-react-test-timeout · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** 6b13fc1
- **Status:** closed

## Goal
Under load, `chordl-react`'s `InteractiveInput` tests time out at vitest's 5s default (0040 review r2, https://github.com/pepperhorn/chordl/pull/107#pullrequestreview-5821405987: `pnpm test:run` failed twice in react at load 22–57 on 12 CPUs; react alone passed 49/49). Because `test:run` stops at the first failing package, a react timeout hides cards and board results. Apply the fix merged for board in #107 (`6b13fc1`): `testTimeout`/`hookTimeout` 30000 in `vitest.config.ts`, `configure({ asyncUtilTimeout: 5000 })` in `test/setup.ts`.

## Scope
- **Files you own:** `packages/chordl-react/vitest.config.ts`, `packages/chordl-react/test/setup.ts`
- **Do not touch:** test files and every other package. If a react test sets its own timeout that should go, or a single test is pathologically slow, report it in the return handoff instead of editing it.

## Acceptance criteria
- [ ] Both settings present, matching board (`git show 6b13fc1 -- packages/chordl-board` is the reference).
- [ ] Load evidence: from packages/chordl-react run three copies of `pnpm exec vitest run` concurrently, at least two rounds; paste pass counts and the slowest test durations. Note any test above 15s.
- [ ] List any per-test timeout overrides in packages/chordl-react/test (grep) in the return handoff.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
- Board precedent and measurements: docs/handoffs/2026-11-09-0040-board-test-timeout--sol-to-lead.md (Review r1 response).

## Open questions
none

---
## Receiver ack

Acknowledged 2026-11-09 (sol): I will match board's 30000 ms Vitest test/hook budgets and 5000 ms Testing Library async utility budget, editing only the two owned React configuration/setup files and this task's handoffs. I will run at least two rounds of three concurrent complete React suites, record pass counts and slowest tests (flagging any above 15 seconds), inspect per-test timeout overrides without editing tests, and run the full prescribed verification chain. I will commit a return handoff, push only orch/0041-react-test-timeout, and open a draft PR for lead review. No open questions.
