# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked

Next ID: 0027  (0001–0024 were used before the ledger existed; see orch/0024-* branches)

## Active

| K | Title | Status | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0026 | Export buttons on the string view | in-review | claudeAgent/claude-sonnet-5-5 | orch/0026-string-view-export @ 4b78ecb | [#100](https://github.com/pepperhorn/chordl/pull/100) | /home/shaun/.t3/worktrees/chordl/t3-18df5969 | task 0026-impl-r1 · thread thread:delegated-task:command%3Amcp%3A35df5e07-6bab-42e2-8676-868a73460001%3Adelegate-task%3A0026-impl-r1 | [spec](../specs/0026-string-view-export.md) | [plan](../plans/0026-string-view-export.md) | [return @4b78ecb](../handoffs/2026-11-06-0026-string-view-export--claude-to-lead.md) | 2026-11-06 |
| 0025 | Instrument and level words in chord input | changes-requested | codex/gpt-6.1-sol | orch/0025-instrument-level-words @ 51cbe34 | [#98](https://github.com/pepperhorn/chordl/pull/98) | /home/shaun/.t3/worktrees/chordl/t3-65720342 | task 0025-impl-r1 · thread thread:delegated-task:command%3Amcp%3A35df5e07-6bab-42e2-8676-868a73460001%3Adelegate-task%3A0025-impl-r1 | [spec](../specs/0025-instrument-level-words.md) | [plan](../plans/0025-instrument-level-words.md) | [return @51cbe34](../handoffs/2026-11-06-0025-instrument-level-words--codex-to-lead.md) | 2026-11-06 |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
- 2026-11-06 0025 in-review→changes-requested — r1 (opus) @51cbe34: card open clobbers stored values; bare bass broke clef hand; keys padding/format broken. Human: bare bass stays clef; spec amended
- 2026-11-06 0026 dispatched→in-review — PR #100 @ 4b78ecb; bass/violin have no shapes so no button (accepted); review r1 → codex
- 2026-11-06 0025 dispatched→in-review — PR #98 @ 51cbe34, 2704 tests pass; review r1 → claude-opus
- 2026-11-06 0026 →dispatched — string view has no zip export (human report); parallel with 0025, disjoint files
- 2026-11-06 0025 →dispatched — "ukulele am beginner" parsed as E; spec approved by human (switch view + level, aliases)
