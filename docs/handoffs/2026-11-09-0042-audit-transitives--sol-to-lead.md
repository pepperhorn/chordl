# Handoff: 0042 — Patch vulnerable transitive dependencies (sol → lead)

- **Date:** 2026-11-09
- **Type:** return
- **Ledger:** 0042 · **Spec:** none (quick; accepted S4) · **Plan:** none
- **Branch:** orch/0042-audit-transitives
- **Worktree:** /home/shaun/.t3/worktrees/chordl/t3-bf75a123
- **PR:** draft PR to be created immediately after this handoff commit; see branch PR.
- **Base commit:** a94f24fcf3f01b1cade5cabc985fcf386e8c8f4b (required 436e03e is an ancestor)
- **Implementation commit:** cba5642
- **Status:** closed (implementation complete; awaiting lead review)

## Goal and context
Remove the production audit findings via existing parent dependency ranges. Dispatch and scope: [lead → sol](2026-11-09-0042-audit-transitives--lead-to-sol.md). No spec or plan applies.

## Scope
- **In / files owned:** pnpm-lock.yaml; conditional root pnpm.overrides if necessary; the ack and return handoffs for 0042.
- **Out:** source, tests, all package dependency ranges, ledger, and unrelated docs.
- **Changed:** only pnpm-lock.yaml and these two task handoffs. No manifest changes or overrides.

## Acceptance criteria
- [x] Before/after production audit pasted below; all three target groups gone.
- [x] `git diff main -- package.json '**/package.json'` is empty.
- [x] Frozen install, build, lint, full tests, site build, and packed-board consumer check pass.

## What changed / decisions made
- DOMPurify 3.4.5 → 3.4.17 under jspdf 4.2.1's `^3.3.1` optional range.
- fast-uri 3.1.0 → 3.1.9 under ajv 8.18.0's `^3.0.1` range.
- image-size 2.0.2 → 2.1.0 under svgdom 0.1.28's `^2.0.2` range.
- Confirmed these parent ranges with `pnpm view` against the registry. No direct resolutions or declared ranges changed.
- Ran `pnpm update -r --depth 100 dompurify fast-uri image-size --lockfile-only`; removed incidental Babel re-resolution from that command to keep the patch limited to the three targets. Frozen installation validated the resulting lockfile.
- image-size now requires Node >=18; chordl-guitar already requires >=20.10, and CI uses Node 26. Local validation used Node v26.12.0 / pnpm 10.32.1.
- No overrides needed. All 28 original findings were in these groups; zero advisories remain.

## Known gotchas / prior context
GBrain was available and searched for chordl dependency/audit context. Only unrelated synthetic conformance pages returned; no relevant GBrain page was used. Implementer made no GBrain writes.

Build/lint completed before tests to ensure sibling packages resolve current dist. Non-failing output included existing jsdom navigation notices, core-js build-script policy notice, and Vite large-chunk/browser-externalization warnings. Source/tests were unchanged.

## Verify with
```bash
pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs && pnpm audit --prod
```
Commands ran in this order, all exited 0. Full test total: **2,819 tests across 155 files**. Scope audit: lockfile only outside the task handoffs (13 insertions / 13 deletions); `git diff --check` passes. Refreshed origin/main; its two newer commits contain only lead documentation.

## Verification output (tails / suite summaries)
```text
$ pnpm install --frozen-lockfile
╭ Warning ─────────────────────────────────────────────────────────────────────╮
│                                                                              │
│   Ignored build scripts: core-js@3.49.0.                                     │
│   Run "pnpm approve-builds" to pick which dependencies should be allowed     │
│   to run scripts.                                                            │
│                                                                              │
╰──────────────────────────────────────────────────────────────────────────────╯
Done in 2s using pnpm v10.32.1
Exit: 0

$ pnpm build
[vite:dts] Declaration files built in 3032ms.

✓ built in 3.35s
dist/ ok: every relative import has an extension; entries load in Node

> @pepperhorn/chordl-board@0.2.3 build /home/shaun/.t3/worktrees/chordl/t3-bf75a123/packages/chordl-board
> tsc

Exit: 0

$ pnpm lint

> @pepperhorn/chordl-cards@0.3.0 lint /home/shaun/.t3/worktrees/chordl/t3-bf75a123/packages/chordl-cards
> tsc --noEmit


> @pepperhorn/chordl-board@0.2.3 lint /home/shaun/.t3/worktrees/chordl/t3-bf75a123/packages/chordl-board
> tsc --noEmit

Exit: 0

$ pnpm test:run
 Test Files  9 passed (9)
      Tests  176 passed (176)
 Test Files  16 passed (16)
      Tests  588 passed (588)
 Test Files  1 passed (1)
      Tests  13 passed (13)
 Test Files  19 passed (19)
      Tests  337 passed (337)
 Test Files  9 passed (9)
      Tests  161 passed (161)
 Test Files  49 passed (49)
      Tests  385 passed (385)
 Test Files  26 passed (26)
      Tests  822 passed (822)
 Test Files  26 passed (26)
      Tests  337 passed (337)
Exit: 0

$ pnpm --filter @pepperhorn/chordl-react build:site
../site-dist/assets/index-CmNbDIq_.js                    1,124.81 kB │ gzip:   281.53 kB
../site-dist/assets/verovio-module-DkpEqvr0.js           7,890.42 kB │ gzip: 2,343.83 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 6.84s
Exit: 0

$ node scripts/verify-board-package.mjs
Packed editor/player SSR, exports and scoped stylesheet pass.
Packed consumer typecheck and Vite build pass: /tmp/chordl-board-consumer-Q87egv
Exit: 0

$ pnpm audit --prod
No known vulnerabilities found
Exit: 0
```

## Production audit before (exit 1)
```text
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ critical            │ DOMPurify SAFE_FOR_TEMPLATES bypass: split template    │
│                     │ expressions survive in attached shadow root content on │
│                     │ DOM output modes                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.4.4 <=3.4.16                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.17                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-cg2g-xh64-v4q7      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ fast-uri vulnerable to host confusion via literal      │
│                     │ backslash authority delimiter                          │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <=3.1.3                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.4                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-v2hh-gcrm-f6hx      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ fast-uri vulnerable to host confusion via backslash    │
│                     │ authority introducer                                   │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <3.1.5                                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.5                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-7p8r-x3mc-p8w7      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ fast-uri vulnerable to path traversal via              │
│                     │ percent-encoded dot segments                           │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <=3.1.0                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.1                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-q3j6-qgpj-74h6      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ fast-uri vulnerable to host confusion via              │
│                     │ percent-encoded authority delimiters                   │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <=3.1.1                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.2                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-v39h-62p7-jpjc      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ fast-uri vulnerable to server-side request forgery via │
│                     │ malformed IPv6 normalization                           │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <3.1.6                                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.6                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-f65p-4m7j-42xc      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ fast-uri vulnerable to host confusion via              │
│                     │ percent-encoded scheme normalization                   │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <3.1.6                                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.6                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-jqff-g426-hqxp      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ fast-uri vulnerable to host confusion via failed IDN   │
│                     │ canonicalization                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <3.1.3                                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.3                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-4c8g-83qw-93j6      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ image-size: JXL and HEIF parsers allow denial of       │
│                     │ service through infinite loops                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ image-size                                             │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=1.2.0 <=2.0.2                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=2.0.3                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-guitar>svguitar>svgdom>image-size     │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-5p2g-fcmc-qvqq      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ image-size: ICNS parser allows denial of service       │
│                     │ through an infinite loop                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ image-size                                             │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=0.6.3 <=2.0.2                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=2.0.3                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-guitar>svguitar>svgdom>image-size     │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-w3rx-r6r6-pgpr      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ fast-uri vulnerable to authority injection via an      │
│                     │ unvalidated port in serialize                          │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <3.1.7                                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.7                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-qw65-cvwx-89v3      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ high                │ DOMPurify IN_PLACE: hook that removes a parent or      │
│                     │ sibling leaves the detached subtree's event handlers   │
│                     │ armed (incomplete fix for GHSA-p98j-92pf-mc4p)         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=3.4.16                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.17                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-mrv2-3pqr-j5jr      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ DOMPurify: Cross-realm IN_PLACE sanitization leaves    │
│                     │ executable markup intact via realm-bound `instanceof`  │
│                     │ checks                                                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=3.4.5                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.6                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-hpcv-96wg-7vj8      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ DOMPurify: IN_PLACE mode preserves attributes of a     │
│                     │ clobbered root element, allowing XSS via               │
│                     │ attacker-controlled root DOM                           │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=3.4.5                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.6                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-r47g-fvhr-h676      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ DOMPurify IN_PLACE Sanitization Bypass via Attached    │
│                     │ Shadow Root Inside <template>.content                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=3.4.6                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.7                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-rp9w-3fw7-7cwq      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ DOMPurify: Permanent `ALLOWED_ATTR` pollution via      │
│                     │ `setConfig()` bypassing the hook clone-guard           │
│                     │ (incomplete fix of the 3.4.7 hook-pollution patch)     │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=3.4.10                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.11                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-cmwh-pvxp-8882      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ DOMPurify: Hook mutation of `data.allowedTags` /       │
│                     │ `data.allowedAttributes` permanently pollutes          │
│                     │ `DEFAULT_ALLOWED_TAGS` / `DEFAULT_ALLOWED_ATTR`        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <3.4.7                                                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.7                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-76mc-f452-cxcm      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ DOMPurify: IN_PLACE hook removal leaves a detached     │
│                     │ subtree executable, causing XSS                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=3.4.12                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.13                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-55q2-fjhq-7xh7      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ fast-uri vulnerable to inconsistent host case          │
│                     │ normalization via percent-encoded octets               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <3.1.8                                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.8                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-hrr3-gc8f-f4qj      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ moderate            │ fast-uri vulnerable to URI scheme spoofing via         │
│                     │ percent-encoded scheme decoding                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <3.1.9                                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.9                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-w74x-v6f9-j3xg      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ low                 │ DOMPurify: Trusted Types policy survives               │
│                     │ `clearConfig()` and can poison later                   │
│                     │ `RETURN_TRUSTED_TYPE` output                           │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <3.4.9                                                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.9                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-vxr8-fq34-vvx9      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ low                 │ DOMPurify: SAFE_FOR_TEMPLATES bypass - template        │
│                     │ expressions survive sanitization inside <template>     │
│                     │ content when using DOM output modes                    │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <=3.4.7                                        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.8                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-gvmj-g25r-r7wr      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ low                 │ DOMPurify: `IN_PLACE` mode trusts attacker-controlled  │
│                     │ `nodeName` on live non-form nodes, allowing script     │
│                     │ retention and XSS via attacker-supplied DOM objects    │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=3.4.6                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ <0.0.0                                                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-x4vx-rjvf-j5p4      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ low                 │ DOMPurify: `CUSTOM_ELEMENT_HANDLING` bypasses          │
│                     │ `afterSanitizeElements` for allowed custom elements.   │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=3.4.11                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.12                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-c2j3-45gr-mqc4      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ low                 │ DOMPurify: IN_PLACE returns a force-removed rawtext    │
│                     │ root whose text carries attacker markup — pure HTML    │
│                     │ reparse executes                                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=3.4.15                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.16                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-6688-9rhm-gjv2      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ low                 │ DOMPurify: SMIL attributeName=href guard is skipped    │
│                     │ when PARSER_MEDIA_TYPE is application/xhtml+xml        │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ dompurify                                              │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ <=3.4.16                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.4.17                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-board>jspdf>dompurify                 │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-c6gr-qvv4-5v3f      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ low                 │ fast-uri vulnerable to improper path equivalence in    │
│                     │ relative reference normalization                       │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <3.1.9                                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.9                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-xhq7-xmqj-769h      │
└─────────────────────┴────────────────────────────────────────────────────────┘
┌─────────────────────┬────────────────────────────────────────────────────────┐
│ low                 │ fast-uri vulnerable to scheme injection via an         │
│                     │ unescaped first-segment colon in suffix references     │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Package             │ fast-uri                                               │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Vulnerable versions │ >=3.0.0 <3.1.9                                         │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Patched versions    │ >=3.1.9                                                │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ Paths               │ packages__chordl-voicing>ajv>fast-uri                  │
├─────────────────────┼────────────────────────────────────────────────────────┤
│ More info           │ https://github.com/advisories/GHSA-333x-w4r6-6crp      │
└─────────────────────┴────────────────────────────────────────────────────────┘
28 vulnerabilities found
Severity: 8 low | 8 moderate | 11 high | 1 critical
```

## Production audit after (exit 0)
```text
No known vulnerabilities found
```

## Open questions
None.

## Return (implementer → lead)
- **Outcome:** done
- **Commits:** receiver acknowledgement 2460638; lockfile cba5642; this return handoff committed afterwards.
- **Remaining advisories:** none.
- **Out-of-scope issues found:** none requiring changes for this task.
- **Follow-ups:** cross-family review, CI, and lead-controlled merge; dependencies require human merge approval under AGENTS.md §5a. Implementer will not watch, poll, or merge the PR.
- **For GBrain (lead to promote):** 0042 removed all 28 production findings using three within-range transitive lockfile updates, without overrides or manifest changes; frozen install and packed-consumer validation passed.
