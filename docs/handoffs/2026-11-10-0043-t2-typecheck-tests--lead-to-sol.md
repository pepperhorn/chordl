# Handoff: 0043-t2 — Type-check test files: react, cards, board (lead → sol)

- **Date:** 2026-11-10
- **Type:** dispatch
- **Ledger:** 0043 · **Spec:** docs/specs/0043-typecheck-tests.md · **Plan:** docs/plans/0043-typecheck-tests.md (task T2)
- **Branch:** orch/0043-t2-typecheck-tests · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** 745bd30 (0043-t1 #115 and 0045-t2 #114 both merged)
- **Status:** open

## Goal
Plan T2: give chordl-react, chordl-cards and chordl-board each a `tsconfig.test.json` and a `lint:test` script, following T1's pattern. Root `pnpm lint:test` then covers all eight packages. Fix the existing test type errors with type-only changes. That includes the test files 0045-t2 just added: `chordl-board/test/on-demand.test.tsx`, `chordl-react/test/GuitarChord.lazy.test.tsx`, and the capture/readiness tests.

## Context you need
- T1's return handoff, `docs/handoffs/2026-11-09-0043-t1-typecheck-tests--sol-to-lead.md`, and its review (#115, 5824799412): use Bundler resolution and keep strict inherited. The spec's NodeNext counts (board 50, cards 22) include unresolved-import side effects, so count under the test config.
- chordl-board's tsconfig uses `moduleResolution: bundler` deliberately. Keep it.

## Scope
- **Files you own:** `packages/{chordl-react,chordl-cards,chordl-board}/tsconfig.test.json` (new); those three packages' `package.json` (`lint:test` script, plus `@types/node` as a devDependency only if needed); their `test/**` (type-only fixes); `pnpm-lock.yaml`.
- **Do not touch:** `src/`, except to export a type a test needs (justify each), root `package.json`, `ci.yml` (T1 already runs `lint:test` for every package that defines it), and other packages.

## Acceptance criteria
- [ ] Spec AC1–AC4 for all eight packages. For AC1, a planted wrong-argument plus wrong-property error fails `pnpm lint:test` in each of the three; then revert.
- [ ] Every test file is included (`--listFilesOnly`), with error counts before and after per package.
- [ ] The test count is unchanged (2,943 at base).

## Verify with
```bash
pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && pnpm lint:test && node scripts/verify-board-package.mjs
```

## Known gotchas / decisions already made
- `@types/node` is approved as a devDependency (S1/S5). Add no other dependency.
- Expect jsdom-specific typing in tests: NodeList iteration needs `DOM.Iterable`.

## Open questions
None.

---
## Receiver ack
