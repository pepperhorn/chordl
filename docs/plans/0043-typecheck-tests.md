# Plan 0043 — Type-check test files in every package

- **Spec:** ../specs/0043-typecheck-tests.md
- **Base:** main after 0042 and 0038 merge (spec written @ 23004d7)
- **Verification (whole item):** `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && pnpm lint:test`

## Approach
Two tasks, split so that T1 can run while 0045-t2 (#114) still owns board/react/cards test files. T1 adds the shared plumbing (root `lint:test` script that runs each package's `lint:test` where one exists, the CI step, and `@types/node`) and covers the five packages 0045-t2 doesn't touch. T2 adds react, cards and board once 0045-t2 has merged. Fix errors package by package in build order and commit per package.

## Tasks

### T1 — plumbing + voicings, core, listen, guitar, voicing
- **Depends on:** 0042, 0038, 0046 merged (all done; base 382678d)
- **Route:** implement (default)
- **Owns:** `packages/{chordl-voicings,chordl-core,chordl-listen,chordl-guitar,chordl-voicing}/tsconfig.test.json` (new), those five packages' `package.json` (`lint:test` script and `@types/node` devDependency only), their `test/**` (type-only fixes), root `package.json` (`lint:test` script), `pnpm-lock.yaml`, `.github/workflows/ci.yml` (one step after Lint)
- **Acceptance:** AC1–AC4 for these five packages. Root `pnpm lint:test` passes, running only packages that define `lint:test`.
- **Notes:** `packages/chordl-core/test/chord-resolver.test.ts:2` imports `../../chordl-cards/src/catalogue`. If that drags cards' sources into core's test type-check, say how you handled it.

### T2 — react, cards, board
- **Depends on:** T1 merged **and** 0045-t2 (#114) merged
- **Route:** implement (default)
- **Owns:** the same kinds of files for `chordl-react`, `chordl-cards` and `chordl-board`
- **Acceptance:** AC1–AC4 for all eight packages
- **Notes:** board's tsconfig uses `moduleResolution: bundler` deliberately (see the comment in the file); keep it.

## Merge order
T1 → T2

## Risks
A large diff across test files. Keep every commit to one package so the review can read it package by package. CI change: the lead merges it only with the human's OK (AGENTS.md §5a).
