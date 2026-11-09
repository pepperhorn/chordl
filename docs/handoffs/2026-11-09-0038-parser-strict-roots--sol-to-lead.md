# Handoff: 0038 — Strict parser roots candidate (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0038 · **Spec:** [0038](../specs/0038-parser-strict-roots.md) · **Plan:** [T1](../plans/0038-parser-strict-roots.md)
- **Branch:** orch/0038-parser-strict-roots
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-102f6052
- **PR:** https://github.com/pepperhorn/chordl/pull/110 (draft against main)
- **Base commit:** a94f24fcf3f01b1cade5cabc985fcf386e8c8f4b (includes declared 436e03e ancestor)
- **Implementation commits:** 340ef36, 7c0aa1a
- **Status:** closed

## Goal
Only read roots from standalone chord tokens; normalize the specified alt aliases while retaining modifiers. Implementation is complete under the lead answers at c390911, including the authorized suffix grammar and banana test update. Full verification passes.

## Context you need
[Dispatch and committed receiver acknowledgement](2026-11-09-0038-parser-strict-roots--lead-to-sol.md), [spec](../specs/0038-parser-strict-roots.md), [plan](../plans/0038-parser-strict-roots.md), [0032 comparison precedent](2026-11-09-0032-c7alt-parse--sol-to-lead.md).

## Scope
- **In / files owned:** `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/test/natural-language.test.ts`, `packages/chordl-react/test/ChordQualityPicker.test.tsx` (only the banana test), this return handoff and the dispatch Receiver ack.
- **Out / do not touch:** every other file and every other React test, UI, resolver, descriptive-phrase grammar, dependencies, ledger and GBrain write-back.
- Scope audit: only the above five files changed. `git diff --check` passed.

## Acceptance criteria
- [x] AC1: table-driven tests cover every spec row, including Bb7 with bass D.
- [x] AC2 (amended by c390911): resolver sweep passes (54,960 symbols, zero differences); direct parser comparison has only the ten authorized differences and no changes to other fields. Expanded grammar rows pass; note groups are explicitly preserved by tests.
- [x] AC3: article cases, A/a, a minor, A over C#, punctuation and case variants covered.
- [x] AC4: the complete required command passes, including all 2,864 tests and the site build; see Lead answers response.

## Verify with
```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
node packages/chordl-core/test/resolver-regression-sweep.mjs a94f24f
```

## Known gotchas / decisions already made
GBrain searches for `chordl parser` and `C7alt` returned unrelated pages; no GBrain page informed implementation. The linked 0032 handoff supplied the case-normalization gotcha. Workspace packages were installed frozen and built before tests, as the tests import package dist exports.

## Open questions
None. Both initial blockers were resolved by the lead answers at c390911.

## Return
- **Outcome:** done; branch pushed and draft PR updated. No merge or PR polling.
- **What changed:** Added Unicode-aware leading/trailing token guards, prevented a rejected slash chord from falling back to its bass, accepted spaced/parenthesized/reversed-7 alt aliases, normalized their spelling and preserved lowercase a before its own descriptive quality. Added 24 table cases and updated three existing attached-prose assertions.
- **Decisions made:** `C7alt9` returns empty because no unambiguous supported alias is established. `Calt7` normalizes to `C7alt` rather than taking the resolver's different direct Calt7 meaning. Attached `C7alto`/`C7alternate`/`C7alternative` return empty under strict boundaries; spaced forms retain C7. Descriptive-phrase grammar was not expanded.
- **Out-of-scope issues found:** none outstanding. Initial compatibility and React banana issues were resolved by the lead answers; only the specifically authorized React test was edited.
- **Follow-ups:** other-family review and lead merge decision.
- **For GBrain (lead to promote):** Strict chord boundaries remove bogus chordName fields in note-group-only requests even when note-group metadata is unchanged. Full tests alone miss these differences; use old/new full-object comparison.

## Initial verification evidence (before lead answers)

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

## Lead answers response

Authority: [lead answers at c390911](https://github.com/pepperhorn/chordl/blob/c390911/docs/handoffs/2026-11-09-0038-parser-strict-roots--lead-answers.md). Read using `git fetch origin` and `git show c390911:docs/handoffs/2026-11-09-0038-parser-strict-roots--lead-answers.md`; did not modify the lead-owned document. Implementation commit: `7c0aa1a`.

- Amended AC2 accepts the nine nonsense/note-group-only direct-literal changes. Added tests for all five affected note-group-only requests, asserting empty chordName, exact unchanged notesGroups, bassNote G, and midi mode where requested.
- Expanded only the authorized grammar: repeatable `omit\d+` / `no\d+`, attached major/minor normalized to maj/min. New tokens normalize case. Unsupported resolver suffixes remain intact so the resolver can reject them instead of accepting a different chord. No resolver edits.
- Table-tested all nine lead-specified rows plus case variants, slash bass and malformed suffix guards. Required results: C7omit3 → C7omit3; Amajor → Amaj; Aminor → Amin; Cmajor7 → Cmaj7; D7no3/C69omit3/Cmaj7omit5/Cmaj7no5/C69no3no5 retain the full symbol.
- Edited only the authorized banana test in `packages/chordl-react/test/ChordQualityPicker.test.tsx`: name/comment now describe nonsense rejection, and the strip is expected to be null.
- Failing-test-first evidence: new core tests reported 14 failed / 225 passed. After implementation, the natural-language suite passed all 239 cases.
- Repeated the AST baseline/current full-object comparison: 216 direct literals, 206 identical, 10 authorized differences, zero unexpected differences. C7omit3 now becomes C7omit3 rather than empty; the other nine differences are the lead-approved empty chordName changes. All fields other than chordName remain byte-equivalent in JSON, including note groups. The 249-candidate table superset has only those changes plus standalone non-input table strings alto/bass.
- Repeated resolver sweep: 54,960 symbols; zero differences; zero failures.

Full required verification command exited 0 without retries:

```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```
```text
pnpm build: PASS
pnpm lint: PASS
pnpm test:run: PASS (155 files, 2864 tests)
  voicings: 9 files, 176 tests
  core: 16 files, 633 tests (239 natural-language tests)
  listen: 1 file, 13 tests
  guitar: 19 files, 337 tests
  voicing: 9 files, 161 tests
  react: 49 files, 385 tests
  cards: 26 files, 822 tests
  board: 26 files, 337 tests
pnpm --filter @pepperhorn/chordl-react build:site: PASS (6.16s)
resolver sweep: 54960 symbols, zero differences, zero failures
amended AC2: zero unauthorized differences; other parsed fields unchanged
scope audit: only the three authorized source/test files and own two handoffs
git diff --check: PASS
```

Warnings remain the existing API Extractor TypeScript version, jsdom navigation and Vite chunk-size warnings. There were no test failures or timeout reruns. No new decisions beyond the lead's answers; no GBrain write-back as implementer.
