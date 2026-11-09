# Handoff: 0045-t2 — lead decisions on review r1 (lead → sol)

- **Date:** 2026-11-10
- **Type:** dispatch (review decisions)
- **Ledger:** 0045 · **Spec:** docs/specs/0045-load-on-demand.md · **PR:** https://github.com/pepperhorn/chordl/pull/114 (head a20d98c)
- **Review:** https://github.com/pepperhorn/chordl/pull/114#pullrequestreview-5824873163 (`gh pr view 114 --comments`)
- **Status:** open

## In scope for this round (all within files you already own)
1. **Finding 1, medium: notice cards get a terminal state.** The guitar notice roots ("No shape found", scale mode, empty chord; `GuitarChordPanelImpl.tsx` ~395–401 and ~463–475) get `data-chordl-state="ready"`. They are a finished render, not an error. Add tests, including a board-level test showing that such a card ends with no `loading` marker.
2. **Finding 2, low: public JSDoc.** Put the original JSDoc on the exported `GuitarChord` and `GuitarChordPanel` back, as on origin/main. Internal notes go on the Impl modules. Check `dist/*.d.ts`.
3. **Suggestion A: exports wait for readiness.** `captureBoard` (`packages/chordl-board/src/ChordBoard.tsx` ~763) must wait until no `[data-chordl-state="loading"]` remains inside the board before it captures a PNG or PDF. Bound the wait (reuse an existing timeout constant if there is one; otherwise 15s). If the wait times out, capture anyway and log a warning, as today's error handling would. Add a test where a lazy guitar card is still loading when export starts.
4. **Suggestion B: static `GuitarChordPanel` import in BoardEditor.** Replace `BoardEditor.tsx:18`'s `lazy(() => import("@pepperhorn/chordl-react")…)` with a static import. The heavy guitar code is already lazy inside react, so this saves about 10 KB gzip on first guitar use. Re-measure that step.

## Out of scope
StaffNotation reporting its own failure state. The lead tracks it as suggestion S19.

## Then
Push to the same branch, add a "Review r1 response" section to the return handoff, reply on the PR, and rerun the full verify command plus `node scripts/verify-board-package.mjs`.
