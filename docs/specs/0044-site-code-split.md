# 0044 — chordl.app: ship less JavaScript on first load

- **Status:** approved (human chose code-splitting over brotli, 2026-11-09)
- **Ledger:** 0044 · **Plan:** ../plans/0044-site-code-split.md
- **Author:** lead · **Date:** 2026-11-09

## Problem
The chordl.app site (`pnpm --filter @pepperhorn/chordl-react build:site` → `packages/chordl-react/site-dist`) ships one 1.12 MB entry chunk, `index-*.js` (305 KB gzipped from production; 2.1s cold over this machine's link, measured 2026-11-09). Some heavy pieces are already lazy chunks: verovio-module 7.9 MB, verovio-fonts 879 KB, jspdf 391 KB, html2canvas 202 KB, jszip 98 KB. Nobody knows what the entry chunk contains, or which of the lazy chunks the default first screen pulls in anyway.

Production already gzips via nginx (Railpack deploy, #97). Brotli was considered and set aside for now (it would save ~25%).

## Goals
- Measure first: entry-chunk composition by module or package, plus the JS actually requested to render the default first screen, with no interaction.
- Cut the default first screen's JS (gzipped) by at least 30%, or explain with numbers why that isn't reachable from the site layer.
- No user-visible behaviour change, other than a short loading state where a lazy part first appears.

## Non-goals
- Brotli, Docker or Coolify changes.
- Changing the published library's exports or behaviour (`packages/chordl-react/src`, `vite.config.ts`). If the best split needs a library change, report it with numbers for a follow-up.
- New runtime dependencies. Measurement tooling is fine via `npx` or a script, but nothing added to package.json.

## Constraints
- Lazy boundaries go in the site app (`dev/`) with `React.lazy` / dynamic `import()`, or in `vite.site.config.ts` (`build.rollupOptions.output.manualChunks`).
- Any loading fallback uses Poppins and the house style, with contextual class names alongside utilities.

## Acceptance criteria
- [ ] AC1 — Before/after table: entry chunk raw and gzip bytes, total gzipped JS requested for the default first screen, chunk list. Say how it was measured: a headless browser request log against `vite preview` (bind `--host 0.0.0.0`, port 5640), or a reasoned static import trace if no browser is available.
- [ ] AC2 — First-screen gzipped JS is down at least 30%, or there's a written justification with the composition numbers.
- [ ] AC3 — The site still works: `build:site` passes, and a smoke check of the main flows (type a chord, switch to the notation view, export) loads the lazy parts without errors. Say whether this was checked in a real browser.
- [ ] AC4 — The verify command passes.

## Open questions
None.
