# Handoff: 0045-t1 — react: load smplr on demand (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0045-t1 · **Spec:** [0045](../specs/0045-load-on-demand.md) · **Plan:** [T1](../plans/0045-load-on-demand.md)
- **Dispatch:** [lead → sol](2026-11-09-0045-t1-react-lazy-audio--lead-to-sol.md)
- **Branch:** orch/0045-t1-react-lazy-audio
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-24130b61
- **Base:** 003b00a (contains pinned dc6f8d2)
- **Acknowledgement commit:** 3d8a458
- **Implementation commit:** 9708af62a548872209e1ae9218f90ad063ff4287
- **PR:** https://github.com/pepperhorn/chordl/pull/112 (draft)
- **Port:** 5651 (no server needed for T1 entry-file measurement)
- **Status:** closed

## Goal / scope
Load smplr only when audio is requested, cover import timing with regression tests, and investigate whether guitar can be split cleanly inside the owned react files. Owned implementation paths: `packages/chordl-react/src/audio/**`, audio tests under `packages/chordl-react/test/**`, package.json version only, CHANGELOG.md, and this task's two handoffs. Optional GuitarChordPanel ownership was investigated without edits. No board, public export, dependency, ledger, deployment or publication changes.

## Outcome / acceptance criteria
- AC2 (T1 smplr): wav-export now dynamically imports smplr inside renderToBuffer, matching playback. Both paths can share the bundler's deferred sampler chunk. Four new tests assert no sampler import on zip-export/playback module loading or pure-helper use, then import-on-play/export and sample readiness before scheduling. Block/arpeggio WAV cases also check exact MIDI ordering, timing, stereo WAV headers and PCM data size.
- Regression proof: before the source fix, three new import-timing assertions failed (eager smplr factory call); after the fix, all four pass. The before regression invocation also ran the existing React suite: 49 files passed, only the new file failed. Final complete workspace verification is below.
- Version: chordl-react 0.5.1 → 0.5.2; added package CHANGELOG.md (none existed at base).
- Site warning and before/after entry measurements: below.
- AC5: final verify command and package-consumer proof below.

## Guitar investigation / decisions made
Leave the optional guitar implementation to T2. `GuitarChordPanel.tsx:5-15` imports the lookup/data package and `GuitarChord`; `GuitarChord.tsx:3` statically imports SVGuitar. The latter is a separately public component (`src/index.ts:22`) and is not a module only the panel imports, so it falls outside the optional ownership grant. Moving only the panel's datasets would leave the separately exported renderer's eager SVGuitar path. A complete internal boundary needs broader ownership and a loading/readiness policy for that public renderer; T2 already owns the board-level lazy boundary and markers. No public export removed or renamed.

Independently decoded the baseline sourcemap's VLQ segments and attributed generated column spans to source modules, following 0044 (approximate minified raw bytes):

| Baseline contributor | Mapped raw bytes |
|---|---:|
| chordl-guitar/dist/instruments.js | 342,582 |
| chordl-guitar/dist/top3Generated.js | 58,225 |
| SVGuitar | 166,284 |
| smplr | 59,752 |

Guitar data/rendering together: 567,091 bytes, ~51.1% of the baseline entry. These match 0044's measurements; the rebuilt baseline entry has the same hash. T2 should verify its board-level lazy import against the final bundle graph: the library still publicly exports GuitarChord and GuitarChordPanel, and whether an eager path survives depends on the consumer's actual imports/tree shaking.

## Follow-ups / for GBrain (lead to promote)
- T2 retains the full-item no-interaction request-log measurement, notation/guitar loading and ready markers, becreative readiness guidance, and headless browser smoke (play, WAV/ZIP, PDF). This T1 audio boundary renders no new UI, so adds no loading/ready card markers.
- No physical audio-device or production/deployment claim is made by mocked audio tests or local build proof.
- GBrain searched for `chordl lazy smplr load on demand` and `chordl`; results were unrelated cross-project pages, so no GBrain page was used. Repo spec, plan and [0044 return](2026-11-09-0044-site-code-split--sol-to-lead.md) supplied the implementation context. Implementer made no GBrain writes.

## Open questions
None. Lead review and merge, then T2. No PR watch started.

## Entry measurement
Both builds used `pnpm --filter @pepperhorn/chordl-react build:site --sourcemap`. Same 0044 built-file method: entry path from index.html, raw UTF-8 bytes, Python `gzip.compress(data, compresslevel=6, mtime=0)`. Source-map comments are included in both; maps are not part of the payload. T1 compares entry bytes only; the no-interaction browser request log belongs to T2.

| Entry bytes | Before | After | Reduction |
|---|---:|---:|---:|
| Raw | 1,109,387 | 1,049,598 | 59,789 (5.39%) |
| Gzip level 6 | 278,573 | 258,552 | 20,021 (7.19%) |

Before entry: `/assets/index-CTkCTh4w.js`; after: `/assets/index-BnJuSuDy.js`. The audio-only reduction is expected to be below the whole-item 30% target; guitar and notation are T2.

## Verification output
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs
```

All commands passed, exit 0. Install frozen lockfile passed with lockfile unchanged. Full workspace: 156 test files / 2,823 tests; React: 50 files / 389 tests. Existing jsdom navigation stderr, API Extractor TypeScript-version notice, Verovio node:module externalization and large-chunk warnings are non-fatal. No smplr static/dynamic warning after the fix.

```text
 Test Files  9 passed (9)
      Tests  176 passed (176)
 Test Files  16 passed (16)
      Tests  588 passed (588)
 Test Files  1 passed (1)
      Tests  13 passed (13)
 Test Files  19 passed (19)
      Tests  337 passed (337)
 Test Files  9 passed (9)
      Tests  161 passed (161)
 Test Files  50 passed (50)
      Tests  389 passed (389)
 Test Files  26 passed (26)
      Tests  822 passed (822)
 Test Files  26 passed (26)
      Tests  337 passed (337)
Packed editor/player SSR, exports and scoped stylesheet pass.
Packed consumer typecheck and Vite build pass: /tmp/chordl-board-consumer-YMSUd0
```

### Before site build (sourcemaps, includes original smplr warning)
```text
[plugin vite:reporter] 
(!) /home/shaun/.t3/worktrees/chordl/t3-24130b61/node_modules/.pnpm/smplr@0.18.1/node_modules/smplr/dist/index.mjs is dynamically imported by /home/shaun/.t3/worktrees/chordl/t3-24130b61/packages/chordl-react/src/audio/playback.ts, /home/shaun/.t3/worktrees/chordl/t3-24130b61/packages/chordl-react/src/audio/playback.ts but also statically imported by /home/shaun/.t3/worktrees/chordl/t3-24130b61/packages/chordl-react/src/audio/wav-export.ts, dynamic import will not move module into another chunk.

computing gzip size...
../site-dist/index.html                                     15.40 kB │ gzip:     4.58 kB
../site-dist/assets/index-CkQwFCL9.css                       8.27 kB │ gzip:     2.10 kB
../site-dist/assets/__vite-browser-external-BIHI7g3E.js      0.09 kB │ gzip:     0.11 kB │ map:      0.21 kB
../site-dist/assets/ChordSheet-CMSfL1I7.js                   5.41 kB │ gzip:     2.09 kB │ map:     19.12 kB
../site-dist/assets/verovio-wycgSLAY.js                      7.68 kB │ gzip:     1.80 kB │ map:     22.10 kB
../site-dist/assets/Examples-D4_f6dQh.js                    10.90 kB │ gzip:     2.45 kB │ map:     26.94 kB
../site-dist/assets/index-DRgboIGw.js                       17.77 kB │ gzip:     7.86 kB │ map:     70.71 kB
../site-dist/assets/purify.es-CAi2OJFm.js                   30.52 kB │ gzip:    11.76 kB │ map:    137.02 kB
../site-dist/assets/SoundFont2-CTuqlD8W.js                  36.36 kB │ gzip:     8.46 kB │ map:    205.82 kB
../site-dist/assets/jszip.min-44fiDmqw.js                   97.58 kB │ gzip:    30.37 kB │ map:    226.86 kB
../site-dist/assets/index.es-ClarSHNU.js                   159.69 kB │ gzip:    53.58 kB │ map:    650.22 kB
../site-dist/assets/html2canvas.esm-QH1iLAAe.js            202.43 kB │ gzip:    48.09 kB │ map:    603.25 kB
../site-dist/assets/jspdf.es.min-CLRF-gPx.js               390.64 kB │ gzip:   128.81 kB │ map:  1,294.22 kB
../site-dist/assets/verovio-fonts.generated-D-aR87HZ.js    878.85 kB │ gzip:   556.89 kB │ map:    879.51 kB
../site-dist/assets/index-CTkCTh4w.js                    1,109.39 kB │ gzip:   278.57 kB │ map:  3,081.29 kB
../site-dist/assets/verovio-module-DtwMsdz7.js           7,890.47 kB │ gzip: 2,343.88 kB │ map: 16,614.26 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 15.74s
```

### After site build (same sourcemap measurement settings)
```text
✓ 444 modules transformed.
rendering chunks...
computing gzip size...
../site-dist/index.html                                     15.40 kB │ gzip:     4.58 kB
../site-dist/assets/index-CkQwFCL9.css                       8.27 kB │ gzip:     2.10 kB
../site-dist/assets/__vite-browser-external-BIHI7g3E.js      0.09 kB │ gzip:     0.11 kB │ map:      0.21 kB
../site-dist/assets/ChordSheet-CIzlgON8.js                   5.41 kB │ gzip:     2.09 kB │ map:     19.12 kB
../site-dist/assets/verovio-wycgSLAY.js                      7.68 kB │ gzip:     1.80 kB │ map:     22.10 kB
../site-dist/assets/Examples-CYPsnS7O.js                    10.90 kB │ gzip:     2.45 kB │ map:     26.94 kB
../site-dist/assets/index-CzziFm0n.js                       17.77 kB │ gzip:     7.86 kB │ map:     70.71 kB
../site-dist/assets/purify.es-CAi2OJFm.js                   30.52 kB │ gzip:    11.76 kB │ map:    137.02 kB
../site-dist/assets/SoundFont2-BwAWyKIy.js                  36.36 kB │ gzip:     8.46 kB │ map:    205.82 kB
../site-dist/assets/index-BEDsmYX1.js                       59.35 kB │ gzip:    18.78 kB │ map:    204.09 kB
../site-dist/assets/jszip.min-B7Q82jvY.js                   97.58 kB │ gzip:    30.37 kB │ map:    226.86 kB
../site-dist/assets/index.es-DKTvKNta.js                   159.69 kB │ gzip:    53.58 kB │ map:    650.22 kB
../site-dist/assets/html2canvas.esm-QH1iLAAe.js            202.43 kB │ gzip:    48.09 kB │ map:    603.25 kB
../site-dist/assets/jspdf.es.min-CJllQO28.js               390.64 kB │ gzip:   128.81 kB │ map:  1,294.22 kB
../site-dist/assets/verovio-fonts.generated-D-aR87HZ.js    878.85 kB │ gzip:   556.89 kB │ map:    879.51 kB
../site-dist/assets/index-BnJuSuDy.js                    1,049.60 kB │ gzip:   258.55 kB │ map:  2,876.01 kB
../site-dist/assets/verovio-module-BSOulJGA.js           7,890.47 kB │ gzip: 2,343.88 kB │ map: 16,614.26 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 19.71s
```

Normal (no sourcemaps) site build also passed in 6.29s. Final normal site build passed in 11.97s and restored the usual output after measurement. Scope audit and `git diff --check` pass; only owned implementation files and this task's two handoffs changed relative to the branch base.
