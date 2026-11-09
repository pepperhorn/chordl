# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked
> Waiting on: `child <taskId>` · `review <taskId>` · `ci` · `human: <why>` · `lead: <next action>`. Set it on every status change. A row needs the lead when it starts with `lead`, or when it's empty and Status is dispatched, in-review, changes-requested, ready, or merged. The lead's Stop hook won't let the lead end its turn while any row needs it.
> Type: normal items have a spec and plan. Quick items have the title prefix `[quick]` (no spec or plan, a short handoff). PRs adopted by `orch-sweep` have the prefix `[pr]`.

Next ID: 0045  (0001–0024 were used before the ledger existed; see orch/0024-* branches; 0027–0031, 0033–0037 also come from the crf-transcribe lead's ledger (/home/shaun/trans); 0037 merged as #105)

## Active

| K | Title | Status | Waiting on | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0042 | [quick] Patch vulnerable transitive dependencies (dompurify, fast-uri, image-size) | ready | human: approve merge (dependency change, §5a) | codex/gpt-6.1-sol | orch/0042-audit-transitives | [#109](https://github.com/pepperhorn/chordl/pull/109) @ cb9f54d (r1 approve) | /home/shaun/.t3/worktrees/chordl/t3-bf75a123 | task `node:delegated-task:command%3Amcp%3A8171515d-9a8b-4268-a6b9-8eda267c872b%3Adelegate-task%3A0042-impl-r1` | — | — | [sol→lead](../handoffs/2026-11-09-0042-audit-transitives--sol-to-lead.md) (on branch) | 2026-11-09 |
| 0043 | Type-check test files in every package (tsconfig.test.json + lint:test in CI) | planned | review 0042-review-r1 + child 0038-impl-r1 (dispatch once both merge: shared lockfile and core test files) | — | orch/0043-typecheck-tests | | | | [spec](../specs/0043-typecheck-tests.md) | [plan](../plans/0043-typecheck-tests.md) | | 2026-11-09 |
| 0044 | Deploy: brotli + precompressed assets | proposed | human: re-scope — brotli only, code-split the 1.12 MB bundle, or drop (re-measured 2026-11-09: nginx already gzips via Railpack, cold JS 2.1s not 13s; brotli ~25%, 305→231 KB) | — | | | | | | | | 2026-11-09 |
| 0038 | Chord parser: only read a root from a standalone chord token (+ S11, S13) | dispatched | child 0038-impl-r1-answers | codex/gpt-6.1-sol | orch/0038-parser-strict-roots | [#110](https://github.com/pepperhorn/chordl/pull/110) @ 3255fb6 (r0, blocked) | created by T3 | task `node:delegated-task:command%3Amcp%3A8171515d-9a8b-4268-a6b9-8eda267c872b%3Adelegate-task%3A0038-impl-r1` | [spec](../specs/0038-parser-strict-roots.md) | [plan](../plans/0038-parser-strict-roots.md) | [lead answers](../handoffs/2026-11-09-0038-parser-strict-roots--lead-answers.md) | 2026-11-09 |
| 0039 | Notation view: annotations to the right of the stave; scales/runs as beamed eighths | proposed | human: needs spec (3 defects: StaffNotationProps has no annotation props; scale/run branches of PianoChord skip display; mei-builder.ts:115,117 hard-code dur="1") | — | | | | | | | | 2026-11-09 |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|
| 0041 | [quick] chordl-react tests: same timeout budget as board | [#108](https://github.com/pepperhorn/chordl/pull/108) | 2026-11-09 @ 1487fa7 | Codex impl; Opus r1 approve @cb3b9ee (9/9 three-way loaded runs, slowest 15.4s annotation-disabled). Auto-merged per §5a. Verify on main: 2819 pass |
| 0040 | [quick] chordl-board tests: raise vitest timeout | [#107](https://github.com/pepperhorn/chordl/pull/107) | 2026-11-09 @ 6b13fc1 | Codex impl; Opus r1 changes-requested @bc4ff4c (15s too low, waitFor 1s flake), r2 approve @e9355c8 (9/9 three-way loaded runs, slowest 23.4s). Auto-merged per §5a (10 code lines). Verify on main: 2819 pass. Follow-up 0041 (react) |
| 0032 | [quick] "C7alt" parses as "C7" in parseChordDescription | [#106](https://github.com/pepperhorn/chordl/pull/106) | 2026-11-09 @ ff0dc34 | Codex impl; Opus r1 changes-requested @5dd3b21 (C7ALT case, self-compare test), r2 approve @dfa0a4b. Verify on main: 2819 pass. Follow-ups S11, S13 |
| 0037 | Packed-board CI check uses workspace chordl-core | [#105](https://github.com/pepperhorn/chordl/pull/105) | 2026-11-09 @ b09d17d | Backfilled by sweep 2026-11-09 (merged outside this ledger) |
| 0031 | Resolver: slash + bracketed-alteration fallback | [#104](https://github.com/pepperhorn/chordl/pull/104) | 2026-11-08 @ fce7b1a | Backfilled by sweep 2026-11-09 (merged outside ledger). Handoffs: 2026-11-09-0031-* |
| 0030-t1 | m7b5(b9) + dim7(b9) chord types; bracketed extensions in resolveChord | [#103](https://github.com/pepperhorn/chordl/pull/103) | 2026-11-08 @ fe5c056 | Backfilled by sweep 2026-11-09; no spec/plan in this repo |
| adhoc | describeShape: plain-English how-to-play text (chordl-cards 0.2.0) | [#102](https://github.com/pepperhorn/chordl/pull/102) | 2026-11-07 @ dffc72d | Backfilled; handoff 2026-11-06-adhoc-how-to-play-descriptions (docs PR #99) |
| 0028-t3 | chordl-board card error marker (0.2.3) | [#101](https://github.com/pepperhorn/chordl/pull/101) | 2026-11-06 @ f60811a | Backfilled by sweep 2026-11-09; no spec/plan in this repo |
| 0025 | Instrument and level words in chord input | [#98](https://github.com/pepperhorn/chordl/pull/98) | 2026-11-06 @ 5b49972 | Opus r1 changes-requested @51cbe34 (card clobber, bare bass, keys phrases); r2 approve @3600436. Bare `bass` stays clef (human). Low notes: display flips mid-typing on "keys" phrases; two new board tests on default 5s timeout |
| 0026 | Export buttons on the string view | [#100](https://github.com/pepperhorn/chordl/pull/100) | 2026-11-06 @ 5d8ac29 | Codex r1 approve @4b78ecb. bass/violin have no shapes so no button. Follow-ups: header export animation (needs BoardEditor), CHANGELOG line after 0025, WAV timbre |

## Suggestions

> Lead-curated ideas: next steps, improvements, code efficiencies, stack changes, risks. Each needs evidence (file:line, a measurement, or a link). Status: `new` · `accepted → NNNN` · `declined: <why>` · `done`. Keep declined rows so they aren't suggested again. A PR mentioned here isn't tracked: only the PR column of Active or Done rows counts.

| S | Kind | Suggestion | Evidence | Effort (S/M/L) | Value | Source | Status |
|---|---|---|---|---|---|---|---|
| S1 | risk | Type-check chordl-board tests: tsconfig include is ["src"] only, so test/ is never checked | packages/chordl-board/tsconfig.json:23; 27 errors measured 2026-09 (16 need @types/node → a devDependency, so not quick lane) | S | M — a stale call already slipped through review | memory 2026-09 | accepted → 0043 |
| S2 | efficiency | Dockerfile + nginx gzip_static/brotli deploy (Coolify static mode ignores repo nginx.conf; Traefik compresses on the fly) | no Dockerfile on main; repo nginx.conf unused; cold load 13.0s vs warm 2.3s measured 2026-09 | M | H — first-load time | memory 2026-09 | accepted → 0044 |
| S3 | risk | Six library voicings unreachable (first-entry-per-(quality,style) wins; inferStyle never returns Rootless Type B) | findVoicing/generateVariants/inferStyle in chordl-voicings; measured 2026-09-08 | S | M | memory 2026-09 | new (not re-verified) |
| S4 | risk | Vulnerable transitives: dompurify 3.4.5 (critical GHSA-cg2g-xh64-v4q7, via board>jspdf), fast-uri (8 high, via voicing>ajv), image-size (via guitar>svguitar>svgdom). Lockfile refresh within existing ranges | `pnpm audit --prod`: 28 vulns (1 critical, 11 high) | S | H | scan 2026-11-09 | accepted → 0042 |
| S5 | risk | Extends S1 to every package: test/ is type-checked nowhere. tsconfig.test.json per package + `lint:test` in CI | 50 errors in board, 55 in core, 22 in cards, 0 in react (scratch tsc over src+test); ci.yml runs only `pnpm lint` | M | H | scan 2026-11-09 | accepted → 0043 |
| S6 | efficiency | Delete the stale tracked package-lock.json (old better-chord-react-monorepo); untrack the root screenshots and ScaleFormulas.jpg | `package-lock.json:2`; `git ls-files` | S | M | scan 2026-11-09 | new |
| S7 | efficiency | Deduplicate note→MIDI/pitch-class helpers onto tonal `Note.midi`/`Note.chroma` | 5 sharp tables (cards/faces.ts:81, cards/hands.ts:41, core/theory/chord-identify.ts:76, voicings/spellings.ts:27, react/follow/sequenceFromChords.ts:22); 4 noteToMidi copies (core mei-builder.ts:76, staff-layout.ts:70, react audio/playback.ts:193) | M | M | scan 2026-11-09 | new |
| S8 | risk | Tests for chordl-listen (detect/follow/resolve) and render-cli | listen: 597 src lines, 1 test file; render-cli has no test script | M | M | scan 2026-11-09 | new |
| S9 | stack | Major bumps one at a time: vitest 5, vite 8, plugin-react 6, jsdom 31, TS 7, smplr 1.x; minors (tonal, verovio, react 19.3, ajv) in one batch. Untangle core test → cards/src import first | `pnpm outdated -r`; core/test/chord-resolver.test.ts:2 | L | M | scan 2026-11-09 | new |
| S10 | efficiency | Root CLAUDE.md Commands said npm / `--grep` | CLAUDE.md:23-28 | S | M | scan 2026-11-09 | done (lead, 2026-11-09) |
| S11 | risk | Remaining `alt` spellings drop silently: `C7 alt`, `C7(alt)`, `C7alt9`, `Calt7`; and `Calt7` resolves to C E Bb Db vs `C7alt` C E G# Bb D# | PR #106 review r1 (5821147423) | S | M | review 0032 r1 | accepted → 0038 |
| S12 | risk | A core catalogue regression test also exceeds its default timeout under concurrent load | 0040 return handoff (orch/0040 @bc4ff4c) | S | M | 0040 follow-up | new |
| S13 | risk | CHORD_RE has no word boundary before the root letter: "play Bb7 over D" parses as chord A (from "play") | PR #106 review r2 (5821202395); natural-language.ts:417 | S | M | review 0032 r2 | accepted → 0038 |
| S14 | efficiency | Make the slowest board and react tests cheaper (react InteractiveInput.annotation-disabled 15.4s under load, PR #108 review 5821469568) instead of raising budgets again (slowest 23.4s of 30s under load) | PR #107 review r2 (5821405987) | M | M | review 0040 r2 | new |
| S15 | risk | Add `pnpm audit --prod --audit-level=high` to CI so new advisories surface on publish, not at the next sweep | PR #109 review r1 (5821891495); ci.yml has no audit step | S | M | review 0042 r1 | new |

Last health scan: 2026-11-09

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
- 2026-11-09 0042 in-review→ready — r1 (opus) approve @cb9f54d; dompurify 3.4.17, fast-uri 3.1.9, image-size 2.1.0; audit 0; dependency change → human
- 2026-11-09 0038 blocked (r0, PR #110 @3255fb6) — lead answered: leftover-word removals accepted (AC2 amended); add omit/no and attached major/minor grammar; banana test authorised
- 2026-11-09 0042 dispatched→in-review — PR #109 @cb9f54d, lockfile only (+13 -13), audit 28→0, no overrides; review r1 → opus
- 2026-11-09 0043 proposed→planned — spec + plan written; dispatch waits for 0042 and 0038 to merge
- 2026-11-09 human accepted S2, S4, S5, S11+S13; 0038 decided (unreadable input = error) → specced+planned+dispatched with S11/S13 folded in; 0042 (S4) →dispatched; 0043 (S1+S5) proposed, sequenced after 0042/0038; 0044 (S2) needs re-scope after re-measuring
- 2026-11-09 0041 in-review→merged→closed — #108 @1487fa7, r1 approve, CI green, auto-merged (§5a); verify on main passes, 2819 tests
- 2026-11-09 0041 dispatched→in-review — PR #108 @cb3b9ee; 6 three-way loaded react runs green, slowest 12.96s; pre-existing 10s override (play-mode-hotkey.test.tsx:63) and a 4s waitFor left alone; review r1 → opus
- 2026-11-09 0041 →dispatched (quick) — react InteractiveInput tests time out at 5s under load (0040 r2)
- 2026-11-09 0040 in-review→merged→closed — #107 @6b13fc1, r2 approve, CI green, auto-merged (§5a); verify on main passes, 2819 tests
- 2026-11-09 0040 changes-requested→in-review — r1 fixes @e9355c8 (30s, asyncUtilTimeout 5000, override removed); 9 three-way loaded runs green; review r2 → opus
- 2026-11-09 0032 ready→merged→closed — #106 @ff0dc34 (human approved); verify on main passes, 2819 tests. Human: handoff-doc lines don't count toward the auto-merge line limit
- 2026-11-09 0032 in-review→ready — r2 (opus) approve @dfa0a4b; CI green; over the 50-line auto-merge limit only because of handoff docs → human
- 2026-11-09 0032 changes-requested→in-review — r1 fixes @dfa0a4b (alt lowercased, real pitch-class test), 2819 tests pass; review r2 → opus
- 2026-11-09 0040 in-review→changes-requested — r1 (opus) @bc4ff4c: 15s still times out (16.3s/16.0s with 3 concurrent suites); waitFor 1s default is a confirmed flake. Lead: 30s, asyncUtilTimeout 5000 in test/setup.ts, drop the per-test 15000 override (scope widened). r1b cancelled (r1 had posted)
- 2026-11-09 0040 in-review — r1 reviewer ended before verify finished, posted nothing; re-dispatched as 0040-review-r1b
- 2026-11-09 0032 in-review→changes-requested — r1 (opus) @5dd3b21: C7ALT/C7Alt match the i-flag regex but keep case → Unknown chord; self-comparing notes test. Other alt spellings → S11
- 2026-11-09 0040 dispatched→in-review — PR #107 @bc4ff4c; 15s test/hook timeout, slowest loaded board test 9.71s, 5 loaded runs green; review r1 → claude-opus. Follow-up: a core catalogue test also times out under load
- 2026-11-09 0032 dispatched→in-review — PR #106 @5dd3b21, 2816 tests pass, 104 legacy parses unchanged; review r1 → claude-opus
- 2026-11-09 0040 →dispatched (quick, from scan); health scan → S4–S10; 0037/#105 backfilled; proposed rows renumbered 0038/0039 to avoid IDs used elsewhere
- 2026-11-09 sweep — backfilled 0028-t3/#101, #102, 0030-t1/#103, 0031/#104; 0032 →dispatched (quick); 0038, 0039 →proposed
- 2026-11-06 0025 in-review→merged — #98 @5b49972, r2 approve; CHANGELOG line for 0026 added
- 2026-11-06 0025 changes-requested→in-review — r1 fixes @3600436 (user-edit-only apply, bare bass = clef, keys phrases protected; 353 legacy inputs identical); review r2 → opus
- 2026-11-06 0026 in-review→merged — #100 @5d8ac29; verify on main passes (board tests flaky under load avg 17, clean on rerun)
- 2026-11-06 0025 in-review→changes-requested — r1 (opus) @51cbe34: card open clobbers stored values; bare bass broke clef hand; keys padding/format broken. Human: bare bass stays clef; spec amended
- 2026-11-06 0026 dispatched→in-review — PR #100 @ 4b78ecb; bass/violin have no shapes so no button (accepted); review r1 → codex
- 2026-11-06 0025 dispatched→in-review — PR #98 @ 51cbe34, 2704 tests pass; review r1 → claude-opus
- 2026-11-06 0026 →dispatched — string view has no zip export (human report); parallel with 0025, disjoint files
- 2026-11-06 0025 →dispatched — "ukulele am beginner" parsed as E; spec approved by human (switch view + level, aliases)
