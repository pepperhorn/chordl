# Handoff: 0045-t2 — load notation and guitar on demand (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0045-t2 · **Spec:** [0045](../specs/0045-load-on-demand.md) · **Plan:** [T2](../plans/0045-load-on-demand.md)
- **Dispatch:** [lead → sol](2026-11-09-0045-t2-board-on-demand--lead-to-sol.md)
- **Branch:** orch/0045-t2-board-on-demand
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-c5320047
- **Base:** a7faf17 (contains pinned 024825e)
- **Acknowledgement:** b1f5fe4
- **Implementation:** 3bc9ddb
- **PR:** https://github.com/pepperhorn/chordl/pull/114 (draft against main)
- **Port:** 5652 (handoff allocation; spec's 5650 belongs to the whole item)
- **Status:** closed (done)

## Goal / scope
Complete spec AC1–AC5: eliminate idle notation requests, defer guitar code/data until rendering, retain exports/props and explicit Display warm-up, expose tested readiness markers, measure initial JS, and verify the workspace and browser first-use flows.

Owned files: GuitarChord.tsx, GuitarChordPanel.tsx and new internal modules beside them; BoardEditor.tsx, ChordBoard.tsx, BoardPlayer.tsx; board tests; React guitar tests; cards/test/ChordCardPlayer.test.tsx (ownership expanded by lead answers 847d236); version-only changes in React/board package manifests and their changelogs; this task's two handoffs. No edits outside this scope. Parser, dependencies, deployment, publication, main and ledger untouched.

## Outcome: done
AC1–AC5 complete. The lead resolved the previous cards-test ownership blocker in [answers at 847d236](https://github.com/pepperhorn/chordl/blob/847d236/docs/handoffs/2026-11-09-0045-t2-board-on-demand--lead-answers.md). Public guitar rendering assertions now await readiness; the requested first-render playback timing regression passes without changing ChordCardPlayer.tsx. Full verification and AC3 evidence are below.

## What changed / decisions made
- GuitarChord and GuitarChordPanel retain their exports and complete original prop interfaces. Each is now a small Suspense wrapper around an internal implementation module. The lazy panel imports the implementation renderer directly, avoiding another render-time import waterfall. SVGuitar and chordl-guitar datasets are outside the initial site entry.
- Loading fallbacks have no SVG, `chordl-board-card-loading`, `data-chordl-state="loading"`, contextual classes, role=status, and Poppins styling. The guitar renderer marks its root loading → ready only after its existing paint cycle. Drawing failure gets error, never ready.
- Existing detailed guitar unit tests exercise implementations directly; a new public-wrapper integration test checks import timing, SSR fallback, no false readiness, actual ready SVG and draw failure.
- BoardEditor no longer imports/calls prefetchVerovioWhenIdle. The needsStaffNow effect and Display pointer/focus warm-up remain. Tests assert no piano mount warm-up and immediate loading for persisted staff cards.
- ChordBoard's shared BoardCardContent is also used by BoardPlayer, so player needed no edit. Piano/text rendered roots gain ready markers. For notation, the existing renderer emits SVG loading placeholders; an internal observer checks all staff engravings rather than treating any SVG as ready. It exposes a separate SVG-free loading status while the in-progress render is hidden. No StaffNotation/public API edits were needed.
- Versions: chordl-react 0.5.2 → 0.5.3, chordl-board 0.2.3 → 0.2.4, changelogs added/updated.

## Acceptance / measurements
AC1 targets pass in the completed cold-load measurement. AC2 notation/guitar tests pass (smplr tests came from T1). AC3 first-use browser flows pass below. AC4 markers tested. AC5 full verification passes below.

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

## Lead answers response
- Read the exact answers via `git fetch origin && git show 847d236:docs/handoffs/2026-11-09-0045-t2-board-on-demand--lead-answers.md` before resuming. Expanded scope only to the granted cards test file.
- All cards tests reading guitar SVG now wait for `.bc-guitar-chord[data-chordl-state="ready"] svg`, covering guitar/top3, ukulele, bass4 and alternate positions. No eager test path.
- Added a first-render playback regression, before any guitar rendering in that test file: assert the lazy loading fallback and no guitar SVG, click Play immediately, hold requestAnimationFrame callbacks and the audio clock, confirm the sound is scheduled before paint readiness, then finish drawing/paint and confirm the three sounding strings still have their targets and active state. Uses Dm's three fretted top strings so every checked target is a finger marker. Targeted cards file: 26 tests pass.
- **ChordCardPlayer.tsx untouched:** playback highlight strings are controlled props and survive the deferred render. No timing bug reproduced, so no readiness observer or production fix was necessary.
- Strengthened the board readiness test with controlled staff completion: a real-engine version exceeded the 5s wait under suite load. The test now models SVG loading shells and completes one staff, then both, asserting partial engraving cannot become ready. No test budget was raised; the browser smoke covers the real engine.
- AC3 completed using the shared server Chromium preview at port 5652. The previous turn's startup failures did not recur once the site build existed. Preview tab closed after smoke.

## Browser smoke and first-use request log (AC3)
Built production site, Chromium viewport 1280×800. Initial idle stayed piano-only for over 50 seconds with just the entry JS; typed Dm7, then used the actual Display toggle, Add to board, playback, ZIP menu and PDF button. Resource timing below is navigation-relative milliseconds, **not** a latency benchmark. Every listed local request succeeded; no console errors in the smoke snapshots. Verovio emitted its existing no-MEI-header warning. No deployment or physical audio-device claim.

New JS requests at each step (all local paths under `/assets/` unless shown):
```text
Piano default / idle:
       40  index-DNS7UQOD.js
  No Verovio, guitar, sampler or export chunks before interaction.

Display Diagram → Both (first notation use; two staff engravings rendered):
    52056  verovio-module-uZWmuYwk.js
    52056  verovio-wycgSLAY.js
    52056  verovio-fonts.generated-D-aR87HZ.js

Display Both → Notation → Guitar (first guitar use; ready SVG rendered):
    79554  index-B6g8TRjT.js
    79557  ChordSheet-BNxYvBWX.js
    79585  GuitarChordPanelImpl-D8tdO0cc.js
    79585  GuitarChordImpl-CTDW2u5L.js
  The editor's existing dynamic public-entry import also loads its barrel /
  ChordSheet chunk. Heavy guitar rendering/data remain deferred until this step.

Add guitar card to board:
  No additional JS; one .chordl-board-card-guitar ready SVG confirmed.

Play block guitar chord:
   123944  index-BEDsmYX1.js (smplr)
   124004  https://gleitz.github.io/midi-js-soundfonts/MusyngKite/electric_guitar_clean-ogg.js
  Playback observer saw active physical strings "2 3 4 5".

Guitar ZIP → This (first archive export):
   157174  jszip.min-C_r_0eE0.js
   157337  https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_grand_piano-ogg.js
   158957  same piano sample URL (second offline WAV render)
  smplr already loaded by Play, so no repeated sampler chunk request.

Board PDF (first PDF export):
   158986  html2canvas.esm-QH1iLAAe.js
   160954  jspdf.es.min-D9d5TKvo.js
```

Downloads verified from actual browser files:
- `Dm7.zip`, 1,003,548 bytes: CRC check passes; Dm7.svg (4,649 B), Dm7.png (31,562 B), Dm7.mid, Dm7_chord.wav and Dm7_arpeggio.wav. SVG and PNG signatures valid. Both WAVs decode as stereo, 44,100 Hz PCM, 110,250 / 131,418 frames with nonzero peaks 6,756 / 5,226. This preserves existing export timbre behavior (offline WAV currently requests the piano sample).
- `chord-board.pdf`, 15,893 bytes: valid PDF 1.3, one page; pdfimages confirms a 1280×594 rendered-board image. PDF button returned idle and no card loading markers remained.
- Browser-reported transient ZIP / PDF paths were respectively under `/home/shaun/.t3/userdata/server-browser/downloads/793f6f4b8c93e57385b12d19a8464e3d7f617d1e98645a86214f9cfe266ea083/`: `9fe6a7f2-c2e0-4827-b4c5-57bd348d0594` and `e7c407fe-1b6d-4f7a-ab18-8d6537962c17`. Downloads were inspected before tab closure; the preview removes those transient files when its tab closes.

## Verification (AC5)
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs
```

Full command output tail is appended below. The previous turn's cards assertion failure is resolved. An initial resumed run hit the pre-existing core catalogue timeout at test/chord-resolver.test.ts:314 (5s); unchanged rerun passed core and cards, then exposed the board readiness test's real-engine wait. That test was made deterministic as above, then the complete command rerun. Frozen install previously passed, lockfile unchanged. Only owned code/tests and this task's own handoffs differ from base; `git diff --check` passes. Expected API Extractor TypeScript-version notices, jsdom navigation stderr, Vite Verovio node:module/large-chunk warnings remain non-fatal.

## Known gotchas / follow-ups / for GBrain (lead to promote)
GBrain searched for chordl/0045 load-on-demand; no relevant page returned, so no GBrain page used. Implementer writes no GBrain updates. Useful lesson: cross-package tests asserting synchronous guitar SVG must await the new internal public-component lazy boundary; card consumers cannot assume SVG existence implies readiness. Separate pre-existing follow-up found while designing the timing test: SVGuitar open-string circles do not retain finger className (C top3 open strings 3/5 have open-string-* classes but lack bc-playback-string-*); the timing regression uses fretted Dm markers. This is not a lazy timing regression, and the conditionally owned ChordCardPlayer.tsx remains untouched. Lead should promote this only after completion/review.

Next: cross-family review by lead. No PR watch or polling started.

## Final verification output
Full required command passed, exit 0, after the fixes above. Workspace: **158 files / 2,927 tests**.
```text
pnpm build: PASS
pnpm lint: PASS
pnpm test:run: PASS
voicings: Test Files 9 passed; Tests 176 passed
core: Test Files 16 passed; Tests 685 passed
listen: Test Files 1 passed; Tests 13 passed
guitar: Test Files 19 passed; Tests 337 passed
voicing: Test Files 9 passed; Tests 161 passed
react: Test Files 51 passed; Tests 391 passed
cards: Test Files 26 passed; Tests 823 passed
board: Test Files 27 passed; Tests 341 passed
build:site: ✓ built in 10.59s
Packed editor/player SSR, exports and scoped stylesheet pass.
Packed consumer typecheck and Vite build pass: /tmp/chordl-board-consumer-TS4Yjn
```
Final board-only lint and full board suite also pass (27 files / 341 tests, 10.86s) after explicitly awaiting MutationObserver microtasks between the partial/complete staff updates. Targeted readiness file passes (4 tests, 2.86s). No source, dependency or test-budget changes on resume: only the newly owned cards test, the existing owned board test and this return handoff changed. Preview tab and local server closed. Scope audit and `git diff --check` pass.

Resume implementation/test commits: 73ebc4f (cards async assertions and playback timing regression), 1537237 (controlled staff completion). No open questions or remaining implementation gates; lead review is next.
