# Handoff: 0049 — CI production advisory gate (sol → lead)

- **Date:** 2026-11-10
- **Type:** return
- **Ledger:** 0049 · quick item; no spec or plan
- **Branch:** orch/0049-ci-audit
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-e86b93f2
- **PR:** draft against main (URL supplied in final response)
- **Base commit:** 4911f61 (dispatch base; acknowledgement commit 06e869e)
- **Status:** implementation complete; PR CI result remains for lead verification

## Goal
Fail CI on newly published high or critical production dependency advisories, immediately after installation and before building.

## Context you need
- [Dispatch and receiver acknowledgement](2026-11-10-0049-ci-audit--lead-to-sol.md)
- [CI workflow](../../.github/workflows/ci.yml)
- [Ledger](../wip/LEDGER.md), row 0049 / accepted suggestion S15.

## Scope
- **In / files owned:** `.github/workflows/ci.yml`, plus this task's acknowledgement and return handoff.
- **Out / do not touch:** all other files; dependencies, lockfiles, retry policies, merge, PR watching/polling.
- Added `pnpm audit --prod --audit-level=high` after Install with a one-line comment explaining the severity gate and that no build is needed.

## Acceptance criteria
- [x] Audit step immediately after Install, with one-line explanatory comment.
- [x] Production audit exits 0 locally.
- [x] Scratch vulnerable lockfile demonstrates exit 1 on high/critical advisories.
- [ ] PR CI passes: lead must verify after opening; implementer explicitly instructed not to watch or poll the PR.

## Verify with
```bash
pnpm install --frozen-lockfile && pnpm audit --prod --audit-level=high
pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
git diff --check
git diff --stat main...HEAD
```

## Known gotchas / decisions already made
- GBrain was available; search `chordl CI audit 0042 0049` returned no relevant pages. No GBrain pages used or written; lead owns write-back.
- CI changes require human merge approval under AGENTS.md. No merge performed.
- No measured audit endpoint failure; no retry or `continue-on-error` added.

## Open questions
None. PR CI result is an outstanding verification gate for the lead.

## Return (implementer → lead)
- **Outcome:** implementation done; PR CI acceptance pending.
- **What changed:** four workflow lines; task acknowledgement and return handoff only.
- **Decisions made:** retained the default blocking audit exit behavior. No ADR needed.
- **Out-of-scope issues found:** none requiring code changes.
- **Follow-ups:** verify PR CI and arrange cross-family review, then obtain human merge approval.
- **For GBrain (lead to promote):** CI now checks production advisories before build; vulnerable scratch lockfile proves the severity gate returns nonzero.

### Verification output
```text
$ pnpm install --frozen-lockfile && pnpm audit --prod --audit-level=high
Lockfile is up to date, resolution step is skipped
Done in 2.2s using pnpm v10.32.1
No known vulnerabilities found
exit 0

$ pnpm --version
10.32.1
$ pnpm --dir /tmp/chordl-0049-audit.btWSEk audit --prod --audit-level=high
14 vulnerabilities found
Severity: 6 low | 6 moderate | 1 high | 1 critical
exit 1
```
Scratch fixture is outside the checkout, contains only a private package with production `dompurify: 3.4.5`, and was generated with `pnpm install --lockfile-only --ignore-scripts`. The first scratch generation used pnpm 10.33.0; the reported confirmation above reran the audit with repository-pinned 10.32.1. Nothing from the fixture was committed.

```text
$ pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
pnpm build: exit 0
pnpm lint: exit 0
pnpm test:run: exit 0 (2943 passed tests across 8 packages)
Final package: Test Files 28 passed (28); Tests 345 passed (345)
Site build: ✓ built in 10.16s; exit 0
$ git diff --check
exit 0
```
Build/site output included chunk-size warnings; tests included jsdom navigation diagnostics. All required commands exited 0. Scope check confirmed only the workflow and two task-owned handoff files changed.
