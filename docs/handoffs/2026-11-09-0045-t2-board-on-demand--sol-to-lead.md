# Handoff: 0045-t2 — load notation and guitar on demand (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0045-t2 · **Spec:** [0045](../specs/0045-load-on-demand.md) · **Plan:** [T2](../plans/0045-load-on-demand.md)
- **Dispatch:** [lead → sol](2026-11-09-0045-t2-board-on-demand--lead-to-sol.md)
- **Branch:** orch/0045-t2-board-on-demand
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-c5320047
- **Base:** b4b8f3d (contains pinned 024825e)
- **Acknowledgement:** b1f5fe4
- **Implementation:** 3bc9ddb
- **PR:** draft against main; linked by the final delivery and PR body
- **Port:** 5652 (handoff allocation; spec's 5650 belongs to the whole item)
- **Status:** blocked

## Goal / scope
Complete spec AC1–AC5: eliminate idle notation requests, defer guitar code/data until rendering, retain exports/props and explicit Display warm-up, expose tested readiness markers, measure initial JS, and verify the workspace and browser first-use flows.

Owned files: GuitarChord.tsx, GuitarChordPanel.tsx and new internal modules beside them; BoardEditor.tsx, ChordBoard.tsx, BoardPlayer.tsx; board tests; React guitar tests; version-only changes in React/board package manifests and their changelogs; this task's two handoffs. No edits outside this scope. Parser, dependencies, deployment, publication, main and ledger untouched.

## Outcome: partial, blocked on ownership
Implementation is committed and scoped tests pass. Full verification fails at **packages/chordl-cards/test/ChordCardPlayer.test.tsx:160**, which synchronously expects `.chord-card-player .bc-guitar-chord svg` immediately after rendering. The new public GuitarChord lazy boundary correctly renders its loading fallback first. That test must await SVG/readiness, as the spec anticipates for guitar tests, but chordl-cards tests are **outside Files you own**. Per AGENTS.md §7, stopped implementation and left this file untouched.

**Open question for lead:** expand ownership to that test file (or assign a separate task) to await guitar rendering, then rerun the complete verify command and finish AC3's browser smoke. No production workaround or test-only eager path was introduced to satisfy a synchronous assertion.

## What changed / decisions made
- GuitarChord and GuitarChordPanel retain their exports and complete original prop interfaces. Each is now a small Suspense wrapper around an internal implementation module. The lazy panel imports the implementation renderer directly, avoiding another render-time import waterfall. SVGuitar and chordl-guitar datasets are outside the initial site entry.
- Loading fallbacks have no SVG, `chordl-board-card-loading`, `data-chordl-state="loading"`, contextual classes, role=status, and Poppins styling. The guitar renderer marks its root loading → ready only after its existing paint cycle. Drawing failure gets error, never ready.
- Existing detailed guitar unit tests exercise implementations directly; a new public-wrapper integration test checks import timing, SSR fallback, no false readiness, actual ready SVG and draw failure.
- BoardEditor no longer imports/calls prefetchVerovioWhenIdle. The needsStaffNow effect and Display pointer/focus warm-up remain. Tests assert no piano mount warm-up and immediate loading for persisted staff cards.
- ChordBoard's shared BoardCardContent is also used by BoardPlayer, so player needed no edit. Piano/text rendered roots gain ready markers. For notation, the existing renderer emits SVG loading placeholders; an internal observer checks all staff engravings rather than treating any SVG as ready. It exposes a separate SVG-free loading status while the in-progress render is hidden. No StaffNotation/public API edits were needed.
- Versions: chordl-react 0.5.2 → 0.5.3, chordl-board 0.2.3 → 0.2.4, changelogs added/updated.

## Acceptance / measurements
AC1 targets pass in the completed cold-load measurement. AC2 notation/guitar tests pass (smplr tests came from T1). AC4 markers tested. AC3 first-use browser smoke remains incomplete after stopping for the ownership blocker; AC5 is blocked by the cards test.

Same [0044 method](2026-11-09-0044-site-code-split--sol-to-lead.md): local `build:site --sourcemap`, production `vite preview --config vite.site.config.ts --host 0.0.0.0 --port 5652`, clean headless Chromium context, service workers blocked, 1280×800 viewport, empty/default board and no interaction for 12 seconds. Request log collected actual requested JS paths, then Python gzip level 6 with mtime=0 normalized built-file payload sizes. These measure local payload, not production wire compression or latency.

| Metric, bytes | 0044 baseline | This implementation | Reduction |
|---|---:|---:|---:|
| Entry raw | 1,109,387 | 465,595 | 58.03% |
| Entry gzip | 278,573 | 147,487 | 47.06% |
| All no-interaction requested JS gzip | 3,181,037 | 147,487 | 95.36% |

Only `/assets/index-DNS7UQOD.js` requested during the cold-load interval; zero page errors. No Verovio, guitar, sampler or optional export JS requested. Node's gzip in the request-log helper reported 147,488 bytes; the table uses Python gzip consistently with 0044 (147,487 bytes).

Bundle check: entry sourcemap contains **zero** SVGuitar/chordl-guitar sources. `GuitarChordImpl-CTDW2u5L.js` contains SVGuitar; `GuitarChordPanelImpl-D8tdO0cc.js` contains instruments.js, top3Generated.js and lookup/selection code. Both absent from the no-interaction log. This closes the T1 reviewer bundle-graph suggestion.

## Downstream becreative readiness (AC4)
Do not accept the existence of any SVG as completion: notation has an SVG shell while downloading, guitar has a drawing/paint phase, and boards can contain toolbar icons/text cards. For each expected card, wait for a rendered content root with `data-chordl-state="ready"`, and ensure **no loading or error state remains anywhere in that card**. Guitar's ready root is `.bc-guitar-chord`; notation's is `.chordl-board-card-notation`; piano's is `.chordl-board-card-piano`; text's is `.chordl-board-card-text`. Treat `.chordl-board-card-loading` / state=loading as pending, state=error as failure, and apply a bounded timeout for malformed or unavailable content. Existing `.chordl-board-card-error` / state=error behavior is preserved. These are additive markers; becreative should replace SVG-only readiness checks with this rule. No downstream edits made.

## Verification
Required command:
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs
```

- Frozen install: pass; lockfile unchanged.
- `pnpm build`: pass (after fixing an implementation type import during development).
- `pnpm lint`: pass.
- `pnpm test:run`: **FAIL** in the out-of-scope cards test above. Prior packages pass: voicings 176; core 685; listen 13; guitar 337; voicing 161; React 391 (51 files). Cards: 821 pass / 1 fail (26 files); pipeline stops before board/site/package.
- Independent `pnpm --filter @pepperhorn/chordl-react exec vitest run Guitar`: 8 files / 70 tests pass.
- Independent `pnpm --filter @pepperhorn/chordl-board test:run`: 27 files / 341 tests pass, including 4 new on-demand/readiness tests.
- Sourcemap `build:site`: pass, 31.75s; entry/guitar graph verified above.
- Normal `build:site` and packed consumer verification: final results below.
- `git diff --check`: pass; scope audit: only listed ownership and own handoffs changed relative to base/main.

Initial targeted command used `test:run -- Guitar`, which runs the whole React suite and caught transient pre-build artifacts during development; final targeted and full React tests above pass. Expected jsdom navigation-not-implemented stderr and Vite Verovio node:module/large-chunk warnings are non-fatal.

## Browser / remaining gates
Shared preview attempts returned `net::ERR_CONNECTION_REFUSED` while site-dist was still building; switched to local headless Chromium after two failures. Cold-load request log and default piano render completed successfully. Stopped before the remaining switch-to-notation, add guitar, audio play, WAV/ZIP and PDF browser flows due to the ownership blocker. No production or physical audio/device verification claim.

## Known gotchas / follow-ups / for GBrain (lead to promote)
GBrain searched for chordl/0045 load-on-demand; no relevant page returned, so no GBrain page used. Implementer writes no GBrain updates. Useful lesson: cross-package tests asserting synchronous guitar SVG must await the new internal public-component lazy boundary; card consumers cannot assume SVG existence implies readiness. Lead should promote this only after completion/review.

Next: resolve the cards-test ownership, finish verification and browser smoke, then cross-family review. No PR watch or polling started.

## Final independent verification tail
```text
Normal build:site: ✓ built in 24.05s (restores normal output without maps)
Packed editor/player SSR, exports and scoped stylesheet pass.
Packed consumer typecheck and Vite build pass: /tmp/chordl-board-consumer-qOGE3J
Board: Test Files 27 passed; Tests 341 passed
React: Test Files 51 passed; Tests 391 passed
Cards: Test Files 1 failed | 25 passed; Tests 1 failed | 821 passed
```
