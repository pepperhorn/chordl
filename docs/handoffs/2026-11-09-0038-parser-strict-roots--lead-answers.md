# Handoff: 0038 — answers to the r0 open questions (lead → sol)

- **Date:** 2026-11-09
- **Type:** dispatch (answers)
- **Ledger:** 0038 · **Spec:** docs/specs/0038-parser-strict-roots.md · **Plan:** docs/plans/0038-parser-strict-roots.md (T1)
- **Branch:** orch/0038-parser-strict-roots · **PR:** https://github.com/pepperhorn/chordl/pull/110 (head 3255fb6)
- **Status:** open

## Answers

**Q1, extra parser differences (AC2).** AC2 is amended. These are **accepted**, because each one removes a root that was read out of a leftover word, which is the bug this item fixes:
- `Xmaj99`, `rh Cq`, `banana`, `ZZZZZ_not_a_chord_at_all!!!` → `""`.
- Note-group-only requests (`notes C E G in bottom hand`, `… in the bass clef`, `… treble clef`, the midi-names variant) → `chordName ""`, with the note-group fields unchanged. Keep a test asserting that the note groups are unchanged.

**Q1, resolver-supported suffixes: grammar expansion is in scope.** A chord token that the resolver accepts must still parse. Measured on main with `resolveChord`:

| Token | resolveChord | Parse on main | Required parse |
|---|---|---|---|
| `C7omit3` | C G Bb | C7 | `C7omit3` |
| `Amajor` | A C# E | Amaj | `Amaj` (normalise `major`→`maj`, keeping today's output) |
| `Aminor` | A C E | Amin | `Amin` (normalise `minor`→`min`) |
| `Cmajor7` | throws | Cmaj | `Cmaj7` (normalise, then the resolver decides) |
| `D7no3`, `C69omit3`, `Cmaj7omit5`, `Cmaj7no5`, `C69no3no5` | throws | dropped the suffix | keep the full token (`D7no3`, …). The resolver then rejects it, so the user gets an error instead of a silently different chord. This matches the human's "show an error" decision. |

So: add `omit\d+` / `no\d+` (repeatable) and attached `major` / `minor` (normalised) to the quality grammar. Don't add anything else. Table-test every row above.

**Q2, the banana test.** You now also own `packages/chordl-react/test/ChordQualityPicker.test.tsx`, only for the test at ~lines 60–66. Change it to expect no strip for `"banana"`, rename it to say the strip follows the parser (which now rejects nonsense), and update its comment. Don't edit anything else in that file.

## Then
Push to the same branch, update your return handoff (add a "Lead answers response" section, tick AC2 against this amended rule, and mark it done), reply on the PR, and rerun the full verify command.
