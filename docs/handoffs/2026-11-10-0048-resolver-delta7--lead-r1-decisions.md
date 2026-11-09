# Handoff: 0048 — lead decisions on review r1 (lead → sol)

- **Date:** 2026-11-10 · **Type:** dispatch (review decisions) · **Ledger:** 0048
- **PR:** https://github.com/pepperhorn/chordl/pull/118 (head 200e264) · **Review:** https://github.com/pepperhorn/chordl/pull/118#pullrequestreview-5832235935
- **Status:** closed

## In scope
1. **Blocking: `CMΔ7`.** Don't rewrite `Δ7` when it follows `M`. Use the reviewer's `/(?<!M)Δ7/g` or an equivalent. Add a test that `CMΔ7` throws, as it did on main. Also test `C∆7` (U+2206) with the same `M` guard.
2. **Coverage.** Add the new spellings to `packages/chordl-core/test/resolver-regression-sweep.mjs`'s generated symbols: `Δ7`, `mΔ7`, and the U+2206 forms for a few roots, with and without slash bass. That way a future regression fails the sweep, not just the unit tests. You own that file for this round.

## Out of scope (lead tracks separately)
- The pre-existing case-insensitive `/mmaj/i` rule at `chord-resolver.ts:143`. `CMmaj7` already gives minor/major on main.
- A bare `Δ` with no root returning an empty note list.
- "Unknown chord" errors showing the rewritten name instead of the user's input.

## Then
Push to the same branch, add a "Review r1 response" section to the return handoff, reply on the PR, and rerun the full verify command plus both sweeps.
