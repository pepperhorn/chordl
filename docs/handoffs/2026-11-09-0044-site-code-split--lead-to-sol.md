# Handoff: 0044 — chordl.app: ship less JavaScript on first load (lead → sol)

- **Date:** 2026-11-09
- **Type:** dispatch
- **Ledger:** 0044 · **Spec:** docs/specs/0044-site-code-split.md · **Plan:** docs/plans/0044-site-code-split.md (T1)
- **Branch:** orch/0044-site-code-split · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** e86c52f
- **Port (if running a server):** 5640
- **Status:** open

## Goal
Implement plan T1: measure what the site ships on first load, move what the first screen doesn't need behind lazy boundaries in the site app, and re-measure. Target: at least 30% less gzipped JS on the first screen, or numbers that show why it can't be done from the site layer.

## Scope
- **In:** plan T1.
- **Out:** library `src/`, `vite.config.ts`, deploy and compression, new dependencies.
- **Files you own:** `packages/chordl-react/dev/**`, `packages/chordl-react/vite.site.config.ts`
- **Do not touch:** everything else. Report any library-level split opportunity with numbers instead.

## Acceptance criteria
- [ ] Spec AC1–AC4.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
- Measured 2026-11-09 from chordl.app: entry `index-*.js` is 1,124,814 B raw and 305 KB gzip. Lazy chunks that already exist: verovio-module 7.9 MB, verovio-fonts 879 KB, jspdf 391 KB, html2canvas 202 KB, jszip 98 KB.
- Any dev server or preview runs with `--host 0.0.0.0 --port 5640`.

## Open questions
None.

---
## Receiver ack
