# Handoff: 0048 — Resolver Δ7 / mΔ7 spellings (sol → lead)

- **Date:** 2026-11-10 · **Type:** return · **Ledger:** 0048
- **Branch:** orch/0048-resolver-delta7
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-33bc70cb
- **Base:** afba74cbbf4b399bd84b5035af65d7994881cade (contains required 4911f61 baseline)
- **Implementation commit:** 84e67b2
- **Dispatch:** [lead → sol](2026-11-10-0048-resolver-delta7--lead-to-sol.md)
- **PR:** draft opened after committing this return; linked from the implementation report.
- **Status:** closed

## Goal and scope
Accept Δ7 as maj7 and mΔ7 as mMaj7; treat U+2206 ∆ like U+0394 Δ. Preserve existing Δ forms and remove the parser's temporary rejection exception.

**Files owned and changed:** `packages/chordl-core/src/resolver/chord-resolver.ts`, the exception only in `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/test/chord-resolver.test.ts`, `packages/chordl-core/test/natural-language.test.ts`, and this task's two handoffs. Other packages, parser behavior, ledger, dependencies and public signatures are out of scope and unchanged.

## Acceptance criteria
- [x] Explicit note and canonical-result table for CΔ7, CmΔ7, C∆7, C∆, BbΔ7/D, F#mΔ7; preserve CΔ, CΔ9, CmΔ. Additional Cm∆7, C∆9 and CΔ7#11 cases.
- [x] Parser cases exercise Δ7/mΔ7 and ∆7/m∆7 standalone, in prose, parentheses and trailing punctuation. Former CΔ7 error assertion now checks C E G B.
- [x] Both sweeps pass with zero differences; no sweep expectation changes needed.
- [x] Full verification passed (results below).

## Decisions made
Normalize ∆ to Δ and only replace Δ7 with maj7 before the existing minor-major casing normalization. Tonal continues to handle existing Δ aliases, so Δ9 and other Δ forms keep their previous behavior. Parser change deletes exactly the three-line exception; the resolver fallback now succeeds naturally.

## Known gotchas
GBrain search `chordl resolver Δ7` found no relevant project notes. Repo dispatch is authoritative. Sweep scripts generate Tonal dictionary aliases; explicit new spelling tables provide the new-alias coverage. Parser compatibility sweep uses the current resolver for both parser versions, so zero parser differences verifies exception removal rather than baseline resolver acceptance.

## Verify with
```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
node packages/chordl-core/test/resolver-regression-sweep.mjs
node packages/chordl-core/test/parser-compat-sweep.mjs 4911f61
```

## Sweep summaries
Resolver:
```json
{
  "base": "main",
  "total": 54960,
  "aliases": 229,
  "roots": 15,
  "bassForms": 16,
  "differences": 0,
  "byKind": {},
  "failures": [],
  "report": "/tmp/chordl-resolver-sweep-ULS7sJ/diff.json"
}
```
Parser:
```json
{
  "base": "4911f61",
  "baseHead": "4911f61fa7c950362882f97c7a3e523675e73242",
  "noteGroupInterpretations": 1362,
  "symbols": 3248,
  "slash": 1800,
  "inputs": 61196,
  "same": 61196,
  "differences": 0,
  "expectedChanges": {
    "interjection": 0,
    "trailingSlashHand": 0
  },
  "unexpected": 0,
  "report": "/tmp/chordl-parser-compat-5uFdCr/diffs.json"
}
```

## Verification output
All commands exited 0. Full suite: **159 files, 2959 tests passed** (including 710 core tests).

```text
pnpm build: PASS
pnpm lint: PASS
pnpm lint:test: PASS (all eight packages)
pnpm test:run:
Test Files  9 passed (9)
Tests  176 passed (176)
Duration  1.87s (transform 3.98s, setup 0ms, import 7.81s, tests 888ms, environment 2ms)
Test Files  16 passed (16)
Tests  710 passed (710)
Duration  4.62s (transform 9.03s, setup 0ms, import 15.95s, tests 4.07s, environment 4ms)
Test Files  1 passed (1)
Tests  13 passed (13)
Duration  307ms (transform 105ms, setup 0ms, import 132ms, tests 11ms, environment 0ms)
Test Files  19 passed (19)
Tests  337 passed (337)
Duration  5.65s (transform 2.92s, setup 0ms, import 5.33s, tests 9.65s, environment 4ms)
Test Files  9 passed (9)
Tests  161 passed (161)
Duration  1.78s (transform 4.64s, setup 0ms, import 11.16s, tests 478ms, environment 2ms)
Test Files  51 passed (51)
Tests  394 passed (394)
Duration  14.61s (transform 10.22s, setup 12.35s, import 26.94s, tests 45.33s, environment 49.71s)
Test Files  26 passed (26)
Tests  823 passed (823)
Duration  42.38s (transform 6.91s, setup 7.08s, import 18.31s, tests 90.67s, environment 26.01s)
Test Files  28 passed (28)
Tests  345 passed (345)
Duration  20.33s (transform 17.57s, setup 15.70s, import 47.78s, tests 62.85s, environment 54.25s)
pnpm --filter @pepperhorn/chordl-react build:site: PASS
✓ built in 36.04s
git diff --check: PASS
```

Build output contains TypeScript/API Extractor version and large-chunk advisories; jsdom reports unsupported navigation during passing UI tests. No failures or source changes outside scope. Logs: `/tmp/chordl-0048-{build,lint,lint-test,test,site}.log`.

Direct comparison using the sweep's baseline/head resolver modules: all six requested new spellings threw before and resolve to the table notes now; CΔ, CΔ9 and CmΔ notes match baseline.


## Return
- **Outcome:** done
- **Open questions:** none.
- **Out-of-scope issues / follow-ups:** none identified.
- **For GBrain (lead to promote):** Δ7/mΔ7 and ∆ spellings now resolve in core; parser no longer needs the 0038 Δ7 exception. No architectural decision needed.

## Review r1 response

- **Review:** [5832235935](https://github.com/pepperhorn/chordl/pull/118#pullrequestreview-5832235935), reviewed head 200e264.
- **Lead decisions:** [8f3ad13 dispatch](https://github.com/pepperhorn/chordl/blob/8f3ad13/docs/handoffs/2026-11-10-0048-resolver-delta7--lead-r1-decisions.md). Acknowledged: guard capital M and extend the resolver sweep; preserve all explicitly deferred behaviors.
- **Fix commit:** da3b166.
- **Scope added by lead:** `packages/chordl-core/test/resolver-regression-sweep.mjs`.
- **Blocking finding fixed:** Δ7 rewriting now uses `/(?<!M)Δ7/g` after ∆ normalization. CMΔ7 and CM∆7 throw; both have unit regressions.
- **Coverage fixed:** the sweep generates Δ7, mΔ7, ∆7, m∆7, ∆ and ∆9 for all 15 roots, standalone and with all 15 slash basses (1440 canonical-result checks). It also checks 480 MΔ7/M∆7 rejection cases. Canonical checks run before skipping unchanged rows, so loss of new spelling support fails even when the baseline also rejects it.
- **Sweep failure checks:** temporary script copies injected mutations into the in-memory source, leaving tracked sources untouched. Removing the M guard failed with 480 symbols; removing normalization failed with 1440 symbols (exit 1 each). Temporary scripts removed.
- **Deferred exactly as directed:** pre-existing `/mmaj/i`, rootless Δ, and rewritten error names.

### R1 sweep summaries
```json
{
  "base": "main",
  "total": 56400,
  "aliases": 235,
  "roots": 15,
  "bassForms": 16,
  "newSpellingCases": 1440,
  "rejectionCases": 480,
  "expectedNewlyAccepted": 1440,
  "differences": 1440,
  "byKind": {
    "newly accepted": 1440
  },
  "failures": [],
  "report": "/tmp/chordl-resolver-sweep-hRJKNh/diff.json"
}
```
```json
{
  "base": "4911f61",
  "baseHead": "4911f61fa7c950362882f97c7a3e523675e73242",
  "noteGroupInterpretations": 1362,
  "symbols": 3248,
  "slash": 1800,
  "inputs": 61196,
  "same": 61196,
  "differences": 0,
  "expectedChanges": {
    "interjection": 0,
    "trailingSlashHand": 0
  },
  "unexpected": 0,
  "report": "/tmp/chordl-parser-compat-vWO3aM/diffs.json"
}
```

### R1 verification
All commands below exited 0 on the r1 implementation (da3b166); handoff-only commit follows. Full tests: **2961 passed across 159 files** (core 712).

```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
node packages/chordl-core/test/resolver-regression-sweep.mjs
node packages/chordl-core/test/parser-compat-sweep.mjs 4911f61
```

```text
pnpm build: PASS
pnpm lint: PASS
pnpm lint:test: PASS
pnpm test:run:
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
pnpm --filter @pepperhorn/chordl-react build:site: PASS
✓ built in 11.26s
resolver sweep: 56400 comparisons; 1440 intended newly accepted; 1440 canonical checks; 480 rejection checks; failures []
parser sweep vs 4911f61: 61196 inputs; differences 0; unexpected 0
git diff --check: PASS
```

Logs: `/tmp/chordl-0048-r1-{build,lint,lint-test,test,site}.log`. Scope audit: only the resolver guard, core regression tests, newly owned resolver sweep, and this return handoff changed in r1. No open questions. Ready for lead's independent re-review; no merge performed.
