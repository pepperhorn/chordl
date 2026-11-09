# Handoff: 0051 — Make the slowest board and react tests cheaper (lead → sol)

- **Date:** 2026-11-10 · **Type:** quick · **Ledger:** 0051 (suggestion S14)
- **Branch:** orch/0051-faster-slow-tests · **Worktree:** created by T3 · **Base commit:** 4911f61
- **Status:** closed

## Goal
Under concurrent load, board's slowest test reached 23.4s and react's `InteractiveInput.annotation-disabled` reached 15.4s. The 30s budget only holds them for now (#107, #108). Measure first: list the 10 slowest tests in each of chordl-board and chordl-react, from vitest's JSON reporter, idle and with three suites running concurrently. Then make the slowest ones cheaper without weakening them. For example: render less (a smaller board, fewer cards), mock Verovio/SVGuitar or audio where the test isn't about them, replace real-time waits with fake timers, split tests that do several unrelated things, or hoist expensive setup into `beforeAll` where that's safe. Target: no test over 10s under the three-suite load.

## Scope
- **Files you own:** `packages/chordl-board/test/**` and `packages/chordl-react/test/**`, **except** `packages/chordl-react/test/staff-notation*.test.tsx` and `packages/chordl-board/test/on-demand.test.tsx` (0050 owns those). Shared test helpers under those dirs are yours.
- **Do not touch:** `src/`, vitest configs and timeouts (no budget changes), and other packages. If a test is slow because of production code, report it with numbers instead.

## Acceptance criteria
- [ ] A before/after table of the 10 slowest tests per package, idle and under three-suite load.
- [ ] No assertion removed or weakened. For every changed test, one line in the return handoff saying what it still proves.
- [ ] Test count unchanged (2,943 at base), or each change explained if you split a test.
- [ ] The verify command passes.

## Verify with
```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```
## Known gotchas / decisions already made
- `pnpm lint:test` now type-checks every test file (0043), so test edits must type-check.

## Open questions
None.

---
## Receiver ack

Acknowledged: measure the ten slowest board/react tests idle and with three full suites in parallel, then reduce test-only overhead without removing or weakening assertions. I own only the two test directories, excluding staff-notation*.test.tsx and board on-demand.test.tsx, plus my task handoffs. No source, configuration, timeout, dependency, or ledger edits. Preserve test count, record per-file coverage and before/after measurements, run the full verify chain, and return a draft PR. No open questions. GBrain search found no relevant performance context.
