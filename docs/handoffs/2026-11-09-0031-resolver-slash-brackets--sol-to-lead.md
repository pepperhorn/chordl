# Handoff: 0031 — resolver slash brackets (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0031 (lead ledger is external; local ledger has no 0031 row)
- **Spec / plan:** none; [dispatch](2026-11-09-0031-resolver-slash-brackets--lead-to-sol.md), original read-only brief `/home/shaun/trans/docs/superpowers/handoffs/2026-11-09-0031-resolver-slash-brackets--lead-to-sol.md`
- **Branch:** `orch/0031-resolver-slash-brackets`
- **Worktree:** `/home/shaun/.t3/worktrees/chordl/orch-0031-resolver-slash-brackets`
- **Base:** `fe5c056a6a5c0e2bc7605ddf70bdd116081368fb` (main and origin/main)
- **Status:** closed (implementation complete; draft PR for lead review)

## Goal
Resolve alteration-fallback slash chords correctly, retain bracketed parser symbols, and preserve base-quality labels. PR #103 reviews were read before implementation.

## Scope
- **Owned:** core resolver files, natural-language parser, their tests, core package version/CHANGELOG, and 0031 handoffs.
- **Out:** other package source, ledger, /home/shaun/trans edits, production writes, publishing, tags, deployments, merges.
- Changed only owned files. No environment file or running server required.

## Acceptance criteria
- [x] Catalogue bracketed canonical/display/alias spellings × 15 roots × 15 slash bass spellings either match catalogue pitch classes plus bass, preserve root and bass, or throw Unknown chord. All 55 previously supported suffixes resolve on every root/bass combination (12,375 successful combinations).
- [x] Explicit slash examples and inversion ordering pass.
- [x] Parser preserves Bm7b5(b9), Em7(b9) in the right hand, G#dim7(b9), multi-alteration commas and slash basses; 6/9 extraction still passes.
- [x] Type labels include half-diminished (extended) and lydian dominant seventh (extended).
- [x] Non-bracket main/head comparison completed; see below.
- [x] Build, lint, full workspace tests and site build pass.

## What changed / decisions made
- Split only a terminal `/[A-G][#b]?` bass before normalizing/analyzing alterations. Numeric 6/9 stays part of the quality.
- Run the fallback on the upper chord, replacing altered degrees before applying the bass. Rotate a chord tone into bass by pitch class; prepend an external pedal. Simplify bass spelling consistently with existing notes. Apply explicit inversion afterward.
- Fallback intervals describe the upper chord; bass rotation does not rotate them, and external pedal does not add a quality interval.
- For fallback metadata, use Tonal’s base plus first alteration when known, otherwise the unaltered base. This preserves qualities such as half-diminished without changing note construction.
- The natural-language extractor accepts the same ASCII alteration bracket grammar as the resolver and keeps commas inside parentheses.
- Patch-bump core 0.6.1 → 0.6.2 and add CHANGELOG entry.

## Regression sweep
Reproduce from repo root after installing dependencies:

```bash
node packages/chordl-core/test/resolver-regression-sweep.mjs fe5c056a6a5c0e2bc7605ddf70bdd116081368fb
```

The script transpiles base/head resolver sources into a temporary directory, uses the same installed Tonal for both, compares full result objects, and writes every difference as JSON. Its 32 extra symbols are listed in the script alongside all Tonal aliases (229 unique non-bracket suffixes total). Inputs: 229 suffixes × 15 roots × (bare + 15 slash basses) = **54,960**.

- **5,655 differences:** 2,250 newly accepted; 1,435 changed pitch-class sets; 1,970 metadata/order changes; zero new throws.
- **255 bare differences:** type metadata only; zero bare pitch changes.
- **5,400 slash differences:** independently checked against the resolved upper chord plus the requested bass, with root and lowest pitch preserved; zero failures.
- Pitch changes occur only in slash forms of `7b5b13`, `7b5#9`, `7#9b5`, `9b5b13`, `7b5b9`, `7b9b5`, `7b5b9b13`: altered fifth replaces the natural fifth. External basses can mask the pitch-set change, accounting for metadata/order cases in these families.
- Newly accepted slash families: `m7b5b9`, `dim7b9`, `m7b9`, `13#9b5`, `maj7b5`, `m11b5`, `7b13b9`, `7#11b9`, `7sus4b9`, `maug` (225 each). Upper normalization also makes the existing maug→m#5 rule work with slash basses.
- Other changes preserve pitch classes and follow fallback quality labels, interval representation or bass ordering.

## Verify with / verification output
```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
VITEST_MAX_WORKERS=2 pnpm -r --workspace-concurrency=1 test:run --testTimeout=30000
pnpm --filter @pepperhorn/chordl-react build:site
```

All commands above exited 0 (complete workspace tests and site build on rerun).

```text
pnpm build: exit 0 (cards dist import check passed; board tsc completed)
pnpm lint: exit 0
full prescribed recursive test command, clean rerun: exit 0
  guitar:   19 files / 337 tests passed
  listen:    1 file  / 13 tests passed
  voicings:  9 files / 176 tests passed
  core:     16 files / 576 tests passed
  voicing:   9 files / 161 tests passed
  board:    26 files / 337 tests passed
  react:    49 files / 385 tests passed
  cards:    26 files / 822 tests passed
  total: 2,807 tests passed
site build rerun: exit 0; built in 1m 3s
regression sweep: exit 0; 54,960 inputs; failures []
```

Local logs: `/tmp/chordl-0031-{build,lint,tests-rerun,site-rerun}.log`.
Full diff artifact: `/tmp/chordl-resolver-sweep-whboYw/diff.json`; rerunning the committed script regenerates it in a fresh temporary directory.

## Known gotchas / follow-ups
- GBrain search for chordl resolver brackets found no relevant page; no GBrain writes by implementer.
- The first site build overlapped workspace build and failed to find board declarations. Rerun after full build passed; no source fix required.
- Initial full suite failed one board instrument test at its `waitFor` selecting Ukulele. Isolated rerun passed 6/6 without source changes; complete prescribed command rerun passed all 2,807 tests.
- No publishing or tags. Any packed-consumer CI using unpublished core versions remains a lead release gate.
- Existing core-test→cards-source parity dependency retained; no new production dependency.
- No open questions. Lead owns review, merge, ledger and GBrain promotion.

## Return
- **Implementation commits:** `6527ac2` (fix/tests/version), `82b4944` (reproducible sweep); dispatch ack `5258b70`.
- **Outcome:** done
- **PR:** draft against main, opened immediately after committing this return; see the PR body’s Return handoff section for the complete return.
- **For GBrain (lead to promote):** slash alteration fallback must inspect upper chord before slash parsing can hide the trailing alteration list; a bass matching an altered chord tone must rotate by pitch class.
