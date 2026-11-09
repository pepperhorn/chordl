# Handoff: 0050 — [quick] StaffNotation reports its own loading/ready/error state (lead → sol)

- **Date:** 2026-11-10 · **Type:** quick · **Ledger:** 0050 (suggestion S19)
- **Branch:** orch/0050-staff-state-marker · **Worktree:** created by T3 · **Base commit:** 4911f61
- **Status:** open

## Goal
`StaffNotation` (`packages/chordl-react/src/components/StaffNotation.tsx`) already tracks `loading` / `failed` / `staffSvg` (~150–175), but doesn't expose them. chordl-board's notation wrapper (`packages/chordl-board/src/ChordBoard.tsx` ~25–45) has to infer readiness from DOM shape (`.bc-staff__loading`, `.bc-staff__engraving svg`), and treats a missing SVG as an error. Changes:
- Put `data-chordl-state="loading" | "ready" | "error"` on each `.bc-staff` root, using the same vocabulary as 0045's markers (#114). `ready` means the engraving SVG is injected.
- Make the board wrapper read those markers. The card is ready only when every staff is ready, it's error if any staff is error, and loading otherwise. Drop the DOM-shape inference.
- These markers feed downstream PDF readiness (becreative, ledger 0047).

## Scope
- **Files you own:** `packages/chordl-react/src/components/StaffNotation.tsx`; `packages/chordl-react/test/staff-notation*.test.tsx`; `packages/chordl-board/src/ChordBoard.tsx` (the notation readiness wrapper only); `packages/chordl-board/test/on-demand.test.tsx`.
- **Do not touch:** everything else. 0051 is editing other react and board test files in parallel.

## Acceptance criteria
- [ ] Tests cover the staff marker in each of the three states, including a Verovio failure, and a board card with two staves where one fails: the card must end in `error`, not `ready` and not stuck on `loading`.
- [ ] No public export or prop changes. Markers are additive.
- [ ] The verify command passes, plus `node scripts/verify-board-package.mjs`.

## Verify with
```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs
```
## Open questions
None.

---
## Receiver ack

Acknowledged by sol, 2026-11-10. I will expose loading/ready/error on each StaffNotation root, with ready only after SVG injection, and replace the board notation wrapper's DOM-shape inference with marker aggregation (any error wins; all ready required). I own only the listed StaffNotation source/tests, notation wrapper, on-demand board test, and my task handoffs. I will cover Verovio failure and mixed two-staff states, run the complete verify command and packed-board check, then push a draft PR and return to the lead without merging or watching. No open questions. GBrain searched for chordl StaffNotation readiness; no relevant project guidance returned.
