# Handoff: 0051 — Make the slowest board and react tests cheaper (sol → lead)

- **Date:** 2026-11-10
- **Type:** return · **Ledger:** 0051 · **Status:** closed · **Outcome:** done
- **Branch:** orch/0051-faster-slow-tests
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-306feb84
- **Base commit:** afba74c (descendant of pinned 4911f61)
- **PR:** see the draft PR linking this handoff
- **Dispatch:** [lead → sol](2026-11-10-0051-faster-slow-tests--lead-to-sol.md)

## Goal and scope
Measure the ten slowest tests per board/react package, idle and with three suites running, then reduce overhead without weakening coverage. Only owned test files and the two task handoffs changed. No production source, vitest configuration, timeouts, dependencies, ledger, staff-notation*.test.tsx or board on-demand.test.tsx edits.

## Changes and what each changed test still proves
- `chordl-react/test/InteractiveInput.annotation-disabled.test.tsx`: still proves toggle/select/radio disabled state, aria-disabled, class and exact explanatory title through Diagram → Both → Notation → Guitar → Diagram, for all three annotations.
- `chordl-react/test/InteractiveInput.level-control.test.tsx`: all four tests still prove default radio selection, enabled guitar controls, real guitar shape counts 2/0/4 and piano variant counts 3/2/3 after radio changes.
- `chordl-board/test/board-editor-instrument-words.test.tsx`: all six tests still prove real ukulele SVG/control selection, manual-choice preservation, stored-card preservation, host-ref behavior and level-only requests. Only radio lookup is scoped to the actual Level control; accessible role and name matching are unchanged.
- `chordl-react/test/GuitarChord.lazy.test.tsx`: all five tests retain their assertions; the lazy-load case still checks zero eager implementation imports, SSR/client fallbacks, no early SVG/ready marker, real ready SVG, exact one-time implementation imports, and fallback removal. After fallback checks, await a completion signal from the existing real import spies inside React act before the unchanged DOM ready assertion. This avoids duplicate explicit imports and preserves the exact one-import assertion. Actual drawing failure and all three terminal notice states remain covered.
- New `chordl-react/test/helpers/mock-engraving.ts`: imported only by the two control suites, stubs external Verovio WASM/toolkit with a minimal successful SVG. Real parsing, panels, filtering, state effects and other renderers remain. Dedicated notation and lazy-load tests retain their own engine coverage. No assertion deleted or weakened; no tests added, removed or split.

## Measurement protocol
Node v26.12.0, pnpm 10.32.1, Linux x86_64, Vitest 4.1.1. Workspace install/build completed before baseline. Idle means board then react run serially, with no other task command launched here. Loaded means one full board, one full react and one full cards suite launched simultaneously using a Python ThreadPoolExecutor(3); all exit codes checked. Host may have unrelated work, so these are observed wall-clock measurements, not guarantees under arbitrary contention. Before = receiver-ack commit 20dbd21; after = identical built workspace with the test-only patch (code commits 440d01c, dcb32d1 and the following import-signal correction). Rank by individual assertionResults[].duration from Vitest JSON, descending, not file totals. Tables independently rank before and after; seconds, rounded to 3 decimals.

Reproduce for each package from `packages/chordl-<package>`:
```bash
pnpm exec vitest run --reporter=json --outputFile=/tmp/0051-<phase>-<mode>-<package>.json
```
Run board/react serially for idle; launch board/react/cards at once and await all three for loaded. Raw local JSON/logs: `/tmp/0051-before-*`, `/tmp/0051-final-*`. An intermediate `/tmp/0051-after-*` run overlapped the verification build: discarded because it added an uncontrolled fourth workload. That run had a lazy-guitar wait failure and a cards timeout. A subsequent isolated three-suite recheck (`/tmp/0051-recheck1-*`) reproduced only the lazy-guitar wait failure (5.527s, still loading); board/react maxima were 6.192s/7.764s. This motivated the explicit import settlement in the lazy-guitar test. Timeouts/config and all assertions remain unchanged. Final tables below are after that fix.

## Before/after ten slowest tests

### board — idle

Before: 345 tests, 0 failures. After: 345 tests, 0 failures.

| Rank | Before test | Before s | After test | After s |
|---|---|---:|---|---:|
| 1 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano | 1.912 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano | 1.744 |
| 2 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear | 1.196 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear | 1.156 |
| 3 | board-editor.test.tsx — BoardEditor embedded in a message draft loads the host's board, saves edits back once, and leaves playground storage alone | 1.044 | board-editor.test.tsx — BoardEditor embedded in a message draft opens a catalogue chord without overwriting the card being edited | 0.805 |
| 4 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words opening a saved guitar card preserves stored controls and values | 0.978 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words opening a saved guitar card preserves stored controls and values | 0.771 |
| 5 | board-editor.test.tsx — BoardEditor embedded in a message draft opens a catalogue chord without overwriting the card being edited | 0.959 | board-editor.test.tsx — BoardEditor embedded in a message draft keeps p shortcuts and labelled controls local when two boards share a page | 0.750 |
| 6 | board-editor.test.tsx — BoardEditor embedded in a message draft keeps p shortcuts and labelled controls local when two boards share a page | 0.717 | lazy-export.test.tsx — export libraries load on demand BoardPlayer renders without loading html2canvas or jspdf | 0.605 |
| 7 | board-editor-card-style.test.tsx — BoardEditor cardStyle starts the Theme pill and note names from cardStyle | 0.700 | row-layout.test.tsx — row layout lands on a whole track for every column count and row length | 0.595 |
| 8 | board-editor-card-style.test.tsx — BoardEditor cardStyle re-seeds the note-name form from a style that changed mid-edit once editing ends | 0.688 | board-editor.test.tsx — BoardEditor embedded in a message draft loads the host's board, saves edits back once, and leaves playground storage alone | 0.590 |
| 9 | board-editor.test.tsx — BoardEditor embedded in a message draft host ref keeps a card's ref while it is open for editing and only annotations change | 0.651 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words opening a saved keyboard card preserves stored controls and values | 0.580 |
| 10 | row-layout.test.tsx — row layout lands on a whole track for every column count and row length | 0.623 | board-editor-card-style.test.tsx — BoardEditor cardStyle adds a card without baking the board's note names into its chord | 0.557 |

### react — idle

Before: 394 tests, 0 failures. After: 394 tests, 0 failures.

| Rank | Before test | Before s | After test | After s |
|---|---|---:|---|---:|
| 1 | InteractiveInput.annotation-disabled.test.tsx — InteractiveInput annotation controls on guitar display disables Note names, Degrees and Fingering only while the display mode is guitar | 5.636 | GuitarChord.lazy.test.tsx — does not import guitar implementations until rendered, and marks loading then ready | 2.160 |
| 2 | InteractiveInput.level-control.test.tsx — InteractiveInput level control clicking a radio changes which guitar shapes are shown | 4.671 | InteractiveInput.legacy-level.test.tsx — editing a legacy guitar card with no stored level does not rewrite the card's stored fret position | 1.971 |
| 3 | InteractiveInput.legacy-level.test.tsx — editing a legacy guitar card with no stored level does not rewrite the card's stored fret position | 1.545 | verovio-prefetch.test.ts — prefetchVerovio is exported from the package index | 1.811 |
| 4 | verovio-prefetch.test.ts — prefetchVerovio is exported from the package index | 1.284 | InteractiveInput.annotation-disabled.test.tsx — InteractiveInput annotation controls on guitar display disables Note names, Degrees and Fingering only while the display mode is guitar | 1.623 |
| 5 | GuitarChord.lazy.test.tsx — does not import guitar implementations until rendered, and marks loading then ready | 1.086 | InteractiveInput.level-control.test.tsx — InteractiveInput level control clicking a radio changes which guitar shapes are shown | 1.555 |
| 6 | InteractiveInput.level-control.test.tsx — InteractiveInput level control clicking a radio changes the piano voicings shown, in Keyboard mode too | 0.764 | InteractiveInput.play-mode-hotkey.test.tsx — dev app — p enters play mode enters play mode on a bare p while the editing board is shown | 0.926 |
| 7 | InteractiveInput.add-to-board.test.tsx — InteractiveInput + Add to board — piano voicing stores the selected variant, not the typed chord | 0.733 | InteractiveInput.level-control.test.tsx — InteractiveInput level control is not disabled while the display mode is guitar, unlike its row-mates | 0.853 |
| 8 | audio-lazy-loading.test.ts — audio dependency loading does not import smplr when export/playback modules or pure helpers are used | 0.633 | InteractiveInput.add-to-board.test.tsx — InteractiveInput + Add to board — piano voicing stores the selected variant, not the typed chord | 0.751 |
| 9 | InteractiveInput.level-control.test.tsx — InteractiveInput level control is not disabled while the display mode is guitar, unlike its row-mates | 0.616 | InteractiveInput.add-to-board.test.tsx — InteractiveInput — a reported voicing does not outlive the chord box does not carry the finished chord into the next card after Done | 0.727 |
| 10 | InteractiveInput.play-mode-hotkey.test.tsx — dev app — p enters play mode enters play mode on a bare p while the editing board is shown | 0.600 | playback-config.test.ts — audio source defaults loads General MIDI patches by name, leaving smplr to pick its own host | 0.662 |

### board — loaded

Before: 345 tests, 0 failures. After: 345 tests, 0 failures.

| Rank | Before test | Before s | After test | After s |
|---|---|---:|---|---:|
| 1 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano | 9.883 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words switches to the real ukulele controls and Beginner, then back to piano | 5.941 |
| 2 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear | 5.473 | board-editor-card-style.test.tsx — BoardEditor cardStyle opening a card keeps its own note-name text a card whose names match the board still saves them on open | 3.899 |
| 3 | board-editor.test.tsx — BoardEditor embedded in a message draft opens a catalogue chord without overwriting the card being edited | 3.309 | board-editor-card-style.test.tsx — BoardEditor cardStyle re-seeds the note-name form from a style that changed mid-edit once editing ends | 2.404 |
| 4 | board-editor.test.tsx — BoardEditor embedded in a message draft loads the host's board, saves edits back once, and leaves playground storage alone | 3.208 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words leaves manual choices alone while parsed words stay the same or disappear | 2.207 |
| 5 | lazy-export.test.tsx — export libraries load on demand BoardPlayer renders without loading html2canvas or jspdf | 2.977 | board-editor.test.tsx — BoardEditor embedded in a message draft loads the host's board, saves edits back once, and leaves playground storage alone | 2.100 |
| 6 | board-editor-card-style.test.tsx — BoardEditor cardStyle opening a card keeps its own note-name text a plain card on the same board stays plain on open | 2.648 | board-editor-instrument-words.test.tsx — BoardEditor instrument and level input words opening a saved guitar card preserves stored controls and values | 1.854 |
| 7 | on-demand.test.tsx — piano mount does not warm notation; Display intent still does | 2.273 | board-player-error-boundary.test.tsx — BoardPlayer — a card that throws during render is the same card ChordBoard already survives | 1.613 |
| 8 | text-cards.test.tsx — text cards renders chord and text cards together, in board order | 2.240 | export-chrome.test.tsx — export chrome marks the export root so capture styling can apply | 1.586 |
| 9 | board-editor.test.tsx — BoardEditor embedded in a message draft host ref attaches the ref to the new card, not the card that was being edited | 2.215 | on-demand.test.tsx — a guitar board card without a shape settles on a ready notice with no loading marker | 1.550 |
| 10 | board-editor.test.tsx — BoardEditor embedded in a message draft host ref clears a card's ref when its chord text is retyped | 2.169 | card-style-render.test.tsx — cardStyle on ChordBoard draws every keyboard card with the board's theme | 1.539 |

### react — loaded

Before: 394 tests, 0 failures. After: 394 tests, 0 failures.

| Rank | Before test | Before s | After test | After s |
|---|---|---:|---|---:|
| 1 | InteractiveInput.annotation-disabled.test.tsx — InteractiveInput annotation controls on guitar display disables Note names, Degrees and Fingering only while the display mode is guitar | 11.877 | InteractiveInput.annotation-disabled.test.tsx — InteractiveInput annotation controls on guitar display disables Note names, Degrees and Fingering only while the display mode is guitar | 6.569 |
| 2 | InteractiveInput.level-control.test.tsx — InteractiveInput level control clicking a radio changes which guitar shapes are shown | 11.097 | InteractiveInput.legacy-level.test.tsx — editing a legacy guitar card with no stored level does not rewrite the card's stored fret position | 5.170 |
| 3 | InteractiveInput.legacy-level.test.tsx — editing a legacy guitar card with no stored level does not rewrite the card's stored fret position | 5.552 | verovio-prefetch.test.ts — prefetchVerovio is exported from the package index | 4.345 |
| 4 | verovio-prefetch.test.ts — prefetchVerovio is exported from the package index | 5.137 | GuitarChord.lazy.test.tsx — does not import guitar implementations until rendered, and marks loading then ready | 4.112 |
| 5 | GuitarChord.lazy.test.tsx — does not import guitar implementations until rendered, and marks loading then ready | 3.603 | InteractiveInput.level-control.test.tsx — InteractiveInput level control is not disabled while the display mode is guitar, unlike its row-mates | 3.081 |
| 6 | InteractiveInput.level-control.test.tsx — InteractiveInput level control is not disabled while the display mode is guitar, unlike its row-mates | 2.982 | InteractiveInput.level-control.test.tsx — InteractiveInput level control renders with Emerging checked by default | 3.045 |
| 7 | GuitarChordPanel.export.test.tsx — GuitarChordPanel zip export shows the .zip button for guitar | 2.877 | InteractiveInput.add-to-board.test.tsx — InteractiveInput + Add to board — piano voicing stores the selected variant, not the typed chord | 2.883 |
| 8 | GuitarChordPanel.export.test.tsx — GuitarChordPanel zip export All: one A_/B_… subfolder per visible position, each with all five files | 2.869 | InteractiveInput.level-control.test.tsx — InteractiveInput level control clicking a radio changes which guitar shapes are shown | 2.792 |
| 9 | InteractiveInput.play-mode-hotkey.test.tsx — dev app — p enters play mode enters play mode on a bare p while the editing board is shown | 2.831 | InteractiveInput.add-to-board.test.tsx — InteractiveInput + Add to board — piano voicing stores the plain chord when no pill has been clicked | 2.414 |
| 10 | InteractiveInput.add-to-board.test.tsx — InteractiveInput — a reported voicing does not outlive the chord box does not rewrite a card's chord when it is opened for editing | 2.762 | InteractiveInput.add-to-board.test.tsx — InteractiveInput — a reported voicing does not outlive the chord box does not carry the finished chord into the next card after Done | 2.032 |

## Acceptance and verification
- [x] Four before/after top-ten tables above (board/react, idle/loaded).
- [x] No board/react test exceeds 10s in the final three-suite run: board max **5.941s**, react max **6.569s**; both suites pass, 345 + 394 tests.
- [x] No assertion removed/weakened; per-file coverage recorded above.
- [x] Test count unchanged: **2,943** total.
- [x] Required build, lint, lint:test, full tests and React site build pass.

```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

Build and production lint passed in `/tmp/0051-verify-final.log`. An intermediate lazy-test synchronization attempt triggered the retained exact import-count assertion (2 vs 1); corrected by using a completion signal from the original import spies. Since then, test type checks, full tests and site build were repeated successfully, recorded in `/tmp/0051-lint-test-final.log`, `/tmp/0051-tests-final.log`, `/tmp/0051-site-final.log`. Only test code changed after the successful build/production lint.

Verification output (final passing stages):
```text
pnpm build: exit 0
pnpm lint: exit 0
pnpm lint:test: exit 0 (all eight packages)
Test Files  9 passed (9)
Tests  176 passed (176)
Test Files  16 passed (16)
Tests  694 passed (694)
Test Files  1 passed (1)
Tests  13 passed (13)
Test Files  19 passed (19)
Tests  337 passed (337)
Test Files  9 passed (9)
Tests  161 passed (161)
Test Files  51 passed (51)
Tests  394 passed (394)
Test Files  26 passed (26)
Tests  823 passed (823)
Test Files  28 passed (28)
Tests  345 passed (345)
Total: 2943 passed
✓ built in 5.32s
pnpm --filter @pepperhorn/chordl-react build:site: exit 0
git diff --check: exit 0
```

## Decisions made
Use external-engine mocks only in control-focused tests; leave dedicated notation tests untouched. Keep the actual guitar implementations and renderer in the lazy-load test, and explicitly settle their existing import spies after observing the fallback. Scope board accessibility queries to the relevant control instead of changing semantics. No timeout, config or production changes; no ADR proposed.

## Out-of-scope issues and follow-ups
The concurrent cards workload ended with 822/823 passing: `positionsFor: the alternatives > six-string alternatives keep the root lowest` failed at 5.125s (`STACK_TRACE_ERROR` in JSON; test file `positions.test.ts`). Cards also had a timeout in the discarded build-overlap run, but passed the baseline and recheck1 stress runs and both normal full verification runs. No cards files were edited. Lead should consider a separate cards stress-budget/performance task; this PR establishes the requested board/react target, not all-package stress reliability.

## Known gotchas / for GBrain (lead to promote)
GBrain was searched for chordl test/workspace/performance context; no relevant result was used. Workspace builds are necessary because the dev-app tests traverse built board/react packages. Mocking the external Verovio modules reaches those built imports, whereas mocking only a source helper would miss them. Under load, real lazy-module transformations can outlast a DOM wait; waiting on the existing import spies inside act retains loading/ready coverage and avoids duplicating imports. Local raw measurement files live in /tmp; durable ranked results are in this handoff. Implementer did not write GBrain.

## Current state / open questions
Code commits: `440d01c`, `dcb32d1`, `3d9e892`; receiver acknowledgement: `20dbd21`. All changes confined to owned test directories and task handoffs. No dev server, live writes or publication. Open product/scope questions: none. Lead next action: review draft PR and decide merge; consider the separate cards stress failure above.
