# 0045 — Load notation, guitar and audio code on demand

- **Status:** approved (human chose "load on demand" for suggestion S16, 2026-11-09)
- **Ledger:** 0045 · **Plan:** ../plans/0045-load-on-demand.md
- **Author:** lead · **Date:** 2026-11-09

## Problem
0044 (#111) measured chordl.app's first visit with no interaction, and the 0044 r1 review re-derived the numbers:
- **Verovio:** `BoardEditor.tsx:757-762` calls `prefetchVerovioWhenIdle()` whenever no card shows notation. The three Verovio chunks (~2.9 MB gzipped, 91% of first-visit JS) load within ~1.5 s on the default piano screen. The comment there assumes most visitors never leave the keyboard view, yet we pay for notation on every visit.
- **Guitar:** `ChordBoard.tsx:3` statically imports `GuitarChordPanel`, so guitar datasets and SVGuitar are ~51% of the 1.1 MB entry chunk even in piano view.
- **Audio:** `chordl-react/src/audio` wav-export statically imports `smplr`, which defeats `playback.ts`'s dynamic import (Vite warns about this).

## Goals
- No idle Verovio prefetch. Verovio loads when a card first needs notation. Keep the existing warm-up on the Display toggle's pointer/focus (`BoardEditor.tsx:120`, `warmNotation`), and the immediate load when a card already shows staff (`needsStaffNow`).
- Guitar rendering (`GuitarChordPanel` with its datasets and SVGuitar) loads only when a guitar-family card renders.
- `smplr` loads only when audio plays or a WAV export runs.
- Re-measure with 0044's method: target the default first screen at ≤ 50% of today's no-interaction JS (gzip), and the entry chunk ≥ 30% smaller.

## Non-goals
- Brotli and deploy changes, Verovio's own payload (fonts subset etc.), new dependencies.
- Removing or renaming any public export. `prefetchVerovio` / `prefetchVerovioWhenIdle` stay exported for consumers who want them.

## Constraints
- **Readiness for downstream PDF consumers (becreative).** Every lazy boundary renders a loading fallback that can't be mistaken for a rendered card: no `<svg>`, class `chordl-board-card-loading` and `data-chordl-state="loading"`, mirroring the error marker from #101 (`chordl-board-card-error`, `data-chordl-state="error"`). If the existing ready state carries no marker, add `data-chordl-state="ready"` on the rendered card root. Changes to these markers are additive only.
- Lazy loading must not break SSR or tests in jsdom. Tests that render guitar or notation must still pass, awaiting the lazy part where needed (budgets are 30s, #107/#108).
- Package bumps: patch or minor versions for chordl-react and chordl-board, with CHANGELOG lines.
- Loading fallbacks follow the house style: Poppins, and contextual class names alongside utilities.

## Acceptance criteria
- [ ] AC1 — Before/after table using 0044's method (`vite preview` on port 5650, headless browser request log, gzip level 6): entry raw and gzip, plus no-interaction JS. Targets per Goals, or a justified miss.
- [ ] AC2 — The three behaviours above are covered by tests: no Verovio request without notation; guitar chunk only with a guitar card; smplr only on play/export. Mock the dynamic imports and assert on calls.
- [ ] AC3 — Browser smoke in headless Chromium: piano default, switch to notation, add a guitar card, play audio, WAV/zip export, PDF export. All work, and each lazy part loads at its first use.
- [ ] AC4 — The loading and ready markers are in place and tested. A note in the return handoff says what becreative needs to change, if anything.
- [ ] AC5 — The verify command passes, plus `node scripts/verify-board-package.mjs`.

## Open questions
None.
