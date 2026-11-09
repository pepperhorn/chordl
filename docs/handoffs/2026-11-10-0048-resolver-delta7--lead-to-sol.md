# Handoff: 0048 — [quick] Resolver: accept Δ7 / mΔ7 spellings (lead → sol)

- **Date:** 2026-11-10 · **Type:** quick · **Ledger:** 0048 (suggestion S17)
- **Branch:** orch/0048-resolver-delta7 · **Worktree:** created by T3 · **Base commit:** 4911f61
- **Status:** open

## Goal
`resolveChord` accepts `CΔ` (maj7) and `CmΔ` (minor/major 7th), but throws on `CΔ7`, `CmΔ7` and `C∆7`. The last one uses U+2206 INCREMENT, a common look-alike of Δ (U+0394). Measured on main @ 4911f61. These are standard jazz spellings, so make them resolve: `Δ7` → maj7, `mΔ7` → mMaj7, with `∆` treated as `Δ`. Keep `Δ9` and the other existing Δ forms unchanged. Then remove the parser's temporary exception for Δ7 at `packages/chordl-core/src/parser/natural-language.ts` ~449–451, added in 0038. It exists only because the resolver rejected Δ7.

## Scope
- **Files you own:** the chordl-core source file where `resolveChord` normalises chord symbols (find it; `theory/chord-identify.ts` ~229–240 documents the Δ rules), `packages/chordl-core/src/parser/natural-language.ts` (only that exception), and their tests under `packages/chordl-core/test/`. If the sweep scripts flag only these intended rows, you may update their expectation lists.
- **Do not touch:** other packages and other parser behaviour.

## Acceptance criteria
- [ ] Table tests: `CΔ7`, `CmΔ7`, `C∆7`, `C∆`, `BbΔ7/D` and `F#mΔ7` resolve to the right notes. `CΔ`, `CΔ9` and `CmΔ` are unchanged.
- [ ] `node packages/chordl-core/test/resolver-regression-sweep.mjs` and `node packages/chordl-core/test/parser-compat-sweep.mjs 4911f61` show only the intended rows. Paste both summaries.
- [ ] The verify command passes.

## Verify with
```bash
pnpm build && pnpm lint && pnpm lint:test && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```
## Open questions
None.

---
## Receiver ack
