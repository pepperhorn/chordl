# Handoff: 0042 — Patch vulnerable transitive dependencies (lead → sol)

- **Date:** 2026-11-09
- **Type:** quick
- **Ledger:** 0042 · **Spec:** none (human accepted suggestion S4) · **Plan:** none
- **Branch:** orch/0042-audit-transitives · **Worktree:** created by T3
- **PR:** <url once opened>
- **Base commit:** 436e03e
- **Status:** closed

## Goal
`pnpm audit --prod` reports 28 vulnerabilities (1 critical, 11 high). Fix the three groups below by moving the lockfile to patched versions that already sit inside the parents' declared ranges:
- **dompurify** 3.4.5 (critical GHSA-cg2g-xh64-v4q7, high GHSA-mrv2-3pqr-j5jr), via `chordl-board > jspdf@4.2.1` (jspdf allows `^3.3.1`; 3.4.17 is out).
- **fast-uri** (8 highs, fixed in 3.1.9), via `chordl-voicing > ajv` (allows `^3.0.1`).
- **image-size** (GHSA-w3rx-r6r6-pgpr, fixed in 2.1.0), via `chordl-guitar > svguitar > svgdom` (allows `^2.0.2`).
Done = those advisories are gone from `pnpm audit --prod`, and no direct dependency range changes. Fix any other advisory only if it clears the same way (lockfile only, within ranges); list everything that remains.

## Scope
- **Files you own:** `pnpm-lock.yaml`. Also root `package.json`, but only to add a `pnpm.overrides` floor if a plain lockfile update can't reach the patched version. Prefer no overrides, and justify any you add.
- **Do not touch:** package `package.json` dependency ranges, source, tests.

## Acceptance criteria
- [ ] `pnpm audit --prod` before/after pasted; the three groups above are gone.
- [ ] `git diff main -- '**/package.json'` is empty, or shows only a justified root `pnpm.overrides`.
- [ ] Verify command passes, plus `node scripts/verify-board-package.mjs` (CI's packed-consumer check, since jspdf's tree changes).

## Verify with
```bash
pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs && pnpm audit --prod
```

## Known gotchas / decisions already made
- The human approved this dependency change on 2026-11-09 (ledger S4).

## Open questions
None.

---
## Receiver ack
Acknowledged by sol on 2026-11-09. I will capture the production audit before/after, refresh vulnerable transitive resolutions within the parents' existing ranges, and prefer lockfile-only changes with no overrides. I own only pnpm-lock.yaml, the conditional root pnpm.overrides, and this task's handoffs; source, tests, package dependency ranges, and the ledger are out of scope. I will run the complete verification command including the packed-board consumer check, list remaining advisories, commit a return handoff, push my branch, and open a draft PR. No open questions.

Starting HEAD: a94f24fcf3f01b1cade5cabc985fcf386e8c8f4b; the required base 436e03e is an ancestor and the worktree was clean. GBrain searched for chordl dependency/audit context; only unrelated synthetic conformance pages returned, so no relevant GBrain page was used.
