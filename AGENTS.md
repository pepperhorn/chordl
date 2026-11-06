<!-- ph-orch:begin v2 — managed by orch-init; customise via .ph-orch.json, edit outside these markers, or re-run orch-init to upgrade -->
# Agent Operating Manual

Every agent working in this repo (Claude, Codex, or anything else) reads this first.
It covers where things live, who does what, and the words that trigger a protocol.

## 1. Where things live

| What | Path | Who writes it |
|---|---|---|
| Doc index (start here) | `docs/README.md` | lead |
| Specs (what and why) | `docs/specs/NNNN-<slug>.md` | lead |
| Plans (how, task breakdown) | `docs/plans/NNNN-<slug>.md` | lead |
| Handoffs (shared understanding between agents) | `docs/handoffs/YYYY-MM-DD-K-<slug>--<from>-to-<to>.md` | whoever is handing over |
| Decisions (ADRs) | `docs/decisions/<next free number>-<slug>.md` (their own numbering) | lead; implementers propose them in their return handoff |
| **WIP ledger** | `docs/wip/LEDGER.md` | **lead only, on `main`** |
| Cross-project memory | **GBrain** (MCP), see §8 | everyone reads; lead writes |
| Templates | `_TEMPLATE.md` in each folder | — |

`NNNN` is the work-item ID from the ledger, e.g. `0007`. The **task key** `K` is `NNNN` for a single-task item, or `NNNN-tN` for task N of a multi-task plan, e.g. `0007-t2`. Keys tie the spec, plan, handoffs, branch, PR, worktree, and port together.

Before starting any work, read the ledger and every doc linked from your ledger row or handoff. If a doc you were pointed at doesn't exist, stop and say so. Don't guess.

## 2. Roles

Any capable model can hold any role. Which one you are depends on where you're running and what your brief says, not on which model you are.

- **Lead** (Claude Opus or Codex, in the **main checkout**): talks with the human, writes specs and plans, records decisions, dispatches work, runs reviews, merges PRs, and owns the ledger and the GBrain write-back. It never writes feature code on the main checkout. Its playbook is the `orch-dispatch` skill.
- **Implementer** (in its **own worktree**): carries out one plan task within its declared scope, opens a PR, and hands back.
- **Reviewer** (the **other model family** from the implementer): reviews the PR against the spec, the plan, and the acceptance criteria. It never edits code.

### Routing (customise in `.ph-orch.json`; T3 `delegate_task` targets)

| Role | providerInstanceId | model | options |
|---|---|---|---|
| implement (default) | codex | gpt-6.1-sol | {"reasoningEffort":"high"} |
| implement (alt) | claudeAgent | claude-sonnet-5-5 | {"effort":"high"} |
| review Codex-family work | claudeAgent | claude-opus-5-5 | {"effort":"high"} |
| review Claude-family work | codex | gpt-6.1-sol | {"reasoningEffort":"high"} |

If an instance isn't available, check `orchestrator_capabilities` and use the nearest equivalent. Never review work with the same model family that implemented it.

**T3 tools** come from the `t3-code` MCP server. They may be named `delegate_task`, `mcp__t3_code__delegate_task`, or (in Codex code mode) `tools.mcp__t3_code__delegate_task(...)`. They're the same tools.

## 3. Trigger vocabulary — "hand over" / "handoff"

When anyone (human or agent) says **"hand over"**, **"handover"**, **"hand off"**, **"handoff"**, **"hand this to …"**, or **"handoff to …"**, it means:

> Write a handoff doc in `docs/handoffs/` from `_TEMPLATE.md`, commit it, and refer to it by path.
> The receiving agent's understanding comes from that doc and the docs it links. It never comes from chat history.

Rules:
1. Self-contained: assume the receiver has no conversation context.
2. Link to specs, plans, and ADRs instead of copying them. Copy only what's needed to remove ambiguity.
3. Always fill in: goal, scope (in and out), files owned, acceptance criteria, verification commands, open questions, and the branch, worktree, or PR.
4. Commit it **before** dispatching. Worktrees are created from the last local commit, so uncommitted docs won't be there.
5. **Acknowledgement depends on your role.** An *implementer* first restates its understanding in the handoff's "Receiver ack" section and commits it on its branch, or writes `Blocked: …` there. A *reviewer* never edits files: its acknowledgement is the opening of its PR review comment. The *lead* acknowledges return handoffs through the ledger.
6. Finishing work is also a handoff (the "return handoff"): the implementer writes `…--<impl>-to-lead.md` on its branch.

Related words: **"park"** means write a handoff addressed to `future` and set the ledger row to `parked`. **"ledger"** always means `docs/wip/LEDGER.md`. **"the brain"** / **"GBrain"** means §8.

## 4. Worktrees and PRs — never share a checkout

- The main checkout (`main`) is for the lead, and only for docs and the ledger.
- Every implementation task runs in its **own worktree on its own branch**: `orch/K-<slug>`. One agent per worktree, always.
- Parallel tasks must own **disjoint files**, as declared in the plan. If you need to touch a file you don't own, stop and note it in your return handoff. Don't edit it.
- Every implementer **also owns its own handoff files** for its task key `K`: the ack section of its dispatch handoff, and its `…-K-…--<impl>-to-lead.md` return handoff. It owns no other docs.
- **Code reaches `main` only through a PR**: implementer opens it → reviewer reviews it → lead merges it. Docs and ledger commits by the lead go straight to `main`.
- Implementers push only their own branch (`git push -u origin orch/K-<slug>`) and open a **draft PR** against `main`. Never merge, never push to `main`, never rebase someone else's branch.
- All agents share one GitHub account, and GitHub won't let an account approve or request changes on its own PR. Reviewers post `gh pr review --comment` with a verdict line. The verdict is what decides the outcome, not GitHub's approval state.
- Worktrees don't get untracked files such as `.env`. The setup is: `pnpm install --frozen-lockfile && pnpm build && cp "$(git worktree list | head -1 | cut -d' ' -f1)/.env" .env  (packages resolve each other from dist, so build before lint/test; .env comes only from the main checkout; T3 project setup does not copy it)`.
- Dev servers in worktrees use the port from the handoff (`5200 + NNNN*10 + N`, where N = 0 for a single-task item), always with `--host 0.0.0.0`.

## 5. Ledger rules

- Only the lead edits the ledger, and only on `main`. This avoids merge conflicts across worktrees.
- Implementers report status (and their PR URL) through their return handoff. The lead copies it into the ledger.
- Status flow: `proposed → specced → planned → dispatched → in-review → changes-requested → ready → merged → closed`, plus `blocked` and `parked`.

## 6. Definition of done (implementer)

- [ ] Acceptance criteria in the handoff are met
- [ ] Verification commands pass: `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site`
- [ ] Only the files you own were changed (`git diff --stat main...HEAD`)
- [ ] Return handoff written and committed on your branch
- [ ] Branch pushed and draft PR opened; its body links the handoffs and pastes the verification output
- [ ] No unrecorded decisions: anything non-obvious goes in the return handoff's "Decisions made" section

## 7. Escalate, don't improvise

If the spec is ambiguous, the plan is wrong, or scope needs to grow: stop, write the question into the return handoff, set it to `blocked`, and finish. A short honest handback is better than a confident wrong one.

## 8. GBrain (cross-project memory)

The repo docs are the **source of truth** for this project. GBrain is the **memory across projects and sessions**.

- **Everyone reads.** Before speccing, planning, or starting a task, search GBrain for this project (chordl), the people involved, related past decisions, and known gotchas. Cite page names you used in your handoff.
- **The lead writes**, at these points:
  - spec approved → a project page entry
  - ADR accepted → a decision page
  - PR merged → an outcome summary with links to the spec, ADR, and PR
  - lessons learned → a gotchas page

  One page per idea. Link back to the repo paths and the PR URL. Don't paste whole docs.
- **Implementers and reviewers don't write to GBrain.** They put anything worth remembering under "Decisions made" or "Follow-ups" in their return handoff, and the lead promotes it.
- **Never** write secrets, tokens, `.env` values, or customer data to GBrain.
- If GBrain isn't available in your session, say so in your handoff (`GBrain: unavailable`) and carry on.
<!-- ph-orch:end -->
