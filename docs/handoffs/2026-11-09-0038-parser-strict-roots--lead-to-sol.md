# Handoff: 0038 — Chord parser: only read a root from a standalone chord token (lead → sol)

- **Date:** 2026-11-09
- **Type:** dispatch
- **Ledger:** 0038 · **Spec:** docs/specs/0038-parser-strict-roots.md · **Plan:** docs/plans/0038-parser-strict-roots.md (task T1)
- **Branch:** orch/0038-parser-strict-roots · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** 436e03e
- **Status:** closed

## Goal
Implement the spec: the parser only reads a root from a standalone chord token, and the remaining `alt` spellings parse to `C7alt`. Unreadable input returns `chordName: ""`, which already surfaces as an error.

## Context you need
- Spec and plan above (source of truth).
- 0032's return handoff, `docs/handoffs/2026-11-09-0032-c7alt-parse--sol-to-lead.md`, for the old-vs-new parse comparison method.

## Scope
- **In:** plan T1.
- **Out:** UI, board, resolver, descriptive-phrase parsing.
- **Files you own:** `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/test/natural-language.test.ts`
- **Do not touch:** anything else. If a parse change in another package's tests is intended, report it; don't edit those tests.

## Acceptance criteria
- [ ] Spec AC1–AC4.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
- Human decided unreadable input shows an error; that's the existing empty-chordName path.
- `C7alt9`: your call between `""` and a resolver-supported meaning; record it in "Decisions made".
- GBrain: search chordl parser; fact #696 covers the 0032 case gotcha.

## Open questions
None.

---
## Receiver ack
I will restrict root extraction to standalone chord tokens, retain existing valid parses and modifiers, normalize the specified alt aliases, and cover article handling within the two owned parser/test files. I will compare baseline and changed parses, run the resolver sweep and full verification, then commit a return handoff and open a draft PR. No open questions at acknowledgement. GBrain searches for chordl parser and C7alt returned no relevant parser page; the linked 0032 handoff supplies the case-normalization gotcha.
