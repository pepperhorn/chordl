# 0043 — Type-check test files in every package

- **Status:** approved (human accepted suggestions S1 + S5, 2026-11-09)
- **Ledger:** 0043 · **Plan:** ../plans/0043-typecheck-tests.md
- **Author:** lead · **Date:** 2026-11-09

## Problem
No package type-checks its tests. Each `tsconfig.json` has `include: ["src"]`, and most also `exclude: ["test"]`. `lint` is `tsc --noEmit` on that config, and CI (`.github/workflows/ci.yml`) runs only `pnpm lint`. Vitest strips types without checking them. A scratch `tsc` over src+test on 2026-11-09 found **50 errors in chordl-board** (e.g. `test/board-editor-instrument-words.test.tsx:96`, `test/board-player.test.tsx:81`), **55 in chordl-core** and **22 in chordl-cards**, with 0 in chordl-react; the other packages weren't counted. A stale call with the wrong number of arguments has already slipped through review this way.

## Goals
- Every package with a `test/` directory has a `tsconfig.test.json` that type-checks `src` + `test`, and a `lint:test` script.
- Root `lint:test` runs them all; CI runs it after `Lint`.
- All existing test type errors are fixed. Fixes are type-only: tests keep asserting the same behaviour.

## Non-goals
- Changing build output: the build `tsconfig.json` files keep emitting only `src`.
- Behaviour changes, test rewrites, or untangling `chordl-core/test/chord-resolver.test.ts:2` importing `../../chordl-cards/src/catalogue` (record it if it blocks).
- render-cli tests (it has none).

## Constraints
- `tsconfig.test.json` extends the package's `tsconfig.json` with `noEmit`, adds `test`, and adds the libs/types tests need (`DOM.Iterable`, `@types/node` where tests use Node APIs).
- `@types/node` as a devDependency is approved under this item. Add nothing else without asking.
- Sequenced after 0042 (lockfile) and 0038 (`chordl-core/test/natural-language.test.ts`). Branch from main once both are merged.

## Acceptance criteria
- [ ] AC1 — `pnpm lint:test` exits 0 at the root; a deliberate type error added to any package's test file makes it fail (show one).
- [ ] AC2 — CI runs `pnpm lint:test`.
- [ ] AC3 — `git diff --stat main` under `src/` is empty, or each `src` change is justified (an exported type a test needs).
- [ ] AC4 — verify command passes with no change to the test count (2,819 at spec time, plus whatever 0038 adds).

## Open questions
None.
