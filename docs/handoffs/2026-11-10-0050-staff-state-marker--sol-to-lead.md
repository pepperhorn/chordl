# Handoff: 0050 — StaffNotation state markers (sol → lead)

- **Date:** 2026-11-10
- **Type:** return
- **Ledger:** 0050 · **Spec / plan:** quick item; [dispatch handoff](2026-11-10-0050-staff-state-marker--lead-to-sol.md)
- **Branch:** orch/0050-staff-state-marker
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-975e9688
- **Base commit:** afba74cbbf4b399bd84b5035af65d7994881cade (contains required 4911f61)
- **PR:** https://github.com/pepperhorn/chordl/pull/119 (draft against main).
- **Status:** closed

## Goal
Expose StaffNotation loading/ready/error markers and make board notation cards aggregate them, so downstream PDF readiness can distinguish completed engravings from failures.

## Scope
- **In / files owned:** `packages/chordl-react/src/components/StaffNotation.tsx`, `packages/chordl-react/test/staff-notation*.test.tsx`, notation readiness wrapper only in `packages/chordl-board/src/ChordBoard.tsx`, `packages/chordl-board/test/on-demand.test.tsx`, and the two 0050 handoffs.
- **Out / do not touch:** all other files, public exports/props, ledger, downstream becreative, publishing, merging, PR monitoring.

## Acceptance criteria
- [x] Staff markers cover loading, ready after actual injection, Verovio error, prop changes, and recovery.
- [x] Two-staff board aggregation: any error wins over a loading or ready sibling; all must be ready for card ready. Missing markers / no staves remain loading.
- [x] No public exports or props changed.
- [x] Complete verification and packed-board check (results below).

## Verify with
```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs
```

## Known gotchas / decisions already made
GBrain search `chordl StaffNotation readiness` returned unrelated pages only; no GBrain page was used. Workspace package consumers resolve built output: build before cross-package checks.

## Open questions
None.

## Return
- **Outcome:** done.
- **Commits:** acknowledgement `1096afb`; implementation `f793fb0`; return handoff committed afterward.
- **What changed:** Each `.bc-staff` root exposes `data-chordl-state`. An internal injected request key publishes ready only after the SVG injection effect completes and resets when the engraving node unmounts. Board notation aggregation reads staff markers and observes marker attribute mutations, dropping the class/DOM-shape heuristic. Controlled tests hold identical SVG DOM across board state transitions so attribute-only updates and error priority are exercised.
- **Verification output:**
```text
pnpm install --frozen-lockfile: exit 0
pnpm build: exit 0 (all 8 packages)
pnpm lint: exit 0
pnpm lint:test: exit 0 (all 8 packages)
pnpm test:run: exit 0 (159 files, 2947 tests)
  voicings 176; core 694; listen 13; guitar 337; voicing 161;
  react 396; cards 823; board 347 — all passed
pnpm --filter @pepperhorn/chordl-react build:site: exit 0
  ✓ built in 7.61s
node scripts/verify-board-package.mjs: exit 0
  Packed editor/player SSR, exports and scoped stylesheet pass.
  Packed consumer typecheck and Vite build pass: /tmp/chordl-board-consumer-ZpcEZF
Targeted staff tests: 2 files / 28 tests passed
Targeted on-demand board tests: 1 file / 7 tests passed
Final StaffNotation reset refinement: React rebuild, lint and targeted tests passed;
full workspace tests and subsequent site/packed-board checks also passed.
git diff --check: clean
Scope audit: only four owned code/test files and two task handoffs changed.
```
Build emits existing chunk-size / API Extractor version notices; JSDOM emits navigation-not-implemented messages during passing suites. Logs are `/tmp/chordl-0050-{build,lint,lint-test,tests,site,packed-board}.log` (local artifacts).

- **Decisions made:** Track injection completion separately from Verovio promise resolution because ready promises an SVG already in the DOM. Reset that key on node unmount, including when returning to the previous completed request. Missing staff markers mean loading. Error wins even if another staff is still loading. No ADR proposed.
- **Out-of-scope issues found:** None requiring code changes. An initial test attempt passed `--` through pnpm and selected the full React suite before board dist existed; it failed package entry resolution. Corrected targeted commands after the build passed; full verification results below supersede that attempt.
- **Follow-ups:** Lead owns independent review / merge and ledger updates. Existing 0047 downstream readiness / publication hold remains with the lead.
- **For GBrain (lead to promote):** Staff root marker readiness follows actual SVG injection; board observers must subscribe to `data-chordl-state` attributes, and one staff error must take precedence over loading siblings.


## Review r1 response

Review: [5832349157](https://github.com/pepperhorn/chordl/pull/119#pullrequestreview-5832349157), reviewed head `49f6946`.

1. **Same-request retry:** Clear a completed failed result whenever a new render request starts. Clearing failures on *any* new request also discards A's failure while B is pending, so returning to A cannot briefly publish the old terminal error before a passive effect clears it. Successful results are preserved. The new A rejects → B held → A held regression asserts loading throughout the retry, no unavailable label, no observed error marker, and ready after the retry resolves. Before the fix this failed with `expected 'error' to be 'loading'`; after the fix the staff file passes 11/11.
2. **Injection-order test:** Replace observer-callback assertions with collected violations asserted after observation. Resolve the render promises and schedule prop updates through a state setter outside `act`, leaving commit → passive-effect gaps observable on initial completion and return to the last completed request. The production file remains untouched during mutation checks.

### Scratch mutation evidence
Scratch copy: `/tmp/chordl-0050-r1-mutation-9rzih6jw`. Copied the React package with separate source/test files and linked existing dependencies/dist. Ran `./node_modules/.bin/vitest run test/staff-notation.loading.test.tsx` there:

```text
baseline: exit 0 — 11 passed
no-injection-check: exit 1 — 1 failed, 10 passed
  expected [ 'ready-without-svg', 'ready-without-svg' ] to deeply equal []
no-injection-reset: exit 1 — 1 failed, 10 passed
  expected [ 'ready-without-svg' ] to deeply equal []
```

Each mutant was reverted in `finally`; the scratch source was restored to the branch source. Logs: `/tmp/chordl-0050-r1-mutation-{baseline,no-injection-check,no-injection-reset}.log`. The pre-fix retry reproduction is `/tmp/chordl-0050-r1-before.log`; corrected branch targeted tests are `/tmp/chordl-0050-r1-target.log`.

### Full verification
Implementation commit: `2c28671`; this response committed afterward.

```text
pnpm build: exit 0
pnpm lint: exit 0
pnpm lint:test: exit 0
pnpm test:run: exit 0 — 159 files / 2948 tests passed
  voicings 176; core 694; listen 13; guitar 337; voicing 161;
  react 397; cards 823; board 347
pnpm --filter @pepperhorn/chordl-react build:site: exit 0
  ✓ built in 7.28s
node scripts/verify-board-package.mjs: exit 0
  Packed editor/player SSR, exports and scoped stylesheet pass.
  Packed consumer typecheck and Vite build pass: /tmp/chordl-board-consumer-mUTO3O
git diff --check: clean
```

Logs: `/tmp/chordl-0050-r1-{build,lint,lint-test,tests,site,packed-board}.log`. Only StaffNotation source, its loading test, and this return handoff changed for r1. No API/prop changes. Independent re-review and merge remain with the lead.
