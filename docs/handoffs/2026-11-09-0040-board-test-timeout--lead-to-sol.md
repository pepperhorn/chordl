# Handoff: 0040 — [quick] chordl-board tests: raise vitest timeout above the 5s default (lead → sol)

- **Date:** 2026-11-09
- **Type:** quick
- **Ledger:** 0040 · **Spec:** none (quick) · **Plan:** none
- **Branch:** orch/0040-board-test-timeout · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** f94927f
- **Status:** closed

## Goal
chordl-board tests flake under load: suites using `waitFor` / `setTimeout` (board-editor*, board-player, lazy-export, new-board, card-toolbar) hit vitest's 5s default `testTimeout`, and pass when rerun in isolation (seen in the 0025, 0026 and 0031 return handoffs). `packages/chordl-board/vitest.config.ts` sets no `testTimeout` or `hookTimeout`. Done = the board suite no longer times out under a loaded machine, without hiding a real hang.

## Scope
- **Files you own:** `packages/chordl-board/vitest.config.ts` only.
- **Do not touch:** test files, other packages' configs, package.json, the lockfile. If the right fix needs any of them (e.g. a single slow test that should be split), stop and say so in the return handoff.

## Acceptance criteria
- [ ] `testTimeout` and `hookTimeout` set (suggest 15000; justify the number from measured slowest-test durations, paste them).
- [ ] Board suite passes under load: run it alongside the full workspace `pnpm test:run` (or with `stress`/parallel runs) at least 3 times; paste pass counts and the slowest durations.
- [ ] Consider `pool`/`poolOptions` only if the timeout alone doesn't make it stable; record the decision either way.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
- Source: health scan 2026-11-09 (ledger Suggestions); `waitFor` has its own 1s default timeout, separate from `testTimeout`.

## Open questions
none

---
## Receiver ack

Acknowledged 2026-11-09 (sol): I will change only the board Vitest config to set bounded test and hook timeouts, justify them with measured test durations, and run at least three board suites alongside workspace tests. I will preserve pool settings unless measurements show they must change, run all required verification, and commit a return handoff and open a draft PR. No open questions. GBrain search `chordl board test timeout` returned no task-specific guidance; repo docs remain authoritative.
