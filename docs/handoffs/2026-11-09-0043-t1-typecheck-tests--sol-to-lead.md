# Handoff: 0043-t1 — Type-check test files (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0043-t1 · **Spec:** [0043](../specs/0043-typecheck-tests.md) · **Plan:** [0043 T1](../plans/0043-typecheck-tests.md)
- **Dispatch/ack:** [lead → sol](2026-11-09-0043-t1-typecheck-tests--lead-to-sol.md)
- **Branch:** orch/0043-t1-typecheck-tests
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-343f4392
- **Base commit:** 382678d (implementation starts after dispatch docs at 9e3e270)
- **PR:** https://github.com/pepperhorn/chordl/pull/115 (draft)
- **Status:** closed

## Goal
Enable test type-checking for voicings, core, listen, guitar and voicing, with root and CI plumbing; preserve runtime behaviour, assertions and the baseline test count.

## Context you need
The linked spec/plan and dispatch define T1. T2 will add react/cards/board after T1 and 0045-t2 merge. CI changes require the human's merge approval.

## Scope
- **In / files owned:** Five packages' new tsconfig.test.json, package.json lint:test and approved Node devDependency, type-only test/** fixes; root package.json lint:test, pnpm-lock.yaml and CI's step after Lint; this task's two handoffs.
- **Out / do not touch:** Production src/ and build configs; board/react/cards; other docs, dependencies and ledger.
- **Scope audit:** No src/ changes; no board/react/cards changes. Package-by-package commits; only owned files changed.

## Acceptance criteria
- [x] AC1: Root lint:test checks the five packages; deliberate string-to-number error in voicings/test/locked-hands.test.ts:59 produced TS2322 and root exit 2, then original file restored byte-for-byte.
- [x] AC2: CI runs pnpm lint:test immediately after Lint.
- [x] AC3: No src/ changes.
- [x] AC4: Full verification and unchanged 2,929 test count (results below).

## Verify with
```bash
pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && pnpm lint:test
```

## Known gotchas / decisions made
- Test configs use ESNext/Bundler resolution, matching Vitest's extensionless and JSON imports. The strictness flags remain inherited; production NodeNext build configs are unchanged.
- Core's existing ../../chordl-cards/src/catalogue import is retained. Its test-only rootDir is ../.. to avoid TS2209's ambiguous export-map project root when cards sources import core. --listFilesOnly confirms cards/src/catalogue.ts is checked. No cards file was changed and cards tests remain outside T1.
- Guitar alone adds @types/node ^22.0.0 (already used by voicing); the lockfile only adds its importer entry resolving existing 22.19.17. No other dependency changed.
- Core's flatMap now declares [string, Partial<ReturnType<typeof parseChordDescription>>] tuples, preserving every test row/assertion.
- Voicing's delete fixture has an optional numeric toString property; its schema access uses a type-only import of the existing JSON schema shape. No runtime import or assertion changed.
- GBrain searched for chordl and typecheck/0043; no task-specific guidance found. No GBrain writes by implementer; lead may promote the notes below.

## Error counts before / after
Counts measured with final test-config resolution, before type-only fixes / approved Node types:

| Package | Before | After |
| --- | ---: | ---: |
| chordl-voicings | 0 | 0 |
| chordl-core | 2 | 0 |
| chordl-listen | 0 | 0 |
| chordl-guitar | 4 | 0 |
| chordl-voicing | 2 | 0 |

An earlier inherited NodeNext probe produced extension/JSON import errors and core TS2209; those configuration errors are excluded from the counts above. Counts are current at this base, rather than the older scratch counts in the spec.

## Verification output
All commands exited 0 (install/build first, then lint/tests/site/lint:test; frozen install repeated after the approved dependency was added).

```text
pnpm install --frozen-lockfile: exit 0
pnpm build: exit 0
pnpm lint: exit 0
pnpm test:run: exit 0
  voicings: 9 files, 176 passed
  core: 16 files, 694 passed
  listen: 1 file, 13 passed
  guitar: 19 files, 337 passed
  voicing: 9 files, 161 passed
  react: 50 files, 389 passed
  cards: 26 files, 822 passed
  board: 26 files, 337 passed
  Total: 156 files, 2,929 passed (unchanged)
pnpm --filter @pepperhorn/chordl-react build:site: exit 0; built in 5.74s
pnpm lint:test: exit 0; five packages Done
Deliberate type error: TS2322, root exit 2; reverted, final lint:test exit 0
git diff --check main...HEAD: exit 0
Production src/ diff: empty
```

Non-failing warnings: API Extractor bundles TypeScript 5.8.2 versus workspace 5.9.3; site chunk sizes exceed 500 kB; jsdom reports unsupported navigation in passing UI tests. Local logs: /tmp/0043-{install-final,build-initial,lint,tests,site,lint-test-final,deliberate-error}.log. No CI/review result claimed.

## Open questions
None.

## Return (implementer → lead)
- **Outcome:** done
- **Code commits:** ad404b4 through d8a2e85; receiver acknowledgement fca8a19.
- **What changed:** Five strict no-emit test configs/scripts, recursive root script that skips packages without lint:test, CI test type-check step, guitar Node types, three test files with type-only fixes.
- **Out-of-scope issues found:** None requiring code changes.
- **Follow-ups:** Review this draft PR; human merge approval for CI; T2 remains required for react/cards/board.
- **For GBrain (lead to promote):** Vitest test checking needs Bundler resolution for existing imports. Core's cross-package catalogue fixture needs an explicit repository rootDir in its no-emit config. @types/node in guitar is a direct test dependency, not reliance on hoisting.
