# Handoff: 0052 — [quick] Release prep: chordl-core 0.6.3, chordl-react 0.5.3 notes (lead → sol)

- **Date:** 2026-11-10 · **Type:** quick · **Ledger:** 0052
- **Branch:** orch/0052-release-core-063 · **Worktree:** created by T3 · **Base commit:** 67f95a1
- **Status:** closed

## Goal
Prepare the next npm release. No code changes. `chordl-core` on main is still versioned 0.6.2, the same as npm (published 2026-11-09T02:25Z), but it has unpublished changes merged since then: #106 (0032), #110 (0038), #113 (0046) and #118 (0048). `chordl-react` 0.5.3 is unpublished, and #119 (0050) changed it without a CHANGELOG line. `chordl-board` 0.2.4 is unpublished and held for becreative (ledger 0047), but its CHANGELOG should still be accurate.
1. Bump `packages/chordl-core/package.json` to **0.6.3**, and add a `## 0.6.3` CHANGELOG entry covering the four core PRs: what a user notices, one line each. Read each PR's return handoff in `docs/handoffs/`.
2. Add #119's staff-marker line to `packages/chordl-react/CHANGELOG.md` under 0.5.3, and its board-side readiness line to `packages/chordl-board/CHANGELOG.md` under 0.2.4.
3. In the root `CHANGELOG.md`, add a release section following the existing style. Give the publish order `chordl-core@0.6.3` then `chordl-react@0.5.3`. Note that `chordl-board@0.2.4` is held until becreative's readiness change (0047). Also add a short "Consumers" note: `GuitarChord` now renders through a lazy boundary, so server-rendered HTML contains the loading placeholder, and consumers should wait for `data-chordl-state="ready"` rather than for an SVG to exist.

## Scope
- **Files you own:** `packages/chordl-core/package.json` (version only), `packages/chordl-core/CHANGELOG.md`, `packages/chordl-react/CHANGELOG.md`, `packages/chordl-board/CHANGELOG.md`, root `CHANGELOG.md`.
- **Do not touch:** anything else. Don't tag, publish or push tags. The lead does that with the human's approval.

## Acceptance criteria
- [ ] Versions: core 0.6.3, react 0.5.3, board 0.2.4.
- [ ] Each CHANGELOG line traces to a merged PR number.
- [ ] `node scripts/verify-board-package.mjs` and the verify command pass.

## Verify with
```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs
```
## Open questions
None.

---
## Receiver ack

Acknowledged by Sol, 2026-11-10. I will bump only chordl-core's package version to 0.6.3, document the four merged core PRs, add #119's React and board readiness notes, and prepare the root release/consumer guidance. I own the five listed files plus this acknowledgement and my return handoff. I will run the full specified verification, push only orch/0052-release-core-063, and open a draft PR. No tagging or publishing. No open questions.
