# Plan 0043 — Type-check test files in every package

- **Spec:** ../specs/0043-typecheck-tests.md
- **Base:** main after 0042 and 0038 merge (spec written @ 23004d7)
- **Verification (whole item):** `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && pnpm lint:test`

## Approach
Use one task, because the root `package.json`, the lockfile and `ci.yml` are shared by every package. Add `tsconfig.test.json` to each package, then fix errors package by package in build order: voicings, core, listen, guitar, voicing, react, cards, board. Commit per package.

## Tasks

### T1 — tsconfig.test.json + lint:test + fixes
- **Depends on:** 0042 and 0038 merged
- **Route:** implement (default)
- **Owns:** `packages/*/tsconfig.test.json` (new), `packages/*/package.json` (scripts, plus `@types/node` devDependency), root `package.json` (`lint:test` script), `pnpm-lock.yaml`, `.github/workflows/ci.yml` (one step), `packages/*/test/**` (type-only fixes)
- **May read:** anything
- **Acceptance:** AC1–AC4
- **Notes / gotchas:** board's tsconfig uses `moduleResolution: bundler` on purpose (comment in the file). Keep it.

## Merge order
T1

## Risks
A large diff across test files. Keep every commit to one package so the review can read it package by package. CI change: the lead merges it only with the human's OK (AGENTS.md §5a).
