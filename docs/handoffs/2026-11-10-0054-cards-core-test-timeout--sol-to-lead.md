# Handoff: 0054 — cards and core tests: timeouts under load (sol → lead)

- **Date:** 2026-11-10
- **Type:** return (quick)
- **Ledger:** 0054; spec/plan: none (quick)
- **Branch:** `orch/0054-cards-core-test-timeout`
- **Worktree:** `/home/shaun/.t3/worktrees/chordl/t3-92d4e2ac`
- **Base commit:** `07c756b2257f895646863d78ae3552389d1d80fa` (contains dispatch; `80ec59c` is an ancestor)
- **PR:** pending creation
- **Status:** done; awaiting lead review

## Goal / context
Prevent load-related cards/core timeouts, first reducing test work without weakening coverage. Dispatch: [lead → sol](2026-11-10-0054-cards-core-test-timeout--lead-to-sol.md). Prior review: https://github.com/pepperhorn/chordl/pull/120#pullrequestreview-5832389660.

## Scope / files owned
Owned: `packages/chordl-cards/test/**`, cards Vitest config, only the core catalogue-timeout test and its helpers, core Vitest config, and this task's handoffs. Changed: cards `test/positions.test.ts`, `test/describe.test.ts`, `vitest.config.ts`; core `test/chord-resolver.test.ts`, new `vitest.config.ts`; receiver ack and return handoff. No source, other packages, dependencies, public APIs, ledger, or production changes.

## What changed / decisions made
- Cache real `positionsFor` results by chord/face in the test helper. These consumers only read the results; all original sweep inputs and assertions remain. The direct limit, example, exception and export tests still invoke the original functions.
- Hoist core `spellChord(root, type)` and root pitch-class calculation out of the bass loop; retain every resolver invocation. Use Vitest strict assertions for the two inner scalar comparisons, preserving expected values and the symbol in failure messages.
- Use Node strict assertions for the shared description text checks. During optimization-only validation at extreme host load, the exhaustive description test reached 152.338s and exceeded its existing 120s override. No cases were dropped and that override remains 120s.
- Add explicit 30000ms test/hook budgets in cards/core, matching board/react. Optimization-only results still exceeded 5s: cards 5.229s alone; core 8.439s alone / 8.032s concurrent. Earlier final-candidate measurements reached 5.9s for cards and 11.123s for core under load; final repeated measurements after correcting the core assertion import appear below. Budget changes are supported by residual measured cost, not a substitute for reducing duplicate work.
- GBrain searches for chordl and timeout/catalogue/positions returned no relevant project decisions; no GBrain page used. Implementer made no brain writes. Lead may promote the measurements and test-only reuse/strict-assertion approach. Core does not declare Node types, so its inner assertions use Vitest’s exported `assert.strictEqual`; cards already has Node types. The first verify attempt caught this import typing issue before tests; fixed without dependency changes.

## Assertions preserved (one line per affected test)
- Cards “is item 0, byte-identical to requestFor”: same example chords/faces prove card identity, label/kind and request bytes.
- Cards “are distinct sounding shapes…”: same 130 chords × four faces prove unique shapes/labels/IDs, neck ordering and fret-based IDs.
- Cards “every one sounds the chord…”: same sweep proves allowed/required tones and top-three card pitch-class equality.
- Cards “six-string alternatives keep the root lowest”: every original guitar case retains the lowest-note/root check.
- Cards “bass alternatives play root, fifth, octave”: every original bass case retains root, fifth distance and octave distance checks.
- Cards “fit the face's window…”: all original fret limits, relative frets, nut/window starts and open-string constraints remain.
- Cards “are held by at most four fingers”: every original alternative's finger/barre labels stay constrained to 1–4.
- Cards “describes each catalogue face…”: same full catalogue/slash sweep checks rejection parity, nonempty joined text, spelling/speech sanitization, open/muted/barre/window facts and described/omitted coverage counts.
- Cards “describes every alternative position…”: same alternatives retain all text checks, open/muted checks and >60 coverage count.
- Core “every bracketed catalogue alias with every slash bass…”: same inputs retain explicit unknown-chord errors, independent expected pitch-class sets, first-note bass/root identity, zero mismatches, 55 accepted aliases and all 15² cases per alias.

## Measurement method and limits
Each invocation: `pnpm --filter @pepperhorn/chordl-<package> exec vitest run --reporter=json --outputFile=/tmp/0054-<phase>-<mode>-<package>.json`.
`/tmp/0054-measure.py` runs cards/core serially for the standalone measurement, then launches full cards/core/react suites together with Python `ThreadPoolExecutor(3)` for each loaded round, waiting for all three before the next round. Durations are Vitest JSON `assertionResults[].duration`; suite wall includes process startup/imports. No CLI timeout overrides.

“Alone” means no other suite launched by this task: the shared host was never idle. Baseline one-minute load was approximately 45–82; optimization-only reached ~102; the earlier final candidate ran around 55–78, with the repeated final runs recorded in the JSON summaries. These are observed timings under varying contention, not a controlled CPU benchmark. Baseline cards/core concurrent both failed (822/823 and 711/712); react passed 394/394. Optimization-only results intentionally retained 5s limits to establish the remaining need for explicit budgets.

| Measured cost (seconds) | Before alone | Before concurrent | After alone | After loaded 1 | After loaded 2 | After loaded 3 |
|---|---:|---:|---:|---:|---:|---:|
| All positions tests, sum | 14.788 | 20.000 | 4.549 | 9.957 | 11.096 | 14.102 |
| Positions slowest test | 4.317 | 6.672 | 2.927 | 4.364 | 5.407 | 5.734 |
| Positions chord-tone sweep | 4.005 | 4.601 | 0.227 | 1.220 | 0.477 | 2.145 |
| Catalogue descriptions | 59.838 | 106.662 | 41.393 | 48.736 | 73.055 | 70.394 |
| Core slash catalogue | 6.269 | 10.613 | 2.744 | 13.146 | 7.751 | 5.478 |

| Final run | Cards | Core | React | Suite wall seconds (cards/core/react) |
|---|---|---|---|---|
| Loaded 1 | 823/823 pass (exit 0) | 712/712 pass (exit 0) | 394/394 pass (exit 0) | 66.64 / 27.27 / 45.79 |
| Loaded 2 | 823/823 pass (exit 0) | 712/712 pass (exit 0) | 394/394 pass (exit 0) | 102.83 / 21.13 / 57.67 |
| Loaded 3 | 823/823 pass (exit 0) | 712/712 pass (exit 0) | 394/394 pass (exit 0) | 89.9 / 19.86 / 63.35 |

## Acceptance / verification
- Before/after standalone and three-suite timings recorded above; all three final loaded rounds passed cards/core/react.
- Assertions retained as described above; no tests added or removed.
- Build, lint and lint:test passed. Full test retry passed all **2,961** tests (unchanged); React site build passed.
- The exact chained verify attempt stopped on an unrelated, unchanged guitar test: `voicingQuality.test.ts`, “retains the named ninth under #11…” exceeded its 5s default (8.449s). Reran `pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site` unchanged: exit 0. No guitar files edited. All required verification stages have passing results, with this load-related retry disclosed.
- Scope audit: only the five owned test/config files and the two 0054 handoffs changed; `git diff --check` clean.

```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

### Verification output (selected actual lines)
```text
 Test Files  9 passed (9)
      Tests  176 passed (176)
 Test Files  16 passed (16)
      Tests  712 passed (712)
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
✓ built in 20.82s
```

Full local logs: `/tmp/0054-verify-final.log` (chain through guitar timeout), `/tmp/0054-verify-retry.log` (full tests + site, exit 0). Initial import/type-check correction is recorded above.

## Open questions / follow-ups
No implementation questions. Guitar’s independent 5s timeout is a follow-up for the lead, outside this task’s owned files. Lead owns cross-family review and merge. Host contention substantially changes timings; retained explicit 120s/60s catalogue overrides remain independent of the new default budgets. No server, deployment, publication, or live writes.

---
## Receiver ack
Lead to acknowledge through the ledger; implementer has not edited it.
