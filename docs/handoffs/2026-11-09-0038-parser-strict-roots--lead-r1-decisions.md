# Handoff: 0038 — lead decisions on review r1 (lead → sol)

- **Date:** 2026-11-09
- **Type:** dispatch (review decisions)
- **Ledger:** 0038 · **Spec:** docs/specs/0038-parser-strict-roots.md · **PR:** https://github.com/pepperhorn/chordl/pull/110 (head 12c80e5)
- **Review:** https://github.com/pepperhorn/chordl/pull/110#pullrequestreview-5822144959 (`gh pr view 110 --comments`)
- **Status:** closed

## Decisions

**M1: resolver-accepted spellings → option (a), with a guard.** The rule from the earlier answers stands: a chord token the resolver accepts must parse. When the strict match is rejected only by its trailing-boundary check, take the whole whitespace-delimited token, after stripping trailing punctuation. Use it as chordName if `resolveChord` accepts it.
- **Guard, required:** the fallback applies only when the token starts with an uppercase `A–G`, **and** either contains a digit or one of `Δ ø ° + - / ( #` (or `b` directly after the root), **or** its remainder after the root is a known quality word (`mi`, `ma`, `min`, `maj`, `dim`, `aug`, `sus`, `m`, `M`, `o`, `h`).
- **English words must stay non-chords.** Table-test each of `do`, `Do`, `go`, `Go`, `be`, `Be`, `add`, `Add`, `bad`, `Dad`, `Cab`, `face`, `Bed` as a whole input and inside prose ("Do it", "play Bad").
- **Cover the reviewer's 21 spellings**, at least `Cmi7`, `Cma7`, `CΔ7`, `Co7`, `Ch7`, `Cm/maj7`, `C-7`, `C+7`. Each parses to its full token and resolves to the same notes as `resolveChord` on that token.
- **Parsing directly into the resolver is accepted for this fallback.** Note it in "Decisions made".

**m1: the article before a quality word.** In `give me a dominant C7`, a lone lowercase `a` followed by a quality word yields to a later standalone chord token in the same input. With no later chord, keep today's behaviour (`a minor` → `Amin`).

**m2: `alt` after a space.** ` alt` / ` (alt)` / `(alt)` attach to the preceding chord token whatever its quality: `C9 alt` → `C9alt`, `C7 (alt)` → `C7alt`. If the resolver rejects the result, the user gets an error, which is accepted.

**Unicode ♭/♯ → in scope.** Normalise `♭`→`b` and `♯`→`#` before matching, so `B♭7` → `Bb7` and `F♯m` → `F#m`. Table-test both.

**The comparison script → keep it.** You now also own the new file `packages/chordl-core/test/parser-compat-sweep.mjs`. Commit the reviewer's old-vs-new probe there, modelled on `resolver-regression-sweep.mjs`: base ref as an argument, every resolver symbol for a few roots, plus the prose wrappers. Paste its summary in the return handoff. It must report zero unexpected differences after these changes.

## Owned files for this round
`packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/test/natural-language.test.ts`, `packages/chordl-core/test/parser-compat-sweep.mjs` (new), and the one banana test in `packages/chordl-react/test/ChordQualityPicker.test.tsx` that you already changed.

## Then
Push to the same branch, update the return handoff (add a "Review r1 response" section), reply on the PR, and rerun the full verify command plus the new sweep.
