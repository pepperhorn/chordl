# 0038 — Chord parser: only read a root from a standalone chord token

- **Status:** approved (human, 2026-11-09: unreadable input must show an error)
- **Ledger:** 0038 · **Plan:** ../plans/0038-parser-strict-roots.md
- **Author:** lead · **Date:** 2026-11-09

## Problem
`parseChordDescription` (`packages/chordl-core/src/parser/natural-language.ts`) finds the chord with `CHORD_RE` (line ~417), which has no boundary before the root letter. Any a–g letter inside an ordinary word becomes a root, so the chord box draws a chord for nonsense. Measured on main @436e03e:

| Input | chordName now | Should be |
|---|---|---|
| `@@@ not a chord @@@` | `C` (from "chord") | `""` |
| `Zbq9` | `B` | `""` |
| `hello world` | `E` | `""` |
| `play Bb7 over D` | `A` (from "play") | `Bb7` with bass D, as `Bb7 over D` parses today |
| `C7 alt` | `C7` | `C7alt` |
| `C7(alt)` | `C7` | `C7alt` |
| `C7alt9` | `C7` | `""`, or `C7alt` if the implementer finds a resolver-supported meaning; record the choice |
| `Calt7` | `C` | `C7alt` (alias) |

Truly empty results already flow to an error: `processChordRequest` returns `success:false` ("Could not extract a chord name from the input") and `PianoChord.tsx:398` throws `Couldn't find a chord name in "…"`, which the board turns into its error card (`.chordl-board-card-error`, #101). So the human's decision ("show an error") is met by making the parser return `""` for unreadable input. No UI change is needed.

## Goals
- A root is only taken from a token that starts at the start of the input or after whitespace/punctuation and whose chord match ends at a word boundary.
- The remaining `alt` spellings above parse to `C7alt`.
- No currently-valid input changes its parse.

## Non-goals
- UI or board changes. Error rendering already exists.
- Resolver (`resolveChord`) changes, new chord qualities, or descriptive-phrase parsing ("C minor seventh").

## User-visible behaviour
Typing nonsense shows the existing error state instead of a chord. Sentences like "play Bb7 over D" and "show me G" draw the intended chord.

## Constraints
- Article handling: a lone lowercase `a` before another chord token ("play a C major chord", "a Bb7") is an article, not the chord A. A lone `A`/`a` with nothing else chord-like ("A", "a minor", "A over C#") is still the chord A. Spell out the rule in a code comment.
- Case: `CHORD_RE` is case-insensitive; normalise any new token's case in chordName (the 0032 gotcha).

## Acceptance criteria
- [ ] AC1 — every row of the table above parses as stated (table-driven test).
- [ ] AC2 — no regression: run `packages/chordl-core/test/resolver-regression-sweep.mjs` and an old-vs-new comparison of every literal `parseChordDescription` / chord input in the workspace's tests (the method from 0032's return handoff). Zero differences other than the AC1 rows; paste the evidence.
- [ ] AC3 — article cases above covered by tests, including "a C major chord" → `C` and "A" → `A`.
- [ ] AC4 — verify command passes.

## Open questions
None.
