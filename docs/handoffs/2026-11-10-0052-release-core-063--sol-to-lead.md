# Handoff: 0052 — Release prep (sol → lead)

- **Date:** 2026-11-10
- **Type:** return
- **Ledger:** 0052 · **Spec / plan:** none (quick)
- **Branch:** orch/0052-release-core-063
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-59fedfc0
- **Base commit:** b03f80a9abafe53187aeb835d1d82a0c8481d097 (contains required 67f95a1)
- **Implementation commit:** 1332c790de0836fc294792285a64d2e8329a82a9
- **PR:** draft PR to be created after this return is committed.
- **Status:** blocked on full-suite verification; scoped edits complete

## Goal and context
Prepare core 0.6.3 and React 0.5.3 release notes without tagging or publishing. [Dispatch and committed receiver ack](2026-11-10-0052-release-core-063--lead-to-sol.md). No spec, plan or ADR for this quick item.

## Scope
- **In / files owned:** core package.json (version only), core/react/board package CHANGELOG.md files, root CHANGELOG.md, own two handoffs.
- **Out:** all code/tests, dependencies/lockfile, ledger, other docs, tags, publication and merging.
- Scope audit: only those seven files changed; git diff --check passes.

## Acceptance criteria
- [x] Versions: core 0.6.3, React 0.5.3, board 0.2.4; directly asserted from package.json.
- [x] Four new core changelog lines cite merged #106/#110/#113/#118; new React and board lines cite #119. Root release notes cite merged PRs, give core → React publish order, hold board for 0047, and explain SSR guitar placeholders/readiness waits (#114/#119).
- [x] Packed-board consumer verification passes.
- [ ] Full required verify command passes: initial run and one retry failed in unchanged tests; details below.

## Verify with
```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs
```

## Verification output
```text
pnpm install --frozen-lockfile: exit 0
pnpm build: exit 0
pnpm lint: exit 0
pnpm lint:test: exit 0 (all eight packages)
pnpm test:run: exit 1
  voicings 176, core 712, listen 13, guitar 337, voicing 161, react 397 passed
  cards: 822 passed / 1 failed; board not reached
  ChordCardPlayer.test.tsx:181: expected SVG to exist; still lazy loading
  test: keeps playback string targets active when playback starts before the lazy diagram paints
  waitFor failed after about 1 second (test duration 1075ms)
pnpm test:run (one retry): exit 1
  voicings 176 passed; core 711 passed / 1 failed; later packages not reached
  chord-resolver.test.ts:337: every bracketed catalogue alias with every slash bass is correct or throws
  Test timed out in 5000ms (5030ms)
pnpm --filter @pepperhorn/chordl-react build:site: exit 0 (31.07s)
node scripts/verify-board-package.mjs: exit 0
  Packed editor/player SSR, exports and scoped stylesheet pass.
  Packed consumer typecheck and Vite build pass.
pnpm --filter @pepperhorn/chordl-board test:run: exit 0 (28 files / 347 tests)
pnpm --filter @pepperhorn/chordl-cards exec vitest run test/ChordCardPlayer.test.tsx:
  exit 0 (1 file / 26 tests, including the initially failing playback test)
git diff --check: clean
```
Logs: `/tmp/chordl-0052-{install,build,lint,lint-test,tests,tests-rerun,site,packed-board,board-tests,cards-repro}.log`. Existing API Extractor/chunk-size advisories and JSDOM navigation messages appeared during passing checks. No test or source edits made to address timing failures.

## Known gotchas
GBrain searches for chordl / release returned no task-specific pages; no GBrain page informed these changes. Repo return handoffs for 0032/0038/0046/0048/0050 supplied the release behavior. Current GitHub state confirms #106/#110/#113/#118/#119/#114 are merged. Built all workspace artifacts before checking package consumers.

## Return
- **Outcome:** partial: release-prep edits complete, full-suite verification blocked by unchanged timing failures.
- **What changed:** bumped only core version metadata, added four user-facing core release lines, staff/readiness lines in React/board and a dated root release-prep section with consumer guidance.
- **Decisions made:** explicitly label root section as release prep to avoid implying publication. Preserve all existing historical changelog entries and versions. No ADR proposed.
- **Out-of-scope issues:** core timeout is already tracked as S12 / 0054 in the ledger; cards lazy-playback wait failed once and passed targeted rerun. No evidence this metadata/docs change caused either timing failure.
- **Open question / follow-up:** lead to resolve verification through the existing test-timeout work (and assess the cards playback wait), arrange independent review, and decide merge/publication. No publish/tag performed; no PR watch or polling.
- **For GBrain (lead to promote):** core 0.6.3 / React 0.5.3 release preparation is separate from publication; board 0.2.4 remains held for downstream readiness work 0047.
