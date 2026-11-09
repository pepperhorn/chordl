# Handoff: 0049 — [quick] CI: fail on high-severity production advisories (lead → sol)

- **Date:** 2026-11-10 · **Type:** quick · **Ledger:** 0049 (suggestion S15, accepted by the human)
- **Branch:** orch/0049-ci-audit · **Worktree:** created by T3 · **Base commit:** 4911f61
- **Status:** closed

## Goal
Add a step to `.github/workflows/ci.yml` that runs `pnpm audit --prod --audit-level=high`, so a new high or critical advisory in a production dependency fails CI as soon as it's published. Today it only shows up at the next manual sweep (0042 found 28). Put it after Install, and make clear in the step that it doesn't need the build. `pnpm audit --prod` is clean on main today (0042).

## Scope
- **Files you own:** `.github/workflows/ci.yml`
- **Do not touch:** everything else.

## Acceptance criteria
- [ ] The step is present with a one-line comment explaining why.
- [ ] Locally: `pnpm audit --prod --audit-level=high` exits 0 on this branch. Show that it would fail on a high advisory, either by citing pnpm's documented exit behaviour or by testing against a scratch lockfile pinned to the pre-0042 `dompurify@3.4.5`. Don't commit that.
- [ ] The CI run on the PR passes.

## Verify with
```bash
pnpm install --frozen-lockfile && pnpm audit --prod --audit-level=high
```

## Known gotchas / decisions already made
- This changes CI, so the lead will ask the human before merging.
- Network flakiness in the audit endpoint is a known risk. Don't add retries or `continue-on-error` unless you measure a real failure, and if you do, record why.

## Open questions
None.

---
## Receiver ack

Acknowledged by sol (2026-11-10). I will change only `.github/workflows/ci.yml` plus the task-owned handoffs: add `pnpm audit --prod --audit-level=high` immediately after Install with a one-line rationale explaining that no build is needed. I will verify the clean production audit and demonstrate the failing high-advisory path, run required workspace verification, then push the task branch and open a draft PR. No retries, error suppression, dependency changes, merge, PR watching, or polling. No open questions. GBrain search for chordl CI/audit 0042/0049 returned no relevant pages.
