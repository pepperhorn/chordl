# Handoff: 0043-t2 — Type-check test files (sol → lead)

- **Date:** 2026-11-10
- **Type:** return
- **Ledger:** 0043-t2 · **Spec:** [0043](../specs/0043-typecheck-tests.md) · **Plan:** [0043 T2](../plans/0043-typecheck-tests.md)
- **Dispatch / receiver ack:** [lead → sol](2026-11-10-0043-t2-typecheck-tests--lead-to-sol.md)
- **Branch:** orch/0043-t2-typecheck-tests
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-08ebcd6f
- **Base commit:** 5eb225e (contains required 745bd30)
- **Implementation commits:** 0fd9043, 580e628, 7d904f3, 423a378; acknowledgement ebb561f
- **PR:** draft to be opened from the branch above
- **Status:** closed (implementation complete; lead review remains)

## Goal
Enable strict test type-checking for react, cards and board, completing coverage of all eight packages without changing runtime behaviour, assertions or the 2,943-test count.

## Context you need
The linked spec/plan and dispatch define the task. T1's [return handoff](2026-11-09-0043-t1-typecheck-tests--sol-to-lead.md) supplies the existing config/root/CI pattern. GBrain search for chordl/typecheck/0043 returned no task-specific guidance; no GBrain page was relied on. No implementer GBrain writes.

## Scope
- **In / files owned:** packages/{chordl-react,chordl-cards,chordl-board}/tsconfig.test.json, their package.json lint:test and approved @types/node devDependency, type-only test/** fixes, pnpm-lock.yaml, and this task's dispatch acknowledgement and return handoff.
- **Out / do not touch:** production src/, build configs, root scripts, CI, other packages, ledger and other docs.
- **Scope audit:** only owned files changed. No production src/ changes. Each package has its own implementation commit; shared lockfile has a separate commit.

## Acceptance criteria
- [x] AC1: root pnpm lint:test passes for all eight packages. Independently planting wrong-argument and wrong-property errors in a temporary test file in each of react/cards/board made root pnpm lint:test exit 2; all probes removed, restored root run exits 0.
- [x] AC2: existing CI Lint tests step runs pnpm lint:test after Lint; adding the three package scripts extends coverage without CI edits.
- [x] AC3: no src/ changes. TypeScript transpilation of all nine changed test files (comments removed) emits identical JavaScript to base 5eb225e.
- [x] AC4: entire required verify command passes; 2,943 tests unchanged.
- [x] Every test/helper .ts/.tsx file appears in --listFilesOnly: react 52/52, cards 28/28, board 29/29; no missing files.

## Verify with
```bash
pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && pnpm lint:test && node scripts/verify-board-package.mjs
```

## Error counts before / after
Measured after initial workspace build using the final test configs, before fixture fixes and direct Node devDependencies; count diagnostic lines, not nested overload explanations.

| Package | Before | After | Included test/helper files |
| --- | ---: | ---: | ---: |
| chordl-react | 1 | 0 | 52 |
| chordl-cards | 22 | 0 | 28 |
| chordl-board | 36 | 0 | 29 |

## Verification output
All required commands exited 0, sequentially in the order above.

```text
pnpm install --frozen-lockfile: exit 0
pnpm build: exit 0
pnpm lint: exit 0
pnpm test:run: exit 0
  voicings: 9 files, 176 passed
  core: 16 files, 694 passed
  listen: 1 file, 13 passed
  guitar: 19 files, 337 passed
  voicing: 9 files, 161 passed
  react: 51 files, 394 passed
  cards: 26 files, 823 passed
  board: 28 files, 345 passed
  Total: 159 files, 2,943 passed (unchanged)
pnpm --filter @pepperhorn/chordl-react build:site: exit 0, built in 5.13s
pnpm lint:test: exit 0; all eight packages Done
node scripts/verify-board-package.mjs: exit 0
  Packed editor/player SSR, exports and scoped stylesheet pass.
  Packed consumer typecheck and Vite build pass: /tmp/chordl-board-consumer-YWDWMY
Planted react probe: TS2322 + TS2339; root exit 2
Planted cards probe: TS2345 + TS2339; root exit 2
Planted board probe: TS2345 + TS2339; root exit 2
After removing probes: root pnpm lint:test exit 0
Changed-test emitted JavaScript comparison: nine files identical to base
```

Logs are /tmp/0043-t2-{install-final,build-final,lint,tests,site,lint-test-final,packed-board}.log; inclusion lists /tmp/0043-t2-{react,cards,board}-files.log; diagnostic baselines /tmp/0043-t2-{react,cards,board}-before.log; probe logs /tmp/0043-t2-{react,cards,board}-planted.log and restored result /tmp/0043-t2-lint-test-restored.log. Existing non-failing API Extractor TypeScript-version, large site chunks, and jsdom navigation warnings remain. No remote CI or review result claimed.

## Decisions made / known gotchas
- Configs extend production configs, retain inherited strictness, use noEmit + ESNext/Bundler, include src and test, and exclude node_modules/dist. Production build configs are unchanged.
- Board's test-only lib is ES2022 for existing Array.at calls, plus DOM and DOM.Iterable. React/cards retain ES2020 plus DOM/DOM.Iterable.
- All three directly declare @types/node (^22.19.17, resolving the already-locked version). Each uses Node built-ins in tests; react previously obtained the types indirectly. No new resolved dependency versions.
- Playback mocks use their real exported function signatures so mock.calls and mockImplementationOnce are checked, preserving zero-argument implementations.
- Cards' keyboard request is asserted to the existing KeyboardFaceRequest for the known keyboard fixture; an incorrect two-element finger tuple assertion is removed so the actual svguitar Chord type is used.
- BoardCardSize is imported as a type from the existing internal types module, avoiding a production export change. The mocked PianoChord props use Extract to select its chord overload.
- The malformed guitar failure fixture deliberately omits barres and has null fingers; an explicit unknown-to-chord cast preserves that exact negative fixture.
- Board's memory adapter readback is asserted as BoardState | null (this fixture never returns legacy arrays); the polluted ref assertion passes through unknown to inspect an unmodelled property.
- The existing getByRole options object retains exact:true through a structural type assertion. Testing Library role options do not declare exact; retaining the object avoids a runtime edit. String name already matches exactly.

## Open questions
None.

## Return (implementer → lead)
- **Outcome:** done
- **What changed:** three strict test configs/scripts, direct Node test typings, and type-only fixes in nine test files.
- **Out-of-scope issues found:** none requiring changes.
- **Follow-ups:** lead to arrange cross-family review and merge under repository rules; no watching or polling by implementer.
- **For GBrain (lead to promote):** Board test type-checking needs ES2022 lib for existing Array.at and DOM.Iterable for NodeList iteration; type mocks from public signatures to make recorded argument tuples meaningful. No ADR needed.
