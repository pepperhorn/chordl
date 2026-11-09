# Handoff: 0045-t2 — board: no idle Verovio prefetch, lazy guitar, loading/ready markers (lead → sol)

- **Date:** 2026-11-09
- **Type:** dispatch
- **Ledger:** 0045 · **Spec:** docs/specs/0045-load-on-demand.md · **Plan:** docs/plans/0045-load-on-demand.md (task T2, read its "Notes (added after T1)")
- **Branch:** orch/0045-t2-board-on-demand · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** 024825e (T1 #112 merged: smplr is lazy, chordl-react 0.5.2)
- **Port (if running a server):** 5652
- **Status:** open

## Goal
Plan T2, which completes 0045's spec:
1. **Verovio:** remove the idle prefetch branch in `packages/chordl-board/src/BoardEditor.tsx` (~757–762). Keep the `needsStaffNow` immediate load and the Display toggle's `warmNotation` pointer/focus warm-up (~120).
2. **Guitar:** add an internal lazy boundary in chordl-react so SVGuitar and the guitar datasets load on the first guitar render. `GuitarChord` and `GuitarChordPanel` keep their export names and props.
3. **Markers:** add loading and ready markers per the spec's readiness constraint, with tests.
4. **Measure:** re-measure the whole item against the spec's targets.

## Context you need
- T1's return handoff, `docs/handoffs/2026-11-09-0045-t1-react-lazy-audio--sol-to-lead.md`: entry composition and the guitar finding.
- 0044's return handoff, `docs/handoffs/2026-11-09-0044-site-code-split--sol-to-lead.md`: the baseline numbers and the request-log method.
- #101's error marker: `chordl-board-card-error` / `data-chordl-state="error"` in `ChordBoard.tsx` (~349).

## Scope
- **In:** plan T2.
- **Out:** Verovio's payload, deploy, new dependencies, removing or renaming exports, the parser (0046 is running on core).
- **Files you own:** `packages/chordl-react/src/components/GuitarChord.tsx`, `packages/chordl-react/src/components/GuitarChordPanel.tsx` (plus a new internal module beside them if needed), `packages/chordl-board/src/BoardEditor.tsx`, `packages/chordl-board/src/ChordBoard.tsx`, `packages/chordl-board/src/BoardPlayer.tsx`, `packages/chordl-board/test/**`, `packages/chordl-react/test/**` (guitar tests only), version-only bumps in `packages/chordl-react/package.json` and `packages/chordl-board/package.json`, and both packages' `CHANGELOG.md`.
- **Do not touch:** everything else.

## Acceptance criteria
- [ ] Spec AC1–AC5. AC1 uses 0044's no-interaction request-log method, compared against the 0044 baseline (no-interaction JS 3,181,037 B gzip; entry 278,573 B gzip). Targets: no-interaction JS ≤ 50% of baseline, entry ≥ 30% smaller.
- [ ] Prove with a bundle check that guitar code is no longer in the entry chunk (T1 review suggestion).
- [ ] AC4: in the return handoff, describe exactly what becreative should key on. The ready-state and loading markers are additive.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs
```

## Known gotchas / decisions already made
- Board imports `PianoChord` from the same chordl-react entry, so a `React.lazy` in board can't split guitar. The boundary goes inside react.
- Test budgets are 30s, and `waitFor` is 5s.
- The human chose "load on demand": a short loading state on first notation or guitar use is accepted.

## Open questions
None.

---
## Receiver ack
