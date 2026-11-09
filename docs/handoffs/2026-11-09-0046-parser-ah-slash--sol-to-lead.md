# Handoff: 0046 — Parser interjections and trailing slash (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0046 · **Spec:** [0038](../specs/0038-parser-strict-roots.md) · **Plan:** none (quick)
- **Branch:** orch/0046-parser-ah-slash
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-8585972f
- **PR:** draft on branch orch/0046-parser-ah-slash (URL in PR body and implementation report)
- **Base commit:** 9da30666defb1d3de5d8c4a2de03287ee200e2e6
- **Status:** blocked

## Goal and context
Implement the two review minors in [dispatch handoff](2026-11-09-0046-parser-ah-slash--lead-to-sol.md). The described two-line parser fix is implemented, but one required expectation contradicts existing hand-note extraction. This is a blocked return under AGENTS.md §7, not completion or a request to merge.

## Scope
- **In / files owned:** packages/chordl-core/src/parser/natural-language.ts and packages/chordl-core/test/natural-language.test.ts; own acknowledgement and return handoff.
- **Out:** all other code/docs, ledger, resolver, dependencies, API, UI, merge/publication.

## What changed
Added ah/eh to the resolver fallback English stoplist and slash to trailing punctuation cleanup. Added nine table cases, including every requested input. No unrelated files changed.

## Acceptance criteria
- [x] Table cases written for both reported issues, Ah, Eh?, Ah7, Ab7, Cmi7/E, the left-hand phrase, and CΔ7/G.
- [x] Compatibility sweep against 9da3066 run and differences classified below.
- [ ] All expected outputs pass: eight of nine added cases pass; left-hand case remains blocked.
- [ ] Full verify command passes: stops at the failing core acceptance test.

## Open question — lead decision required
The handoff expects `Cmi7/E in the left hand` → chordName `Cmi7/E`, claiming this matches `Cm7/E in the left hand`. Actual existing behavior for the latter is:

```json
{"chordName":"Cm7","notesGroups":[{"notes":["E"],"hand":"lh"}]}
```

Note-group extraction removes `E in the left hand` before fallback runs. The requested trailing-slash cleanup consequently yields:

```json
{"chordName":"Cmi7","notesGroups":[{"notes":["E"],"hand":"lh"}]}
```

Choose whether to amend the expected chordName to `Cmi7` while asserting the E note group (recommended: preserves existing semantics), or authorize changed slash/hand semantics. The new test deliberately retains the dispatch expectation and fails visibly. No broader behavior change was improvised. An async clarification was submitted to the user; no answer received before this return.

## Verification
Commands:
```bash
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
node packages/chordl-core/test/parser-compat-sweep.mjs 9da3066
```

- Install: pass; frozen lockfile unchanged.
- Baseline with new tests before source edits: 5 failed, 295 passed in natural-language.test.ts (confirms both defects).
- Targeted suite after edits: 1 failed, 299 passed (300); only the disputed left-hand expectation fails.
- `pnpm build`: pass.
- `pnpm lint`: pass.
- `pnpm test:run`: FAIL; voicings 176/176 pass; core 693 pass, 1 fails (694). Later package suites were not reached.
- `pnpm --filter @pepperhorn/chordl-react build:site`: run separately, pass (`✓ built in 5.00s`).
- `git diff --check`: pass.

Raw compatibility sweep summary (exit 1):
```json
{"base":"9da3066","baseHead":"9da30666defb1d3de5d8c4a2de03287ee200e2e6","noteGroupInterpretations":1362,"symbols":3248,"slash":1800,"inputs":61196,"same":60863,"differences":333,"unexpected":24}
```
All 333 changes affect chordName only: 24 Ah/Eh removals and 309 fallback symbols followed by slash-bass/left-hand phrases (previously empty or truncated, now full fallback chord quality). Zero other differences; no modifier metadata changes. All 24 raw unexpected entries are Ah/Eh removals explicitly requested here; the unowned sweep script still expects those resolver aliases to parse. Do not interpret its exit 1 as 24 unexplained regressions.

Local evidence: /tmp/0046-{install,build,lint,test,targeted,site,sweep}.log; /tmp/chordl-parser-compat-yxJJbH/diffs.json (ephemeral, summary preserved above).

## Decisions made / follow-ups
Preserved note-group extraction; did not relax the acceptance assertion without lead authorization. Keep the sweep script unmodified because it is outside owned files. Lead should resolve the open question, then rerun the full verify command and request review on the resulting exact head.

## Known gotchas / For GBrain (lead to promote)
GBrain search for chordl parser 0038 Ah slash found no task-specific context; no brain pages were used. Implementer made no GBrain writes. Useful gotcha: a slash bass followed by a hand phrase can become a notesGroups entry before chord extraction, leaving a trailing slash in residual text. Repository docs remain the source of truth.
