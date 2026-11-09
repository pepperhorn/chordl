# Handoff: 0032 — [quick] "C7alt" parses as "C7" in parseChordDescription (lead → sol)

- **Date:** 2026-11-09
- **Type:** quick
- **Ledger:** 0032 · **Spec:** none (quick) · **Plan:** none
- **Branch:** orch/0032-c7alt-parse · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** b09d17d
- **Status:** closed

## Goal
`parseChordDescription("C7alt")` returns `{ chordName: "C7" }`: the `alt` suffix is silently dropped because `CHORD_RE` in `packages/chordl-core/src/parser/natural-language.ts:417` has no `alt` token. `resolveChord("C7alt")` already resolves correctly (`7#5#9`), so the only defect is the NL parser losing the suffix. Done = the parser keeps `alt` (e.g. `C7alt`, `G7alt`, `Bb7alt`, `C7alt over E`, `C7alt with degrees`) so the chord box draws the altered dominant, with no change to any other input's parse.

## Scope
- **Files you own:** `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/test/natural-language.test.ts`
- **Do not touch:** anything else. If the fix needs another file, stop and say so in the return handoff.

## Acceptance criteria
- [ ] Failing test first: `parseChordDescription("C7alt").chordName === "C7alt"` (and the variants above), and the resolved notes match `resolveChord("C7alt")`.
- [ ] `packages/chordl-core/test/resolver-regression-sweep.mjs` (or the existing natural-language suite) shows no other input's parse changed; paste the evidence in the PR body.
- [ ] Words containing "alt" that aren't chord suffixes (e.g. "alto", "alternate", "alternative") are not captured as part of the chord name. Test at least one.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
- Recorded 2026-09-08 (PRs #55–#59 follow-ups); re-measured on main b09d17d 2026-11-09.
- Board tests can time out at the default 5s under load; rerun in isolation before treating as a regression.

## Open questions
none

---
## Receiver ack
Acknowledged: preserve the `alt` suffix in chord symbols and modifier-bearing requests, prove the failing cases before the fix, compare resolved notes with `resolveChord`, and guard against capturing prose such as alto/alternate/alternative. I will edit only the two owned parser/test files plus my task handoffs, run the full required verification, and open a draft PR on `orch/0032-c7alt-parse`. No open questions. GBrain searched for chordl and C7alt; no directly relevant parser decision found.
