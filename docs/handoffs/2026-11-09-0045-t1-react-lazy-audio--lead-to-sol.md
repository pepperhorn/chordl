# Handoff: 0045-t1 — react: load smplr on demand (lead → sol)

- **Date:** 2026-11-09
- **Type:** dispatch
- **Ledger:** 0045 · **Spec:** docs/specs/0045-load-on-demand.md · **Plan:** docs/plans/0045-load-on-demand.md (task T1)
- **Branch:** orch/0045-t1-react-lazy-audio · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** dc6f8d2
- **Port (if running a server):** 5651
- **Status:** open

## Goal
Plan T1: `smplr` loads only when audio plays or a WAV export runs. Today wav-export imports it statically, which defeats `playback.ts`'s dynamic import. Also find out, without changing any export, whether `GuitarChordPanel` can load its datasets and SVGuitar on demand from inside chordl-react. Do it if it's clean; otherwise report numbers for T2.

## Scope
- **In:** plan T1.
- **Out:** chordl-board (T2), Verovio, deploy, new dependencies, public export changes.
- **Files you own:** `packages/chordl-react/src/audio/**`; `packages/chordl-react/src/components/GuitarChordPanel.tsx` and the modules only it imports, if you take the guitar part; `packages/chordl-react/test/**` for those areas; `packages/chordl-react/package.json` (version only); `packages/chordl-react/CHANGELOG.md`.
- **Do not touch:** anything else.

## Acceptance criteria
- [ ] Spec AC2 (smplr; plus guitar if taken), AC5.
- [ ] The Vite "statically and dynamically imported" warning for smplr is gone from `build:site`. Paste both build outputs.
- [ ] Entry chunk size before and after (0044 method).

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs
```

## Known gotchas / decisions already made
- 0044's return handoff, `docs/handoffs/2026-11-09-0044-site-code-split--sol-to-lead.md`, has the measurement method and composition.
- Test budgets are 30s / waitFor 5s (#107, #108).

## Open questions
None.

---
## Receiver ack
