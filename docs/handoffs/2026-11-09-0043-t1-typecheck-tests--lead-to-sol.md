# Handoff: 0043-t1 — Type-check test files: plumbing + five packages (lead → sol)

- **Date:** 2026-11-09
- **Type:** dispatch
- **Ledger:** 0043 · **Spec:** docs/specs/0043-typecheck-tests.md · **Plan:** docs/plans/0043-typecheck-tests.md (task T1)
- **Branch:** orch/0043-t1-typecheck-tests · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** 382678d
- **Status:** closed

## Goal
Plan T1. Add a `tsconfig.test.json` and a `lint:test` script to chordl-voicings, chordl-core, chordl-listen, chordl-guitar and chordl-voicing. Add a root `lint:test` that runs every package defining one, plus a CI step that runs it after Lint. Fix those packages' existing test type errors with type-only changes. T2 will add react, cards and board later.

## Scope
- **In:** plan T1.
- **Out:** react, cards and board (0045-t2 owns their tests right now), `src/` behaviour, other dependencies.
- **Files you own:** as listed under T1 in the plan.
- **Do not touch:** everything else. A `src/` change is allowed only to export a type a test needs; justify each one.

## Acceptance criteria
- [ ] Spec AC1–AC4 for the five packages. For AC1, show that a deliberate type error in one of these packages' test files makes `pnpm lint:test` fail, then revert it.
- [ ] The test count is unchanged (2,929 at base).

## Verify with
```bash
pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && pnpm lint:test
```

## Known gotchas / decisions already made
- The human approved `@types/node` as a devDependency (suggestions S1 and S5, 2026-11-09). Add no other dependency.
- This changes CI, so the lead will ask the human before merging.
- 0045-t2 (#114) is in flight and owns the board/react/cards tests. Don't touch them.

## Open questions
None.

---
## Receiver ack

Accepted: implement T1 only on orch/0043-t1-typecheck-tests: add src+test no-emit configs and lint:test scripts for voicings/core/listen/guitar/voicing, root recursive script, approved Node types where needed, and CI step after Lint. Fix existing test typing without changing assertions or runtime behaviour; leave board/react/cards and src untouched. Verify all required commands, unchanged 2,929 tests, and a reverted deliberate test type error. Commit per package, then commit return handoff, push this branch, and open a draft PR. No open questions. GBrain search for chordl/typecheck/0043 returned no task-specific guidance; repo spec/plan govern.
