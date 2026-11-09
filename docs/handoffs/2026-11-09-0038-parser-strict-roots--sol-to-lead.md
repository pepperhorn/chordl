# Handoff: 0038 — Strict parser roots candidate (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0038 · **Spec:** [0038](../specs/0038-parser-strict-roots.md) · **Plan:** [T1](../plans/0038-parser-strict-roots.md)
- **Branch:** orch/0038-parser-strict-roots
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-102f6052
- **PR:** https://github.com/pepperhorn/chordl/pull/110 (draft against main)
- **Base commit:** a94f24fcf3f01b1cade5cabc985fcf386e8c8f4b (includes declared 436e03e ancestor)
- **Implementation commits:** 340ef36, 7c0aa1a, f007184
- **Status:** closed

## Goal
Only read roots from standalone chord tokens; normalize the specified alt aliases while retaining modifiers. Implementation is complete under the lead answers at c390911, including the authorized suffix grammar and banana test update. Full verification passes.

## Context you need
[Dispatch and committed receiver acknowledgement](2026-11-09-0038-parser-strict-roots--lead-to-sol.md), [spec](../specs/0038-parser-strict-roots.md), [plan](../plans/0038-parser-strict-roots.md), [0032 comparison precedent](2026-11-09-0032-c7alt-parse--sol-to-lead.md).

## Scope
- **In / files owned:** `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/test/natural-language.test.ts`, `packages/chordl-core/test/parser-compat-sweep.mjs`, `packages/chordl-react/test/ChordQualityPicker.test.tsx` (only the banana test), this return handoff and the dispatch Receiver ack.
- **Out / do not touch:** every other file and every other React test, UI, resolver, descriptive-phrase grammar, dependencies, ledger and GBrain write-back.
- Scope audit: only the above six files changed. `git diff --check` passed.

## Acceptance criteria
- [x] AC1: table-driven tests cover every spec row, including Bb7 with bass D.
- [x] AC2 (amended by c390911 and r1 decisions): committed parser-compat sweep passes on 61,196 inputs with zero unexpected differences; expanded grammar and resolver spellings are tested. Note groups and modifiers are preserved. See Review r1 response for the final evidence.
- [x] AC3: article cases, A/a, a minor, A over C#, punctuation and case variants covered.
- [x] AC4: the complete required command passes, including all 2,916 tests and the site build; see Review r1 response.

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
- **Follow-ups:** other-family re-review and lead merge decision. Resolver inconsistency: `resolveChord("CΔ")` succeeds, but `resolveChord("CΔ7")` throws. Per the human, parser keeps CΔ7 intact for the error path; lead to track resolver support separately.
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

## Review r1 response

- **Review:** [5822144959](https://github.com/pepperhorn/chordl/pull/110#pullrequestreview-5822144959), reviewed head `12c80e57d23037bc1ad8a28247185390b552fbc4`.
- **Authority:** [lead r1 decisions at 0689714](https://github.com/pepperhorn/chordl/blob/0689714/docs/handoffs/2026-11-09-0038-parser-strict-roots--lead-r1-decisions.md), plus the human's two clarifications in this T3 session on 2026-11-09: admit Δ and phryg/quartal; keep CΔ7 intact despite resolver rejection. Read the review and lead document before editing. Implementation commit `f007184`.
- **Outcome:** M1, m1, m2, Unicode accidental handling and the committed probe are addressed; full verification result below.
- **M1:** Added a whole-token resolver fallback for strict-grammar suffix rejection/truncation. Requires uppercase A–G plus the specified markers/known qualities, keeps token ordering, strips trailing prose punctuation while preserving balanced chord parentheses, and explicitly excludes the listed English words. Valid tokens resolve directly; no resolver edits. Tests cover all reviewer spellings: 20 resolver-accepted suffixes plus CΔ7 separately, and C-7/C+7. Four wrappers per accepted spelling assert the full chordName and the same resolved notes as the direct token.
- **m1:** Lowercase a before a quality word yields to any later strict or fallback chord token. Added the four reported article examples plus a later fallback Cmi7 example. Preserves the actual existing `a minor` → `Am` behavior. Descriptive matching now requires a standalone root so the leftover `give` cannot supply E after the article is removed.
- **m2:** Spaced and parenthesized alt attach to any preceding quality with no residual spaces: C9 alt → C9alt, Cm7 alt → Cm7alt, C7b9 alt → C7b9alt, C7 (alt) → C7alt. Resolver rejection of such completed tokens is intentional.
- **Unicode:** Normalizes ♭/♯ before extraction, including bass/modifier notes. B♭7, F♯m and E♭maj7/G are table-tested.
- **Decisions made:** Parsing directly into resolveChord is explicitly accepted for this guarded fallback. The human added Δ to marker handling and `phryg`/`quartal` to the quality allow-list; CΔ, CmΔ, Cphryg and Cquartal are tested as accepted. The current resolver rejects CΔ7 despite the review's acceptance claim; per the human, Δ7 tokens remain intact so resolution produces an error. No resolver change. Preserved sharp-root quartal tokens during final style stripping so F#quartal remains a chord while retaining the existing styleHint metadata.
- **Scope audit:** This round changes only the two owned core source/test files, the new owned compatibility script and this own return handoff. The authorized banana test remains as fixed in the preceding round; no other React changes.
- **Follow-ups:** Resolver accepts CΔ but rejects CΔ7; lead to track separately. Other-family re-review and lead merge decision remain.

### Parser compatibility sweep

Committed the reviewer's probe, adapted from its scratchpad source to a repo-relative, base-ref-parameterized script with assertions and nonzero failure exit status:

```bash
node packages/chordl-core/test/parser-compat-sweep.mjs origin/main
```

```text
base: origin/main
baseHead: e0555c4374bddc48e2912b79dda0f6ef49401937
symbols: 3248
slash forms: 1800
inputs: 61196
identical: 38226
differences: 22970
existing note-group interpretations: 1362
unexpected differences: 0
```

Every generated chord token is checked against direct resolver pitch classes (with the authorized alt7 normalization and English-word exclusions). Existing hand-notation requests are checked for unchanged note-group metadata rather than treated as whole chord requests. Full-object old/new differences are retained in the generated report; modifiers must match the old parser on Unicode-normalized input. Edge expectations cover the accepted errors, article rule, alt variants, omission grammar and CΔ7. Inputs that baseline already parsed to a complete token are checked for unchanged resolved notes. Lowercase-root unknown aliases remain subject to the required uppercase-only fallback gate. No differences are silently accepted merely because a chordName is nonempty.

Natural-language targeted verification: 291 tests passed. Full required verification command exited 0 without retries:

```bash
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```
```text
pnpm build: PASS
pnpm lint: PASS
pnpm test:run: PASS (155 files, 2916 tests)
  voicings: 176
  core: 685 (291 natural-language)
  listen: 13
  guitar: 337
  voicing: 161
  react: 385
  cards: 822
  board: 337
pnpm --filter @pepperhorn/chordl-react build:site: PASS (13.38s)
parser-compat-sweep.mjs origin/main: PASS (61196 inputs, 0 unexpected)
git diff --check: PASS
```

Only existing API Extractor TypeScript version, Vite chunk-size and jsdom navigation warnings. Outcome: done, ready for other-family re-review; no merge or PR polling.
