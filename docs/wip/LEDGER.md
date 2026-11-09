# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked
> Waiting on: `child <taskId>` · `review <taskId>` · `ci` · `human: <why>` · `lead: <next action>`. Set it on every status change. A row needs the lead when it starts with `lead`, or when it's empty and Status is dispatched, in-review, changes-requested, ready, or merged. The lead's Stop hook won't let the lead end its turn while any row needs it.
> Type: normal items have a spec and plan. Quick items have the title prefix `[quick]` (no spec or plan, a short handoff). PRs adopted by `orch-sweep` have the prefix `[pr]`.

Next ID: 0035  (0001–0024 were used before the ledger existed; see orch/0024-* branches; 0027 and 0029 were assigned outside this ledger)

## Active

| K | Title | Status | Waiting on | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| S1 | risk | Type-check chordl-board tests: tsconfig include is ["src"] only, so test/ is never checked | packages/chordl-board/tsconfig.json:23; 27 errors measured 2026-09 (16 need @types/node → a devDependency, so not quick lane) | S | M — a stale call already slipped through review | memory 2026-09 | new |
| S2 | efficiency | Dockerfile + nginx gzip_static/brotli deploy (Coolify static mode ignores repo nginx.conf; Traefik compresses on the fly) | no Dockerfile on main; repo nginx.conf unused; cold load 13.0s vs warm 2.3s measured 2026-09 | M | H — first-load time | memory 2026-09 | new |
| S3 | risk | Six library voicings unreachable (first-entry-per-(quality,style) wins; inferStyle never returns Rootless Type B) | findVoicing/generateVariants/inferStyle in chordl-voicings; measured 2026-09-08 | S | M | memory 2026-09 | new (not re-verified) |
| 0032 | [quick] "C7alt" parses as "C7" in parseChordDescription | dispatched | lead: delegate | codex/gpt-6.1-sol | orch/0032-c7alt-parse | | | | — | — | [lead→sol](../handoffs/2026-11-09-0032-c7alt-parse--lead-to-sol.md) | 2026-11-09 |
| 0033 | Chord box accepts nonsense ("@@@ not a chord @@@" → C, "Zbq9" → B) | proposed | human: needs spec (error vs. empty vs. best guess is a product call) | — | | | | | | | | 2026-11-09 |
| 0034 | Notation view: annotations to the right of the stave; scales/runs as beamed eighths | proposed | human: needs spec (3 defects: StaffNotationProps has no annotation props; scale/run branches of PianoChord skip display; mei-builder.ts:115,117 hard-code dur="1") | — | | | | | | | | 2026-11-09 |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|
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

Last health scan: never

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
- 2026-11-09 sweep — backfilled 0028-t3/#101, #102, 0030-t1/#103, 0031/#104; 0032 →dispatched (quick); 0033, 0034 →proposed
- 2026-11-06 0025 in-review→merged — #98 @5b49972, r2 approve; CHANGELOG line for 0026 added
- 2026-11-06 0025 changes-requested→in-review — r1 fixes @3600436 (user-edit-only apply, bare bass = clef, keys phrases protected; 353 legacy inputs identical); review r2 → opus
- 2026-11-06 0026 in-review→merged — #100 @5d8ac29; verify on main passes (board tests flaky under load avg 17, clean on rerun)
- 2026-11-06 0025 in-review→changes-requested — r1 (opus) @51cbe34: card open clobbers stored values; bare bass broke clef hand; keys padding/format broken. Human: bare bass stays clef; spec amended
- 2026-11-06 0026 dispatched→in-review — PR #100 @ 4b78ecb; bass/violin have no shapes so no button (accepted); review r1 → codex
- 2026-11-06 0025 dispatched→in-review — PR #98 @ 51cbe34, 2704 tests pass; review r1 → claude-opus
- 2026-11-06 0026 →dispatched — string view has no zip export (human report); parallel with 0025, disjoint files
- 2026-11-06 0025 →dispatched — "ukulele am beginner" parsed as E; spec approved by human (switch view + level, aliases)
