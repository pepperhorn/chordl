# Handoff: 0031 — resolver-slash-brackets (lead → sol)

- **Date:** 2026-11-09
- **Type:** dispatch
- **Ledger:** 0031 · **Spec:** none (follow-ups from chordl PR #103 Opus reviews r1 #3/#4 and r2 #1/#2)
- **Repo:** chordl (base `main`) · **Branch:** orch/0031-resolver-slash-brackets · **Worktree:** created by T3
- **Base commit (trans docs):** 0cb1b83
- **Status:** open

## Goal
Close the chordl-core follow-ups from the PR #103 reviews (read them with `gh pr view 103 --json reviews`):
1. Slash chords whose upper part needs the alteration fallback, e.g. `Bm7b5(b9)/F`, `C7(b9,b5)/E`, `Cdim7(b9)/Eb`, must resolve the upper part through the fallback (the 5th replaced, no natural 5th kept) and then apply the bass. Otherwise they throw. They must never resolve wrongly.
2. `parseChordDescription` (natural-language.ts) must keep bracketed alterations, so `"Bm7b5(b9)"` gives chordName `Bm7b5(b9)` and `"Em7(b9) in the right hand"` gives `Em7(b9)`.
3. The fallback `type` label keeps the base quality's own alteration, e.g. `half-diminished (extended)`.

Patch-bump chordl-core and update the CHANGELOG.

## Context you need
- Read the PR #103 reviews (`gh pr view 103 --json reviews -q '.reviews[].body'`) for the failing examples.

## Scope
- **Files you own:** `packages/chordl-core/src/resolver/*`, `packages/chordl-core/src/**/natural-language.ts`, their tests, and `packages/chordl-core/package.json` version + CHANGELOG, plus your return handoff.
- **Out:** production writes (Directus apply, prompt pushes, deploys, npm publish/tags), and anything not listed here. If you need another file, stop and note it in your return.

## Acceptance criteria
- [ ] A parity test over the bracketed catalogue aliases with each root's slash basses gives correct pitch classes or a throw.
- [ ] The parseChordDescription cases pass.
- [ ] No regression across the non-bracket sweep (reuse the r2 reviewer's approach: compare main vs head over tonal aliases × 15 roots × slash basses, and report the diff).
- [ ] Build, lint and the full tests pass.

## Verify with
`pnpm build`, `pnpm lint`, `VITEST_MAX_WORKERS=2 pnpm -r --workspace-concurrency=1 test:run --testTimeout=30000`

## Known gotchas
- Never commit real student data. Use synthetic fixtures only.
- Contextual class names go alongside utilities; the UI font is Poppins.
- GBrain: not needed.

## Open questions
None. If the code disagrees with this handoff or spec, stop and return `blocked`.

---
## Receiver ack

I will resolve slash upper chords through the alteration fallback before applying bass, preserve bracketed alterations in parseChordDescription, retain base-quality labels, patch-bump core, and validate catalogue slash parity plus a main/head non-bracket sweep. Scope is the listed core files/tests and task handoffs. No open questions. The dispatch is copied here solely to acknowledge it without editing /home/shaun/trans. GBrain search returned no relevant resolver decisions.

---
## Return
Put the full return (outcome, what changed, verification tail, decisions, follow-ups) in the PR body under "Return handoff".
