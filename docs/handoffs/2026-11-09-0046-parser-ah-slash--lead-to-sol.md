# Handoff: 0046 — [quick] Parser: "Ah"/"Eh" interjections; trailing slash before a bass (lead → sol)

- **Date:** 2026-11-09
- **Type:** quick
- **Ledger:** 0046 · **Spec:** none (quick; follow-up to 0038, docs/specs/0038-parser-strict-roots.md) · **Plan:** none
- **Branch:** orch/0046-parser-ah-slash · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** 9da3066
- **Status:** open

## Goal
Fix the two minor findings from 0038's review r2 (https://github.com/pepperhorn/chordl/pull/110#pullrequestreview-5822329616):
1. **Interjections:** capitalised "Ah" and "Eh" now pass the resolver fallback as half-diminished chords and beat a later real chord: "Ah, play C7" → `Ah` instead of `C7`. Add `ah` and `eh` to the English stoplist near `natural-language.ts:441`. "Ah" or "Eh" alone, with nothing else chord-like, should then give `""`. Note: `Ah7` / `Ab7` must still work.
2. **Trailing slash:** "Cmi7/E in the left hand" → `""`, because the fallback token keeps a trailing `/`. Strip `/` with the trailing punctuation near `natural-language.ts:434` so that the slash-bass handling applies. Expect chordName `Cmi7/E`, matching how "Cm7/E in the left hand" parses.

## Scope
- **Files you own:** `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/test/natural-language.test.ts`
- **Do not touch:** anything else.

## Acceptance criteria
- [ ] Table tests for both cases, plus "Ah", "Eh?", "Ah7", "Ab7", "Cmi7/E", "Cmi7/E in the left hand", "CΔ7/G".
- [ ] `node packages/chordl-core/test/parser-compat-sweep.mjs` against base 9da3066: only the intended rows differ. Paste the summary.
- [ ] Verify command passes.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Open questions
None.

---
## Receiver ack

Acknowledged 2026-11-09 (sol). I will exclude bare Ah/Eh interjections from resolver fallback, strip a trailing slash from fallback tokens so slash-bass parsing works, and add the requested table regressions. Implementation is limited to the two owned core parser/test files, plus my acknowledgement and return handoff. I will compare against 9da3066 with the compatibility sweep, run the full verification command, push only orch/0046-parser-ah-slash, and open a draft PR. No open questions. GBrain search found no task-specific context; repository docs govern.

Lead answers acknowledged (5441619): preserve Cmi7 plus the E left-hand note group; additionally own parser-compat-sweep.mjs only to classify 0046 interjection removals and trailing-slash hand recoveries. I will rerun full verification and the sweep, then update the same PR and return handoff.
