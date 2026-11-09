# Handoff: 0038 — Strict parser roots candidate (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0038 · **Spec:** [0038](../specs/0038-parser-strict-roots.md) · **Plan:** [T1](../plans/0038-parser-strict-roots.md)
- **Branch:** orch/0038-parser-strict-roots
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-102f6052
- **PR:** https://github.com/pepperhorn/chordl/pull/110 (draft against main)
- **Base commit:** a94f24fcf3f01b1cade5cabc985fcf386e8c8f4b (includes declared 436e03e ancestor)
- **Implementation commit:** 340ef36
- **Status:** blocked

## Goal
Only read roots from standalone chord tokens; normalize the specified alt aliases while retaining modifiers. Candidate implementation is complete, but AC2 and AC4 are blocked by compatibility requirements and one out-of-scope test that asserts the old nonsense-input behavior.

## Context you need
[Dispatch and committed receiver acknowledgement](2026-11-09-0038-parser-strict-roots--lead-to-sol.md), [spec](../specs/0038-parser-strict-roots.md), [plan](../plans/0038-parser-strict-roots.md), [0032 comparison precedent](2026-11-09-0032-c7alt-parse--sol-to-lead.md).

## Scope
- **In / files owned:** `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/test/natural-language.test.ts`, this return handoff and the dispatch Receiver ack.
- **Out / do not touch:** every other file, including React tests, UI, resolver, descriptive-phrase grammar, dependencies, ledger and GBrain write-back.
- Scope audit: only the above four files changed. `git diff --check` passed.

## Acceptance criteria
- [x] AC1: table-driven tests cover every spec row, including Bb7 with bass D.
- [ ] AC2: resolver sweep passes (54,960 symbols, zero differences), but parser comparisons have additional changes outside AC1; see evidence below. Do not mark this accepted without resolving the open question.
- [x] AC3: article cases, A/a, a minor, A over C#, punctuation and case variants covered.
- [ ] AC4: build and lint pass; full tests stop with the React banana assertion failure below. Site build passes when run separately.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
node packages/chordl-core/test/resolver-regression-sweep.mjs a94f24f
```

## Known gotchas / decisions already made
GBrain searches for `chordl parser` and `C7alt` returned unrelated pages; no GBrain page informed implementation. The linked 0032 handoff supplied the case-normalization gotcha. Workspace packages were installed frozen and built before tests, as the tests import package dist exports.

## Open questions
1. AC2 literally requires zero parser differences except AC1. Strict boundaries necessarily remove old roots taken from leftover words, including note-group-only requests. May those additional changes be accepted? The comparison also finds resolver-supported `C7omit3` losing its old partial `C7` parse; preserving that partial match conflicts with requiring a complete standalone chord token. Should unsupported parser suffixes fail, or should the lead scope a grammar expansion?
2. The intended rejection of `banana` breaks `packages/chordl-react/test/ChordQualityPicker.test.tsx:65`, which explicitly requires the old B-major shortcut strip. The dispatch says to report intended changes in other packages' tests and not edit them. Please assign/authorize that test update before AC4 can pass.

## Return
- **Outcome:** blocked; candidate committed and draft PR opened for inspection. No merge or PR polling.
- **What changed:** Added Unicode-aware leading/trailing token guards, prevented a rejected slash chord from falling back to its bass, accepted spaced/parenthesized/reversed-7 alt aliases, normalized their spelling and preserved lowercase a before its own descriptive quality. Added 24 table cases and updated three existing attached-prose assertions.
- **Decisions made:** `C7alt9` returns empty because no unambiguous supported alias is established. `Calt7` normalizes to `C7alt` rather than taking the resolver's different direct Calt7 meaning. Attached `C7alto`/`C7alternate`/`C7alternative` return empty under strict boundaries; spaced forms retain C7. Descriptive-phrase grammar was not expanded.
- **Out-of-scope issues found:** React banana expectation above; additional compatibility differences below. No external tests edited.
- **Follow-ups:** Lead resolves AC2 and expands test ownership or assigns React correction; then other-family review and lead merge decision.
- **For GBrain (lead to promote):** Strict chord boundaries remove bogus chordName fields in note-group-only requests even when note-group metadata is unchanged. Full tests alone miss these differences; use old/new full-object comparison.

## Verification evidence

Failing-test-first run with only owned test changes: 19 failed / 593 passed (core suite). After implementation: 16 core test files passed, 612 tests passed (218 natural-language cases).

```text
pnpm install --frozen-lockfile: PASS
pnpm build: PASS
pnpm lint: PASS
pnpm test:run: FAIL
  voicings: 176 passed
  core: 612 passed
  listen: 13 passed
  guitar: 337 passed
  voicing: 161 passed
  react: 48 files passed / 1 failed; 384 tests passed / 1 failed
  FAIL test/ChordQualityPicker.test.tsx:65
    ChordQualityPicker > tracks the parser rather than second-guessing it
    AssertionError: expected null to be truthy (input="banana")
  Recursive test command stopped here; later packages were not reached.
pnpm --filter @pepperhorn/chordl-react build:site: PASS (built in 5.62s)
resolver-regression-sweep: PASS
  base: a94f24f; total: 54960; aliases: 229; roots: 15; bassForms: 16
  differences: 0; failures: []
```

Parser comparison method: TypeScript AST over all 161 tracked workspace test files at base a94f24f; transpile baseline/current parser with the same current unchanged resolver; compare complete JSON results. Extracted 216 unique direct literal `parseChordDescription`/`processChordRequest`/`resolveChord` arguments and chord/input/description fields (including JSX). 206 identical, 10 differences below; every changed field is chordName, now empty. A conservative 1,314-literal superset including every literal array element found 419 differences, mostly non-input labels/IDs; a narrower parser-relevant table scan had 249 candidates and 12 differences (adds standalone table values `alto` and `bass`, which are not actual parser inputs). Dynamic template inputs are not exhaustively evaluated; the owned C7+alto/alternate/alternative template tests explicitly cover the six generated cases.

| Literal | Old chordName | Base location |
|---|---|---|
| Xmaj99 | A | core/test/chord-resolver.test.ts:38 |
| C7omit3 | C7 | core/test/chord-resolver.test.ts:111 |
| notes C E G in bottom hand | A | core/test/natural-language.test.ts:195 |
| rh Cq | C | core/test/natural-language.test.ts:332 |
| with notes C E G in the bass clef | C | core/test/natural-language.test.ts:375 |
| notes C E G in the bass clef and notes B D F in the treble clef | C | core/test/natural-language.test.ts:391 |
| with notes C E G in bass clef with notes B D F in treble clef | C | core/test/natural-language.test.ts:401 |
| banana | B | react/test/ChordQualityPicker.test.tsx:64 |
| ZZZZZ_not_a_chord_at_all!!! | A | react/test/ChordSheet.test.tsx:114 |
| notes C E G in the bass clef and notes B D F in the treble clef with midi note names | C | react/test/PianoChord.hand-groups.test.tsx:84 |

The conservative superset additionally surfaces resolver/chord-identification-only aliases whose old partial parser results disappear: Amajor, D7omit3, D7no3, C69omit3, Cmaj7omit5, Cmaj7no5, C69no3no5. These are reported rather than silently exempted from AC2.

Successful build emitted the API Extractor TypeScript-version warning; React tests emitted jsdom navigation warnings in addition to the real assertion failure. No timeout retries or dependency edits.
