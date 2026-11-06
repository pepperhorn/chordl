# WIP Ledger

> Single writer: the **lead**, on the main branch only. Implementers report status through their return handoff.
> Status: proposed · specced · planned · dispatched · in-review · changes-requested · ready · merged · closed · blocked · parked

Next ID: 0027  (0001–0024 were used before the ledger existed; see orch/0024-* branches)

## Active

| K | Title | Status | Owner (provider/model) | Branch | PR | Worktree | T3 task/thread | Spec | Plan | Latest handoff | Updated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0026 | Export buttons on the string view | dispatched | claudeAgent/claude-sonnet-5-5 | orch/0026-string-view-export | — | T3 | task 0026-impl-r1 · thread thread:delegated-task:command%3Amcp%3A35df5e07-6bab-42e2-8676-868a73460001%3Adelegate-task%3A0026-impl-r1 | [spec](../specs/0026-string-view-export.md) | [plan](../plans/0026-string-view-export.md) | [dispatch](../handoffs/2026-11-06-0026-string-view-export--lead-to-claude.md) | 2026-11-06 |
| 0025 | Instrument and level words in chord input | dispatched | codex/gpt-6.1-sol | orch/0025-instrument-level-words | — | T3 | task 0025-impl-r1 · thread thread:delegated-task:command%3Amcp%3A35df5e07-6bab-42e2-8676-868a73460001%3Adelegate-task%3A0025-impl-r1 | [spec](../specs/0025-instrument-level-words.md) | [plan](../plans/0025-instrument-level-words.md) | [dispatch](../handoffs/2026-11-06-0025-instrument-level-words--lead-to-codex.md) | 2026-11-06 |

## Done / closed

| K | Title | PR | Merged | Notes |
|---|---|---|---|---|

## Log
<!-- One line per status change, newest first: YYYY-MM-DD NNNN old→new — note -->
- 2026-11-06 0026 →dispatched — string view has no zip export (human report); parallel with 0025, disjoint files
- 2026-11-06 0025 →dispatched — "ukulele am beginner" parsed as E; spec approved by human (switch view + level, aliases)
