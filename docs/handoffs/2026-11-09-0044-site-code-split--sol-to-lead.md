# Handoff: 0044 — site code split (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0044 · **Spec:** [0044](../specs/0044-site-code-split.md) · **Plan:** [T1](../plans/0044-site-code-split.md)
- **Dispatch:** [lead → sol](2026-11-09-0044-site-code-split--lead-to-sol.md)
- **Branch:** orch/0044-site-code-split
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-24e7c148
- **Base:** 627dbfa (contains e86c52f)
- **Implementation commit:** 7dd9897
- **PR:** pending creation after this handoff commit
- **Status:** closed

## Goal / scope
Measure the initial JS, split optional site features, and remeasure against spec AC1–AC4. Owned code: `packages/chordl-react/dev/**` and `packages/chordl-react/vite.site.config.ts`; only dev/App.tsx, dev/Examples.tsx and dev/PillGroup.tsx changed. Library sources, configs, public APIs, dependencies, deployment, ledger and other docs untouched, apart from owned acknowledgement/return handoffs.

## Outcome
Implemented the optional-example split. AC1 and AC3 met; AC2 uses the spec's measured-justification alternative: the 30% target requires changing library loading behavior outside this task. AC4 verification is recorded below.

App now imports Examples with React.lazy only when Show examples is selected. All demo content and the snapshot codec moved intact into Examples.tsx. PillGroup is shared by the header and examples without importing the App entry (avoids a cycle and duplicate mounting). InteractiveInput remains synchronous and exported for existing tests. Suspense has a contextual `examples-loading glass-card` status with Poppins font styling.

## Measurements (AC1 / AC2)
Local production builds at base and implementation, each with `pnpm --filter @pepperhorn/chordl-react build:site --sourcemap`. Browser automation against `vite preview --config vite.site.config.ts --host 0.0.0.0 --port 5640`; 1280×800 viewport, empty board, initial default chord, no interaction before collecting resource entries after idle loading settled (at least 12 seconds). Browser network logs confirmed HTTP 200 requests. Resource paths obtained with:

```js
performance.getEntriesByType('resource')
  .filter(r => new URL(r.name).pathname.endsWith('.js'))
  .map(r => new URL(r.name).pathname)
```

Sizes are UTF-8 built-file bytes and normalized gzip level 6 (`gzip.compress(data, compresslevel=6, mtime=0)`), summed only for requested JS files. These are comparable payload estimates, not preview-server wire compression or production timing. Source maps were not requested; instrumentation adds a short sourceMappingURL comment to each JS file. Final normal build:site passes and emits no maps. The older production gzip figure in the dispatch is not directly comparable to this locally normalized baseline.

| Metric (bytes) | Before | After | Reduction |
|---|---:|---:|---:|
| Entry raw | 1,124,857 | 1,109,387 | 15,470 (1.38%) |
| Entry gzip | 281,574 | 278,573 | 3,001 (1.07%) |
| JS gzip before idle warm-up (entry only) | 281,574 | 278,573 | 1.07% |
| All JS gzip requested with no interaction, including idle | 3,184,036 | 3,181,037 | 2,999 (0.094%) |

Complete no-interaction request lists (under `/assets/`):

| Before chunk | After chunk | Before raw / gzip | After raw / gzip |
|---|---|---:|---:|
| index-CmNbDIq_.js | index-CTkCTh4w.js | 1,124,857 / 281,574 | 1,109,387 / 278,573 |
| verovio-module-DkpEqvr0.js | verovio-module-DtwMsdz7.js | 7,890,474 / 2,343,776 | 7,890,474 / 2,343,778 |
| verovio-wycgSLAY.js | same | 7,677 / 1,798 | same |
| verovio-fonts.generated-D-aR87HZ.js | same | 878,845 / 556,888 | same |

After split, Examples-D4_f6dQh.js (~10.90 KB raw; ~2.45 KB gzip) and ChordSheet-CMSfL1I7.js (~5.41 KB raw; ~2.09 KB gzip) are absent from the default request list, and load after Show examples. Existing export/audio lazy chunks remain optional.

### Entry composition and the site-layer limit
Decoded sourcemap VLQ segments and attributed generated column spans to their source modules (approximate minified raw bytes; mapping helpers/unmapped bytes excluded):

| Contributor before | Mapped bytes |
|---|---:|
| chordl-guitar/dist/instruments.js | 342,582 |
| chordl-guitar/dist/top3Generated.js | 58,225 |
| svguitar | 166,284 |
| react-dom | 181,279 |
| chordl-board/src total | 92,762 |
| smplr | 59,752 |
| dev/App.tsx | 18,345 |

BoardEditor statically imports ProgressionView, ListenOverlay, FollowAlongOverlay and notation configuration; ChordBoard imports PianoChord and GuitarChordPanel. The latter pulls in guitar datasets/SVGuitar even when the current view is piano. wav-export statically imports smplr, so playback's dynamic import does not split it (Vite warning confirms this). These imports live outside owned files. Wrapping BoardEditor in React.lazy would still fetch those bytes immediately to render the first screen. manualChunks would redistribute the same requested bytes and add requests.

More decisively, `packages/chordl-board/src/BoardEditor.tsx:757` invokes `prefetchVerovioWhenIdle()` for the default piano screen. The three Verovio chunks account for 2,902,462 gzip bytes (91.2% of baseline no-interaction payload). Even deleting the entire entry could save only 8.8% of that total. Meeting 30% requires changing this library-level warm-up policy, or the Verovio payload itself. For the pre-idle entry alone, guitar data/rendering and smplr need library-level lazy boundaries to approach 30%. No such changes made.

## Browser smoke (AC3)
Real automated Chromium browser, local built preview:
- Default keyboard renders; Examples chunk absent from no-interaction log.
- Type Dm7: input and chord update. Cycle Display from Diagram to Both: two `.bc-staff svg` elements render.
- Show examples: Examples and ChordSheet chunks load; all five sections appear. Open ChordSheet and Export Token: token starts `bcs1.`.
- Chord `.zip` → This downloads Dm7.zip (983,444 bytes). ZIP CRC check passes; contains Dm7.svg, Dm7.png, Dm7.mid, Dm7_chord.wav and Dm7_arpeggio.wav. JSZip loads only on export.
- No browser console errors, captured runtime errors or unhandled rejections during successful flows. One attempted SVG toolbar locator timed out because that toolbar is unavailable in Both view; ZIP export above verifies the actual export flow.
- Preview tab closed and server stopped. No deployment or physical audio-device certification.

## Verification output (AC4)
Commands: `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site` (executed as staged commands with logs).

- `pnpm install --frozen-lockfile`: pass; lockfile unchanged.
- `pnpm build`: pass.
- `pnpm lint`: pass.
- Initial `pnpm test:run`: core catalogue test at test/chord-resolver.test.ts:314 timed out (7,186 ms against 5,000 ms). This is the existing ledger S12 issue; source untouched.
- Full unmodified `pnpm test:run` rerun: pass, 155 files / 2,819 tests across all eight packages, exit 0. Existing jsdom navigation-not-implemented stderr is non-fatal.
- Normal `pnpm --filter @pepperhorn/chordl-react build:site`: pass, built in 29.12s. Expected large-chunk, smplr static/dynamic import, and Verovio node:module browser-external warnings.
- `git diff --check`: pass. Scope audit: only three owned dev files plus this task's two handoffs.

Verification tail (rerun):

```text
voicings: Test Files 9 passed; Tests 176 passed
core: Test Files 16 passed; Tests 588 passed
listen: Test Files 1 passed; Tests 13 passed
guitar: Test Files 19 passed; Tests 337 passed
voicing: Test Files 9 passed; Tests 161 passed
react: Test Files 49 passed; Tests 385 passed
cards: Test Files 26 passed; Tests 822 passed
board: Test Files 26 passed; Tests 337 passed
build:site: ✓ built in 29.12s
```

## Decisions made / follow-ups / for GBrain (lead to promote)
- Keep the board synchronous: a lazy boundary around first-screen content creates a waterfall without reducing first-screen requests. No manualChunks change for the same reason.
- Recommend a separate library-scoped task to revisit idle Verovio prefetch and lazy-load guitar rendering/data and WAV audio dependencies. Product tradeoff: faster later notation versus spending ~2.9 MB gzip on piano-only visits. Scope/behavior approval belongs to lead/human.
- Existing core catalogue timeout remains a test-efficiency follow-up (ledger S12); no test budgets changed.
- GBrain searched before implementation; no relevant chordl site-split page found. No implementer writes to GBrain.

## Open questions
None. Lead review/merge is next; no PR watch requested or started.
