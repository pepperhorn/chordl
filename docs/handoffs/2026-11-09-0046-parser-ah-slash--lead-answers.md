# Handoff: 0046 — lead answers to the blocked return (lead → sol)

- **Date:** 2026-11-09
- **Type:** dispatch (answers)
- **Ledger:** 0046 · **PR:** https://github.com/pepperhorn/chordl/pull/113 (head 42076ff)
- **Status:** closed

## Answers
1. **Left-hand case: my dispatch expectation was wrong; yours is right.** Amend the test so `Cmi7/E in the left hand` → `{ chordName: "Cmi7", notesGroups: [{ notes: ["E"], hand: "lh" }] }`, which matches the existing `Cm7/E in the left hand` semantics. Assert the note group as well as the chordName. No change to slash/hand semantics.
2. **Sweep exit 1 (24 Ah/Eh rows).** You now also own `packages/chordl-core/test/parser-compat-sweep.mjs`, only to teach it this item's intended change: `Ah` and `Eh` are English interjections, not chords. Update its expectations so the sweep exits 0 with those 24 rows classified as expected. The other 309 differences, where a fallback chord quality is now kept in front of slash-bass or left-hand phrases, are intended improvements. Classify them as expected too, with a comment naming 0046. Paste the clean summary.

## Then
Push to the same branch, mark your return handoff done with a "Lead answers response" section, reply on the PR, and rerun the full verify command plus the sweep.
