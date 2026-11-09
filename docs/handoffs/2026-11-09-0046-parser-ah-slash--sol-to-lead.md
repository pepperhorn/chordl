# Handoff: 0046 — Parser interjections and trailing slash (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0046 · **Spec:** [0038](../specs/0038-parser-strict-roots.md) · **Plan:** none (quick)
- **Branch:** orch/0046-parser-ah-slash
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-8585972f
- **PR:** https://github.com/pepperhorn/chordl/pull/113 (draft)
- **Base commit:** 9da30666defb1d3de5d8c4a2de03287ee200e2e6
- **Status:** done

## Goal and context
Fix the two parser review minors in the [dispatch handoff](2026-11-09-0046-parser-ah-slash--lead-to-sol.md), with the corrected expectation and expanded ownership in the [lead answers](https://github.com/pepperhorn/chordl/blob/5441619/docs/handoffs/2026-11-09-0046-parser-ah-slash--lead-answers.md).

## Scope / files owned
- packages/chordl-core/src/parser/natural-language.ts
- packages/chordl-core/test/natural-language.test.ts
- packages/chordl-core/test/parser-compat-sweep.mjs (0046 classifications only, authorized by lead answers)
- Own dispatch acknowledgement and return handoff.
- **Out:** other files, ledger, resolver, dependencies, API/UI changes, merge/publication.

## What changed
Added ah/eh to the resolver fallback English stoplist and slash to trailing punctuation cleanup. Nine table cases cover both issues and every requested input, preserving Ah7/Ab7 and written CΔ7/G. The left-hand case asserts both chordName Cmi7 and E in a left-hand note group. The sweep recognizes Ah/Eh as interjections and labels the 0046 intended differences without relaxing modifier checks.

## Lead answers response
Acknowledged answers at 5441619. The lead confirmed the original Cmi7/E left-hand expectation was wrong: preserve existing hand-note extraction, matching Cm7/E. Amended the test accordingly; no slash/hand semantics changed. Used expanded ownership solely to classify the 24 interjection removals and 309 trailing-slash hand recoveries in the sweep. This resolves the earlier blocked return; no open questions remain.

## Acceptance criteria
- [x] All nine added table cases pass, including the corrected hand-note expectation.
- [x] Compatibility sweep against 9da3066 exits 0; only intended differences.
- [x] Full verify command passes.
- [x] Scope audit and git diff --check pass; own branch pushed and existing draft PR updated.

## Verification
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
node packages/chordl-core/test/parser-compat-sweep.mjs 9da3066
```
Both commands exit 0. Full verification output summary:
```text
pnpm build: PASS
pnpm lint: PASS
pnpm test:run: PASS
  chordl-voicings: 176 passed
  chordl-core: 694 passed (includes natural-language: 300)
  chordl-listen: 13 passed
  chordl-guitar: 337 passed
  chordl-voicing: 161 passed
  chordl-react: 385 passed
  chordl-cards: 822 passed
  chordl-board: 337 passed
  Total: 2925 passed
pnpm --filter @pepperhorn/chordl-react build:site: PASS (built in 10.58s)
git diff --check: PASS
```
Clean sweep summary:
```json
{
  "base": "9da3066",
  "baseHead": "9da30666defb1d3de5d8c4a2de03287ee200e2e6",
  "noteGroupInterpretations": 1362,
  "symbols": 3248,
  "slash": 1800,
  "inputs": 61196,
  "same": 60863,
  "differences": 333,
  "expectedChanges": {
    "interjection": 24,
    "trailingSlashHand": 309
  },
  "unexpected": 0
}
```
All 333 differences classified: 24 interjection changes, 309 trailing-slash hand recoveries. Only chordName changes; no modifier metadata changes. Independent report inspection confirmed every difference has one of these two classifications. The unchanged metadata checks remain active.

Local evidence: /tmp/0046-r2-{build,lint,test,site,sweep}.log; /tmp/chordl-parser-compat-OVYUTv/diffs.json (ephemeral; summary preserved above).

## Decisions made / follow-ups
Preserved existing note-group extraction per lead answer. No new product or API decisions. Ready for lead review routing; no merge performed.

## Known gotchas / For GBrain (lead to promote)
Earlier GBrain search found no task-specific context; no brain pages used and no implementer writes. Useful gotcha: a slash bass followed by a hand phrase can become a notesGroups entry before chord extraction, leaving a trailing slash in residual text. Repo docs remain the source of truth.
