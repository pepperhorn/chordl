# Chord catalogue: open repo and publishing pipeline

**Date:** 2026-10-30
**Status:** design agreed in conversation; ready for a plan
**Owner decisions 2026-10-30:** CC0; display names never committed; server side written as Directus v12-ready extensions in `ph-apps-extensions`, deployed to current ph-apps.
**Builds on:** `2026-10-29-voicing-submissions-design.md` (the `chordl.chord/1` / `chordl.voicing/1` format, IDs, hashes, code checks, AI scorecard).
**Supersedes in that design:** "staff review in the stock Directus admin" — the final human gate is now the GitHub pull request (below).

## Intent

One public, open-data GitHub repo holds every published chord voicing — keyboard, fretted and bowed — in the shared JSON format. It is the published record. chordl.app, chords.creativeranges.org and be.creativeranges.org each import from it and take what they want (everything, or a filtered subset). Third parties can use it and contribute to it.

The hard part isn't storage, it's the **publish process**: getting a voicing from a user's submission (or a third party's pull request) into the repo safely, reviewed, attributed, and released in versions consumers can pin.

## Goals

1. A public repo, `pepperhorn/chord-catalogue`, licensed **CC0**, with a fixed file layout and canonical formatting so diffs are clean.
2. **CI** that enforces the format and the musical checks on every pull request, and makes history append-only.
3. A **promotion path** from private intake stores (ph-apps for chordl.app, crf-admin for the CRF sites) into the repo as one pull request per voicing.
4. **Third-party routes**: direct PRs, partner intakes, bulk datasets — all ending at the same checks, AI review and maintainer merge.
5. **Releases**: tagged, versioned, published as a GitHub release, an npm data package and CDN URLs.
6. **Consumers** pin a release, filter, and import; new releases arrive as a bump PR in each consumer.

## Non-goals

- The editor overlay and intake-side review (submissions design).
- The Directus v12 unified catalogue service. Intakes stay where they are (ph-apps, crf-admin); a v12 service, if built, becomes one more intake/editor in front of this repo, not a replacement for it.
- Voting, ranking or popularity in the repo.
- Hosting an API. The repo plus release artefacts are the distribution.

## Anti-goals

- **Personal data in the repo.** Prefixed opaque IDs and opt-in display names only. Never emails.
- **Editing published history.** An existing `id@rev` is never modified or deleted.
- **Running contributor code with secrets.** Fork PRs never see API keys.
- **Two review gates.** Staff do not review once in an intake and again in GitHub; the PR is the one human gate.

## The flow

```
 app (chordl.app / chords.creativeranges.org / be.creativeranges.org)
   │ submit (with CC0 consent, credit choice)
   ▼
 INTAKE (private: ph-apps or crf-admin)
   code checks → AI scorecard → held / live-in-app / flagged
   │ passes (or staff-cleared)
   ▼
 PROMOTION BOT ── one PR per voicing ──▶ chord-catalogue (public)
                                          CI + AI review comment
                                          maintainer review → merge
                                          │ scheduled
                                          ▼
                                        RELEASE vYYYY.MM.N
                                          (git tag, GitHub release, npm, jsDelivr)
                                          │
                         each consumer: bump PR → pin → filter → import
```

### 1. Intake (private)

Each app family keeps its own private store. Spam, personal data, wrong-note attempts and held submissions never leave it. Code checks and the AI scorecard run here first (submissions design). While a submission waits, it's live only in the app it came from.

### 2. Consent at submit

The submit form requires agreement to publish under **CC0**, and offers a choice: credited by display name, or anonymous. No CC0 agreement → never promoted (it can still live in the originating app if that app allows it).

### 3. Promotion

A GitHub App ("catalogue bot") opens **one PR per voicing** when a submission passes intake review or staff clear a flagged one. The PR:

- adds or updates exactly one chord file
- body carries: AI scorecard and code facts, source voicing (`basedOn` / `alternativeTo`), prefixed author ID, intake record link (private link, no personal data), tier proposed (`community`)
- labels: `source:<intake>`, `instrument:<id>`, `tier:community`

Bulk imports (the initial CRF seeding, generator output, third-party datasets) go as batched PRs, one per chord family or per N files (builder's call).

### 4. CI (required checks)

Every PR, any source:

- schema valid (`chordl-voicing` JSON Schema)
- hashes recomputed and equal to the stored ones
- code checks pass (no hard fails; flags are reported, not blocking)
- no duplicate `shape` hash against the rest of the repo (same `pitch` hash reported, not blocking)
- canonical formatting (fixed key order, voicings sorted by ID, 2-space JSON, trailing newline) — CI fails with a diff; the CLI fixes it
- **append-only**: compared with the base branch, no existing `id@rev` changed or removed; new revisions must be `rev + 1` with `previous` set; IDs never reused
- licence: every voicing is CC0, or for imports a recorded licence on the allow-list

CI runs `chordl-voicing` from npm at a pinned version; bumping it is a normal PR.

### 5. AI review on PRs

The AI review must not run in GitHub Actions on fork PRs (secrets). The catalogue bot (GitHub App) receives PR webhooks and calls the existing review service (ph-apps), which **reads the diff only** — never checks out or executes PR code — and posts the scorecard as a PR comment. Same prompt, same scorecard as intake. For bot-opened PRs whose intake already reviewed the same `id@rev`, the stored scorecard is reused, not recomputed.

### 6. Maintainer review — the one human gate

- Maintainers from PepperHorn and CRF; optional per-instrument owners in `CODEOWNERS`.
- A PR review template captures the decision and per-scorecard-item overrides in a fixed, machine-readable block.
- Merging may promote the tier: `tier:curated` label at merge → the voicing's `tier` is `curated`. Third-party voicings always enter as `community`; only maintainers promote.
- On merge/close, the bot writes the decision and overrides back to the intake record (for the improvement loop and so the submitter sees "accepted").

### 7. Tiers

Voicings carry `tier: "curated" | "community"`. Consumers filter on it. Promotion from community to curated is a new revision made by a maintainer PR.

### 8. Releases

- Merges collect on `main`. A scheduled workflow (weekly, plus manual dispatch) cuts a release when `main` has changed.
- Version: calendar versioning `vYYYY.MM.N`.
- Each release produces: git tag; GitHub release with generated notes (added, new revisions, superseded, retired, by instrument and tier); `manifest.json` (every `id@rev` with hashes, `chordl-voicing` version, counts); a bundled single-file JSON plus per-instrument bundles; npm package `@pepperhorn/chord-catalogue`; jsDelivr URLs come free from the tag.
- Publishing to npm uses trusted publishing from the workflow. (Note: trusted publishing for chordl packages failed with E404 on 2026-10-28; set it up and test it before the first release.)

### 9. Consumers

Each app pins a release and imports at build time or by sync job, filtering by instrument, level and tier, and maps voicings into its own store keeping `id@rev`. A new release opens a bump PR in each consumer repo (Renovate/Dependabot on the npm package, or a small workflow). chordl.app, chords.creativeranges.org and be.creativeranges.org are the first three consumers; their import code is each app's own work, not this repo's.

### 10. Withdrawal and personal-data removal

Nothing is deleted. A bad voicing gets a new revision with status `retired` or `superseded`; consumers drop it on their next import. Display names are **never committed** (owner decision 2026-10-30). The repo holds only prefixed opaque IDs. Release builds resolve opt-in display names from each intake's records and bake them into the release bundles only. A removal request applies from the next release; earlier published npm versions keep the name. The opaque ID stays.

## Builder-check calls (2026-10-30, mine — check these)

1. **Status and tier in the repo are part of the published revision.** The repo has its own small status set: `live`, `retired`, `superseded`. Intake-only states (`draft`, `submitted`, `held`, `rejected`, `withdrawn`) never appear in the repo. Changing a voicing's status or tier in the repo is a new revision (`rev + 1`), so append-only stays absolute. Hashes cover musical content only (notes + realization), never status, tier, provenance or relations, so a status-only revision keeps the same hashes. This replaces the submissions design's "status never creates a revision", which now applies to intake only. Consumers holding an `id@rev` look up the latest revision of that `id` to learn whether it was retired.
2. **A chord file keeps every revision.** Each revision is its own entry in `voicings`, sorted by `id` then `rev`, carrying `rev`, `previous` (`null` for rev 1), `changeNote`, `authorId`, `createdAt`. Consumers that want the current set take the highest `rev` per `id`.
3. **CC0 only, for now.** `licences.json` starts as CC0 and public domain only. Imports under any other licence (including MIT, e.g. chords-db-derived shapes) are out until a decision is made in the seeding plan. No per-voicing attribution machinery is built.
4. **`chordl-voicing` depends on chordl-core and chordl-guitar; rules are not moved.** chordl-guitar and chordl-core must not depend on chordl-voicing (no cycles). Chord IDs are validated against `chordl-voicing`'s own published quality-token list (strict: unknown tokens fail), not by trusting chordl-core's lenient parser. The known parser bugs (`C7alt` → `C7`, nonsense accepted) don't block plan 1 (the repo starts empty); they are fixed as separate PRs before seeding.
5. **Checks by kind.** Fretted: full code checks. Keyboard: spelling, bass, unwritten-addition, hand span per hand, using chordl-voicings' experience rules. Bowed: schema, spelling, and notes-vs-realization agreement only; a minimal bowed instrument table (violin G3 D4 A4 E5, cello C2 G2 D3 A3) lives in `chordl-voicing`. Flags never block; only hard fails do.
6. **Hashes.** `shape` = instrument + tuning + capo + the sounding positions (fretted: absolute fret or mute per string; keyboard: pitches per hand; bowed: string + pitch per stop). Fingering, finger numbers and barres are excluded: a better fingering of the same grip is a new revision of the same voicing, not a new voicing. `pitch` = sorted MIDI numbers of the sounding notes, so enharmonic spellings hash the same ("same sound"). Canonicalisation is specified in the package docs and versioned; changing it is a breaking change.
7. **First npm publish of `@pepperhorn/chordl-voicing` is manual** (npm login with browser approval by the owner, as on 2026-10-28), then trusted publishing is configured on the existing package and tested before any further release. The catalogue validate workflow pins that published version.

## Third-party routes

All end at the same CI, AI review and maintainer merge, and all enter as `community`.

1. **Direct PR (GitHub users).** A CLI, `npx chordl-voicing new` (in the `chordl-voicing` package), creates the ID, computes hashes and formats the file. Author ID `gh:<numeric GitHub id>`. Commits require a DCO sign-off asserting the right to contribute under CC0.
2. **Partner intakes.** Other apps register a namespace (`acme:user:42`) and use the bot's API to open PRs. A short partner agreement makes them responsible for spam, consent and CC0 agreement. Rate-limited. A clean record earns a `trusted` label that speeds review but never skips it.
3. **Bulk datasets.** Batched PRs with `source: import:<dataset>@<version>` and the original licence recorded; CI rejects licences not on the allow-list.
4. **No GitHub.** The hosted editor on chordl.app (PepperHorn intake) or the CRF sites.

## Repo layout (agreed shape; exact names builder's call)

```
chord-catalogue/
  LICENSE                      CC0-1.0
  README.md                    what it is, how to consume, how to contribute
  CONTRIBUTING.md              the four routes, DCO, format, review
  CODEOWNERS
  chords/<root>/<chord-id>.json   one file per chord (filename-safe encoding of the ID)
  licences.json                import licence allow-list
  .github/workflows/           validate.yml, release.yml
  .github/pull_request_template.md, review template
```

Release artefacts (manifest, bundles) are built in the release workflow and attached/published, not committed.

## Initial seeding

The first content is an import of CRF's existing voicings (≈2,947 `chord_data` records) and chordl's generated library, as batched PRs with `source: import:crf@<date>` / `system:chordl-guitar@<version>`, tier `curated` for CRF staff-reviewed records, `community` otherwise. CRF `chord_data` UUIDs are kept as an `externalIds` entry so CRF content links survive. Seeding is a separate plan from the repo scaffold.

## Order of work

1. `@pepperhorn/chordl-voicing` package in the chordl monorepo: schema, types, validators, hashes, canonical formatter, code checks, CLI. (Needed by everything else.)
2. `chord-catalogue` repo scaffold: licence, layout, docs, templates, validate workflow, release workflow (dry run).
3. Catalogue bot (GitHub App) + review-service hook: PR comments, decision write-back.
4. Intake promotion from ph-apps (and later crf-admin).
5. Seeding from CRF and chordl.
6. Consumer imports in each app (each app's own work).

The editor overlay (submissions design) can proceed in parallel after step 1.

## Left to the builder

- File naming encoding for chord IDs, bundle shapes, release-notes format.
- Batch sizes for bulk PRs.
- Whether the bot is one GitHub App or App + small service; where the service runs (ph-apps extension is the default).
- Exact review-template block format, as long as it's machine-readable.
