# Handoff: 0056 — Voicing editor blocked on file ownership (codex → lead)

- **Date:** 2026-11-17
- **Type:** return
- **Ledger:** 0056
- **Spec:** [voicing submissions](../superpowers/specs/2026-10-29-voicing-submissions-design.md), [crf-staff 0030](https://github.com/pepperhorn/crf-staff/blob/main/docs/specs/0030-chord-voicings-audition-builder.md)
- **Plan:** [crf-staff 0030 T1](https://github.com/pepperhorn/crf-staff/blob/main/docs/plans/0030-chord-voicings-audition-builder.md)
- **Dispatch:** [lead → codex](2026-11-17-0056-voicing-editor--lead-to-codex.md)
- **Branch:** orch/0056-voicing-editor
- **Worktree:** /home/t3box/.t3/worktrees/chordl/orch-0056-voicing-edito-8b8472408f6c56ed
- **Base commit:** 56f28c2 (plus dispatch docs); receiver ack 0f4a2ee
- **PR:** draft on this branch; URL in the task completion message
- **Port:** 5760 (no server started)
- **Status:** blocked

## Goal
Implement the editor package, computed experience levels, and card conversion/alternative helpers specified by the dispatch. Nothing has been published.

## Context you need
Read the linked dispatch and specs. AGENTS.md §4 prohibits implementers from editing files outside declared ownership; §7 requires stopping and returning blocked when scope must grow.

## Scope
- **In:** fretted/keyboard builders, overlay/checks, voicing levels, card conversion and alternative helpers.
- **Out:** npm publishing, storage/submission services, changes to default requestFor selection.
- **Files you own:** packages/chordl-voicing-editor/**; additive packages/chordl-voicing/src/** and tests; additive packages/chordl-cards/src/** and tests; root package.json, pnpm-lock.yaml, pnpm-workspace.yaml if needed; task handoffs.
- **Do not touch:** ledger, other docs, other packages' public behavior, or unowned manifests.

## Acceptance criteria
All implementation criteria remain outstanding: level agreement, six-face SVG round trips, standard-first deduplicated alternatives, builder DOM tests, 360px Chromium pass, full verification.

## Verify with
After ownership is resolved and implementation completes:
```bash
pnpm install --frozen-lockfile=false && pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
GBrain: unavailable. Read AGENTS.md, CLAUDE.md, ledger, dispatch, local voicing-submissions design, and crf-staff spec/plan 0030. Inspected the frames ChordWorkbench source read-only.

## Open questions
Please add packages/chordl-cards/package.json to the implementation ownership. The card helpers need a runtime dependency on @pepperhorn/chordl-voicing to reuse its format conversion primitives, shapeHash and levelOf without copying rules. This manifest currently declares only core, guitar and react. It is not included in the dispatch's owned paths.

Evidence:
- packages/chordl-cards/package.json: dependencies do not include chordl-voicing.
- packages/chordl-cards/vite.config.ts: externalizes only declared runtime dependencies.
- packages/chordl-cards/test/runtime-deps.test.ts: requires every imported package to be a declared runtime dependency and documents the accidental bundling risk.

Adding the dependency only to the root manifest or relying on a transitive dependency would not fix the cards package's published dependency declaration or runtime-deps guard.

---
## Receiver ack
For the lead to acknowledge through the ledger.

---
## Return
- **Outcome:** blocked
- **What changed:** committed dispatch receiver acknowledgement and this return handoff only. No implementation edits.
- **Verification output:** git status --short was clean after the ack commit. Build/lint/tests/browser checks were not run: implementation stopped at the ownership boundary.
- **Decisions made:** stopped rather than importing an undeclared runtime dependency or duplicating voicing rules. No architectural decisions.
- **Out-of-scope issues found:** missing ownership of the cards manifest needed for the new dependency.
- **Follow-ups:** expand manifest ownership, then resume implementation on this branch; no other blocking question identified.
- **For GBrain (lead to promote):** none yet.
