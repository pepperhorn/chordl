# chordl-voicing package and chord-catalogue scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@pepperhorn/chordl-voicing` (format schema, IDs, spelling, hashes, canonical formatter, code checks, catalogue validator, CLI) and scaffold the public CC0 `pepperhorn/chord-catalogue` repo whose CI and release workflows run on it.

**Architecture:** A new pure-TypeScript package in the chordl pnpm monorepo, browser-safe (no `node:` imports outside `src/cli/`), depending on `@pepperhorn/chordl-core` (degree labels), `@pepperhorn/chordl-guitar` (instrument table, guitar review signals) and `@pepperhorn/chordl-voicings` (keyboard levels). The catalogue repo holds only data, docs and workflows; all logic lives in the package's CLI, pinned by version.

**Tech Stack:** TypeScript 5.7 (NodeNext, ESM), Vitest 4, pnpm 10, `ajv` (JSON Schema 2020-12), `tonal` ~6.4.3, `@noble/hashes` (sha256, browser-safe), `ulid`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-30-chord-catalogue-publishing-design.md` (steps 1–2 of "Order of work"), with the format from `docs/superpowers/specs/2026-10-29-voicing-submissions-design.md`. Read both.

## Global Constraints

- Package name `@pepperhorn/chordl-voicing`, version `0.1.0`, MIT, `type: module`, `engines.node >=20.10`, `publishConfig.access: public`, layout and scripts copied from `packages/chordl-guitar/package.json` (minus `build:data`).
- Schema IDs exactly `chordl.chord/1` and `chordl.voicing/1`.
- Repo status set exactly `live | retired | superseded`. Tier exactly `curated | community`. Licence for catalogue content exactly `CC0-1.0` (plus allow-list entries in `licences.json`, initially only `CC0-1.0` and `public-domain`).
- Voicing ID: `v_` + 26-char Crockford ULID. Revision: integer ≥ 1; rev 1 has `previous: null`, rev n has `previous: n-1`.
- Chord ID: `<root>:<quality>[/<bass>]`. Enharmonic roots are distinct IDs.
- Pitch strings are ASCII scientific pitch: letter, optional `b`/`bb`/`#`/`##`, octave (`Eb4`, `Bbb3`, `F##2`). Unicode ♭/♯ are rejected.
- Degree labels come from chordl-core `intervalToDegreeLabel` (jazz roman numerals; extensions IX/XI/XIII, never folded).
- Fretted `strings`/`fingers`/`tuning` arrays use chordl-guitar's string order (chords-db index order, thickest string first) — **not** pitch order; ukulele is reentrant.
- No personal data in the format: `authorId` is a prefixed opaque string; no display names, no emails anywhere in the repo.
- Hashes cover musical content only (notes + realization positions), never status, tier, provenance, relations, fingering or barres.
- Canonical file form: fixed key order, voicings sorted by `id` then `rev`, 2-space indent, LF, trailing newline, no BOM.
- Contextual class names alongside Tailwind (not relevant here — no UI in this plan).
- One task = one commit on branch `feat/chordl-voicing`; one PR for Part A, reviewed and merged before Part B's CI is pinned to the published version.

## Review Focus

1. **Double accidentals** (`Bbb3` in Cdim7, `F##` in G#aug) must parse, label (`bbVII`) and hash correctly — Task 3 test.
2. **Ukulele reentrant tuning**: the bass note is the lowest *pitch*, not string 0; `G4 C4 E4 A4` with `[0,0,0,3]` has bass C4 — Task 4 test.
3. **Unicode accidentals and CRLF/BOM from Windows contributors**: `E♭4` rejected with a message naming `Eb4`; CRLF/BOM files fail `format --check` with a fixable diff, and `format` fixes them — Tasks 1 and 5 tests.
4. **Empty chord file** (`voicings: []`) is invalid (schema `minItems: 1`) — Task 1 test.
5. **A status-only revision** (live → retired) keeps both hashes identical and passes the append-only check as rev+1 — Tasks 5 and 7 tests.

---

## Part A — `@pepperhorn/chordl-voicing` (chordl monorepo)

### Task 1: Package scaffold, types and JSON Schemas

**Files:**
- Create: `packages/chordl-voicing/{package.json,tsconfig.json,vitest.config.ts,README.md}`
- Create: `packages/chordl-voicing/schema/chord.schema.json`, `schema/voicing.schema.json`
- Create: `packages/chordl-voicing/src/{index.ts,types.ts,schema.ts}`
- Modify: root `package.json` scripts `build`, `test`, `test:run`, `lint` — insert `pnpm --filter @pepperhorn/chordl-voicing <script>` after `chordl-guitar`
- Test: `packages/chordl-voicing/test/schema.test.ts`, fixtures in `test/fixtures/`

**Interfaces:**
- Produces (`types.ts`): `Pitch = string`; `VoicingNote {pitch; degree}`; `FrettedRealization {kind:"fretted"; instrument: string; tuning: Pitch[]; strings: (number|null)[]; fingers: (number|null)[]; baseFret: number; barres: {fret:number; fromString:number; toString:number}[]; capo: number|null}`; `KeyboardRealization {kind:"keyboard"; hands:{left:Pitch[]; right:Pitch[]}; fingering?: {left?:number[]; right?:number[]}}`; `BowedRealization {kind:"bowed"; instrument:"violin"|"viola"|"cello"|"double-bass"; tuning: Pitch[]; stops:{string:number; pitch:Pitch; finger:number|null}[]; position:number|null}`; `Realization` union; `RepoStatus = "live"|"retired"|"superseded"`; `Tier = "curated"|"community"`; `Voicing {schema:"chordl.voicing/1"; id; rev; previous: number|null; chordId; status: RepoStatus; tier: Tier; licence: string; notes: VoicingNote[]; realization: Realization; level?: "beginner"|"emerging"|"established"; provenance:{source: string; authorId: string; createdAt: string; changeNote: string|null; basedOn: string|null; alternativeTo: string|null}; relations:{supersedes:string|null; supersededBy:string|null; duplicateOf:string|null}; externalIds?: Record<string,string>; hashes:{shape:string; pitch:string}}`; `ChordFile {schema:"chordl.chord/1"; chord:{id; symbol; root; quality; bass: string|null; aliases: string[]}; voicings: Voicing[]}`.
- Produces (`schema.ts`): `validateChordFileSchema(data: unknown): { ok: true; value: ChordFile } | { ok: false; errors: SchemaError[] }` where `SchemaError {path: string; message: string}`. Schemas also exported as `chordSchema`, `voicingSchema`, and shipped in `files` as `schema/*.json`.

- [ ] **Step 1: Write failing tests** — `schema.test.ts`:
  - `accepts the Cmaj7 guitar example` (fixture `cmaj7.json`: the spec's example — but with notes `C3 E3 G3 B3 E4`, degrees `I III V VII III`, because the spec example omits the open G3 —, and with `previous: null`, `changeNote: null`, ULID id, real-looking hashes `sha256:` + 64 hex).
  - `rejects voicings: []` → error path `/voicings`.
  - `rejects unknown realization kind "harp"`.
  - `rejects status "held"` (intake-only) and tier `"gold"`.
  - `rejects pitch "E♭4" with a message containing "Eb4"` (custom ajv keyword or post-check on pitch pattern `^[A-G](bb|b|##|#)?-?\d$`).
  - `rejects id "v_123"` (ULID pattern `^v_[0-9A-HJKMNP-TV-Z]{26}$`).
  - `rejects a displayName or email property anywhere` (`additionalProperties: false` throughout).
- [ ] **Step 2: Run** `pnpm --filter @pepperhorn/chordl-voicing test:run` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** scaffold, types, schemas (2020-12, `additionalProperties: false`, `voicing.schema.json` referenced from `chord.schema.json` by `$ref`), and `validateChordFileSchema` with ajv compiled once at module load. Dependencies: `ajv`, `tonal ~6.4.3`, `@noble/hashes`, `ulid`, `@pepperhorn/chordl-core`, `@pepperhorn/chordl-guitar`, `@pepperhorn/chordl-voicings` (all `workspace:*`).
- [ ] **Step 4: Run** tests — Expected: PASS. Also `pnpm --filter @pepperhorn/chordl-voicing lint` clean.
- [ ] **Step 5: Commit** `feat(voicing): package scaffold, types and JSON schemas`.

### Task 2: Chord IDs and quality tokens

**Files:**
- Create: `packages/chordl-voicing/src/chordId.ts`
- Test: `packages/chordl-voicing/test/chordId.test.ts`

**Interfaces:**
- Produces: `BASE_QUALITIES: Record<string, string[]>` (token → tonal interval names), `ALTERATIONS = ["b5","#5","b9","#9","#11","b13"] as const`, `parseChordId(id: string): {root: string; quality: string; bass: string|null; base: string; alterations: string[]} | null`, `formatChordId(parts: {root; quality; bass?: string|null}): string`, `chordIntervals(id: string): string[]` (throws on invalid id).

Base tokens (exact set for 0.1.0): `maj, m, dim, aug, sus2, sus4, 5, 6, m6, 69, m69, add9, madd9, maj7, 7, m7, mmaj7, m7b5, dim7, 7sus4, maj9, 9, m9, 11, m11, maj13, 13, m13, 7alt`. A quality is a base token followed by zero or more alterations in the `ALTERATIONS` order, no repeats; `7alt` takes none; alterations require a base containing a 7th. An alteration replaces the natural interval of the same degree (`b5` replaces `5P` with `5d`; `#9` adds `9A`, replacing `9M` if present). `7alt` intervals: `1P 3M 7m` (alterations unspecified by design).

- [ ] **Step 1: Write failing tests:** `C:maj7` parses, intervals `["1P","3M","5P","7M"]`; `C#:maj7` and `Db:maj7` both valid and unequal; `C:7#9b13` → `["1P","3M","5P","7m","9A","13m"]`; `C:7b13#9` → null (order); `C:7alt` valid; `C:7alt#9` → null; `C:zbq9` → null; `H:maj` → null; `C:maj7/E` bass `E`; `C:maj#5` → null (no 7th); `formatChordId(parseChordId(x)!) === x` for every valid case.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(voicing): chord ids and quality tokens`.

### Task 3: Pitches and degree labelling

**Files:**
- Create: `packages/chordl-voicing/src/pitch.ts`
- Test: `packages/chordl-voicing/test/pitch.test.ts`

**Interfaces:**
- Consumes: `chordIntervals` (Task 2); `intervalToDegreeLabel` from `@pepperhorn/chordl-core`.
- Produces: `parsePitch(p: string): {midi: number; pc: number; letter: string; alter: number; octave: number} | null` (tonal `Note`); `labelNotes(chordId: string, pitches: string[]): LabelledNote[]` where `LabelledNote {pitch; degree: string; inChord: boolean; misspelled: boolean}`.

Rule: a pitch matches a chord interval when its interval from the root (tonal `Interval.distance`, simplified, letter-aware) equals the chord interval's simple form; degree = `intervalToDegreeLabel` of the **chord's** interval (so `9M` → `IX`). Same pitch class as a chord tone but different letter → `misspelled: true`, `inChord: true`. Not in chord → `inChord: false`, degree from the simple interval with 2/4/6 written as IX/XI/XIII (jazz extension naming), quality accidental as usual.

- [ ] **Step 1: Write failing tests:** `Bb:7#5` with `Bb2 D3 F#3 Ab3` → degrees `I III #V bVII`, all inChord; `C:maj7` `E4` → `III`; `C:9` `D4` → `IX`; `C:7` `D4` → `IX`, inChord false; `C:m` `D#4` → misspelled true; `C:dim7` `Bbb3` → `bbVII`, inChord true; `parsePitch("E♭4")` → null; `parsePitch("F##2")!.midi === 43`.
- [ ] **Step 2–4:** run FAIL → implement → run PASS.
- [ ] **Step 5: Commit** `feat(voicing): pitch parsing and degree labels`.

### Task 4: Sounding pitches from realizations

**Files:**
- Create: `packages/chordl-voicing/src/realization.ts`, `src/instruments.ts`
- Test: `packages/chordl-voicing/test/realization.test.ts`

**Interfaces:**
- Consumes: `INSTRUMENTS` from `@pepperhorn/chordl-guitar` (fretted instrument ids, standard tunings); `parsePitch` (Task 3).
- Produces: `BOWED_INSTRUMENTS: Record<"violin"|"viola"|"cello"|"double-bass", {tuning: string[]}>` = violin `G3 D4 A4 E5`, viola `C3 G3 D4 A4`, cello `C2 G2 D3 A3`, double-bass `E1 A1 D2 G2`; `soundingMidi(r: Realization): number[]` (in realization order, muted strings omitted, capo added to every fretted string including open); `notesMatchRealization(v: Voicing): Finding[]` where `Finding {code: string; severity: "hard"|"flag"|"fact"; message: string; data?: Record<string, unknown>}` — emits `hard:notes-mismatch` when the sorted MIDI of `notes` ≠ sorted `soundingMidi`, `hard:unknown-instrument` for a fretted instrument not in chordl-guitar's table, `hard:stop-below-open` when a bowed stop is lower than its open string, `hard:tuning-length` when `strings.length !== tuning.length`.

- [ ] **Step 1: Write failing tests:** guitar Cmaj7 `x32000` → `[48,52,55,59,64]` (C3 E3 G3 B3 E4); ukulele `G4 C4 E4 A4`, `[0,0,0,3]` → contains 60 and the minimum is 60 (Review Focus 2); capo 2 adds 2 to every sounding string; keyboard hands concatenated; cello stop `{string:0,pitch:"E2"}` ok, `{string:1,pitch:"E2"}` → `stop-below-open`; notes `C3 E3 G3 B3` vs x32000 → `notes-mismatch`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(voicing): sounding pitches per realization kind`.

### Task 5: Hashes and canonical formatter

**Files:**
- Create: `packages/chordl-voicing/src/hash.ts`, `src/canonical.ts`, `docs/CANONICAL.md` (inside the package; shipped in `files`)
- Test: `packages/chordl-voicing/test/hash.test.ts`, `test/canonical.test.ts`

**Interfaces:**
- Consumes: `soundingMidi` (Task 4).
- Produces: `shapeHash(r: Realization): string` and `pitchHash(r: Realization): string`, both `"sha256:" + hex`; `withHashes(v: Voicing): Voicing`; `formatChordFile(file: ChordFile): string`; `isCanonical(text: string): {ok: boolean; expected: string}`.

Shape canonical string (document verbatim in `CANONICAL.md`, prefix with version tag `shape/1`): fretted `shape/1|fretted|<instrument>|<tuning joined ",">|capo=<n or 0>|<absolute frets, "x" for null, joined ",">` where absolute fret = `0` for open, else `baseFret-relative → absolute` per chordl-guitar's rule (`f + baseFret - 1`); keyboard `shape/1|keyboard|L=<midi sorted>|R=<midi sorted>`; bowed `shape/1|bowed|<instrument>|<tuning>|<string:midi pairs sorted by string>`. Pitch canonical: `pitch/1|<sorted midi joined ",">`. Key order for `formatChordFile` = the property order in Task 1's `types.ts` interfaces; unknown keys are a schema error, not reordered.

- [ ] **Step 1: Write failing tests:** changing `fingers` or `barres` leaves `shapeHash` unchanged; changing a fret changes it; `Eb4` vs `D#4` keyboard voicings → same `pitchHash`, different notes; status/tier/provenance changes leave both hashes unchanged (Review Focus 5); `formatChordFile` of a key-shuffled object equals that of the original; voicings sorted by id then rev; output ends in `"\n"`, uses LF; `isCanonical` of CRLF text or text with a BOM → `ok: false` and `expected` is the LF/no-BOM form (Review Focus 3).
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(voicing): content hashes and canonical formatting`.

### Task 6: Code checks

**Files:**
- Create: `packages/chordl-voicing/src/checks.ts`
- Test: `packages/chordl-voicing/test/checks.test.ts`

**Interfaces:**
- Consumes: `labelNotes` (3), `soundingMidi`, `notesMatchRealization` (4), `chordIntervals` (2); `reviewGuitarPosition`, `analyzeChordTones` from `@pepperhorn/chordl-guitar` (for `instrument: "guitar"` only); `levelForVoicing` from `@pepperhorn/chordl-voicings` (keyboard level fact).
- Produces: `checkVoicing(v: Voicing): CheckResult` where `CheckResult {hard: Finding[]; flags: Finding[]; facts: Finding[]}`.

Codes (exact strings): hard — `notes-mismatch`, `unknown-instrument`, `stop-below-open`, `tuning-length`, `missing-third` (chord has a 3rd/sus and none sounds; skipped for `5`, `sus2`, `sus4`, `7sus4`), `wrong-note` (a note that is misspelled per `labelNotes`, or whose `degree` field ≠ the computed label), `too-many-fingers` (fretted: distinct non-null fingers > 4, or > 4 fretted strings with no barre covering them), `keyboard-hand-span` (any hand > 14 semitones). flags — `missing-seventh`, `missing-extension:<degree>`, `unwritten-addition:<degree>`, `root-omitted`, `bass-mismatch` (lowest pitch pc ≠ chord bass, or root when no bass), `interior-mute`, plus every chordl-guitar `ReasonCode` for guitar voicings prefixed `guitar:` (e.g. `guitar:span-4`, `guitar:low-interval`). facts — `movable` (fretted, no open strings), `level:<beginner|emerging|established>` (guitar via chordl-guitar `levelForFacts`/`positionFacts`, keyboard via `levelForVoicing`). Bowed: only `notes-mismatch`, `stop-below-open`, spelling codes (per spec call 5).

- [ ] **Step 1: Write failing tests:** Cmaj7 x32000 → no hard, fact `level:beginner`; C7 with a D → flag `unwritten-addition:IX`; Cmaj7 without E → hard `missing-third`; Csus4 without 3rd → no `missing-third`; a five-finger fretted grip → hard `too-many-fingers`; keyboard right hand C4–E5 (16 semitones) → hard `keyboard-hand-span`; rootless Cmaj9 keyboard → flag `root-omitted`, no hard; cello double stop → only bowed codes; note with `degree: "3"` instead of `"III"` → hard `wrong-note`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(voicing): deterministic code checks`.

### Task 7: Catalogue validator

**Files:**
- Create: `packages/chordl-voicing/src/catalogue.ts`
- Test: `packages/chordl-voicing/test/catalogue.test.ts`

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: `chordFilePath(chordId: string): string` → `chords/<root>/<encoded>.json` with encoding `#`→`s`, `/`→`_over_`, `:`→`__` (e.g. `chords/C#/Cs__maj7.json`, `chords/C/C__maj7_over_E.json`); `validateCatalogue(head: Map<string,string>, base?: Map<string,string>, opts?: {licences: string[]}): CatalogueReport` where `CatalogueReport {ok: boolean; errors: {path: string; code: string; message: string}[]; warnings: {path; code; message}[]}`.

Error codes: `schema`, `not-canonical`, `path-mismatch`, `hash-mismatch`, `check:<hard code>`, `duplicate-shape` (same `shapeHash` on a different voicing `id`, latest revs only, across all files), `rev-chain` (revs per id not 1..n contiguous, or `previous` wrong), `id-reused` (same id in two files), `modified-history` (an `id@rev` present in base differs in head, compared by canonical JSON), `removed-history` (an `id@rev` in base missing in head), `licence` (not in allow-list). Warnings: `check:<flag code>`, `same-pitch` (same `pitchHash`, different id).

- [ ] **Step 1: Write failing tests**, one per error code using small in-memory maps; plus: a status-only rev 2 (live→retired, same hashes) passes against a base containing rev 1 (Review Focus 5); an empty head map is `ok: true`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(voicing): catalogue validator with append-only history`.

### Task 8: CLI

**Files:**
- Create: `packages/chordl-voicing/src/cli/{index.ts,run.ts}`; add `"bin": {"chordl-voicing": "./dist/cli/index.js"}`
- Test: `packages/chordl-voicing/test/cli.test.ts`

**Interfaces:**
- Consumes: Tasks 1–7.
- Produces: `run(argv: string[], io: {cwd: string; stdout(s: string): void; stderr(s: string): void}): Promise<number>` (exit code). Commands:
  - `new --chord <id> --instrument <id> (--frets <code>|--notes "<pitches>") --author <prefixed id> [--tier community]` → creates or updates the chord file at `chordFilePath`, new ULID, rev 1, computed notes+degrees (fretted from tuning), hashes, `licence: "CC0-1.0"`, `status: "live"`, canonical write.
  - `format [--check] [paths…]` → rewrite canonically, or exit 1 with a unified-ish diff listing.
  - `validate [--base <dir>] [--licences <file>]` → run `validateCatalogue` over `chords/**.json` in cwd vs `<dir>`; print errors/warnings; exit 1 on errors.
  - `bundle --out <dir> --version <vYYYY.MM.N>` → writes `manifest.json` (`{version, generatedAt, chordlVoicing: <pkg version>, counts:{chords, voicings, byInstrument, byTier}, voicings: [{id, rev, chordId, shape, pitch}]}` latest revs + all revs listed), `catalogue.json` (all chord files), `by-instrument/<instrument>.json`.
- [ ] **Step 1: Write failing tests** against a temp dir: `new --frets x32000` for `C:maj7` guitar produces a file that `validate` accepts; running `new` again with the same frets → `validate` fails `duplicate-shape`; `format --check` on a hand-mangled file → exit 1, `format` then `--check` → exit 0; `bundle` manifest counts match.
- [ ] **Step 2–4:** FAIL → implement (only `src/cli/` may import `node:` modules) → PASS.
- [ ] **Step 5: Commit** `feat(voicing): chordl-voicing CLI`.

### Task 9: Docs, full-workspace verification, PR

**Files:**
- Modify: `packages/chordl-voicing/README.md` (what it is, format summary, CLI usage, link to `docs/CANONICAL.md`), `CHANGELOG.md` (root) entry for `chordl-voicing@0.1.0`
- [ ] **Step 1:** `pnpm install && pnpm build && pnpm lint && pnpm test:run` — Expected: all packages pass, including chordl-voicing.
- [ ] **Step 2:** `cd packages/chordl-voicing && npm pack --dry-run` — Expected: lists `dist/`, `schema/`, `docs/CANONICAL.md`, no `test/`.
- [ ] **Step 3: Commit** `docs(voicing): README and changelog`; push branch; open PR; review; merge.
- [ ] **Step 4 (owner action):** first publish — `cd packages/chordl-voicing && npm publish --access public` with the owner approving npm's browser prompt; verify `npm view @pepperhorn/chordl-voicing version` → `0.1.0` and a clean `npm i @pepperhorn/chordl-voicing@0.1.0` in a temp dir resolves its workspace deps from npm (chordl-core, chordl-guitar, chordl-voicings must be published at versions satisfying the ranges `pnpm pack` writes — check before publishing).
- [ ] **Step 5 (owner action):** register `pepperhorn/chordl` + `release.yml` as Trusted Publisher for the package on npmjs.com; future releases go through the tag workflow.

---

## Part B — `pepperhorn/chord-catalogue` repo

Work in `/home/shaun/chord-catalogue` (new directory, `git init -b main`).

### Task 10: Repo content scaffold

**Files:**
- Create: `LICENSE` (official CC0-1.0 legal code text), `README.md` (what, how to consume: pin a release tag / npm `@pepperhorn/chord-catalogue` / jsDelivr URL pattern; tiers; status; no personal data), `CONTRIBUTING.md` (four routes from the spec; `npx @pepperhorn/chordl-voicing new`; DCO sign-off `git commit -s`; everything enters as community; append-only rules), `CODEOWNERS` (`* @pepperhorn/catalogue-maintainers` placeholder team), `licences.json` (`["CC0-1.0","public-domain"]`), `chords/.gitkeep`, `.gitattributes` (`*.json text eol=lf`), `.github/pull_request_template.md` (summary, source, and a fenced ```` ```review ```` YAML block: `decision: approve|request-changes|reject`, `tier: community|curated`, `overrides: {difficulty: , handPosition: , sound: , idiom: , teachingValue: }`), `package.json` (`name: @pepperhorn/chord-catalogue`, `version: 0.0.0` set at release, `license: CC0-1.0`, `files: ["dist"]`, `devDependencies: {"@pepperhorn/chordl-voicing": "0.1.0"}` exact pin, scripts `validate`, `format`, `bundle` calling the CLI).
- [ ] **Step 1:** `npm install && npx chordl-voicing validate` — Expected: exit 0 on the empty catalogue.
- [ ] **Step 2:** add a throwaway `chords/C/C__maj7.json` via `npx chordl-voicing new --chord C:maj7 --instrument guitar --frets x32000 --author system:seed-test`, run `validate` → exit 0; delete it (repo ships empty).
- [ ] **Step 3: Commit** `chore: scaffold CC0 chord catalogue` (signed off with `-s`).

### Task 11: Validate workflow

**Files:**
- Create: `.github/workflows/validate.yml`, `scripts/check-dco.sh`
- Workflow: `on: pull_request` (never `pull_request_target`), `permissions: contents: read`, no secrets. Steps: checkout head with `fetch-depth: 0`; `git worktree add ../base ${{ github.event.pull_request.base.sha }}`; `npm ci`; `npx chordl-voicing format --check`; `npx chordl-voicing validate --base ../base --licences licences.json`; `scripts/check-dco.sh <base> <head>` fails if any commit in range lacks `Signed-off-by:` matching its author email. Also `on: push` to `main` running validate without `--base`.
- [ ] **Step 1:** run each command locally against a branch with a good fixture and one with a bad fixture (edited existing `id@rev`) — Expected: good passes, bad fails `modified-history`; a commit without `-s` fails `check-dco.sh`.
- [ ] **Step 2: Commit** `ci: validate catalogue PRs and DCO`.

### Task 12: Release workflow

**Files:**
- Create: `.github/workflows/release.yml`, `scripts/next-version.mjs`
- Workflow: `on: schedule: cron "0 6 * * 1"` and `workflow_dispatch` with input `dry_run` (default `true` until the first real release is approved). Skip when `main` has no commits since the latest `v*` tag. `next-version.mjs` → `vYYYY.MM.N` (N = 1 + count of existing tags for that month, starting at 0). Steps: validate; `npx chordl-voicing bundle --out dist --version $V`; set `package.json` version to `YYYY.MM.N` (npm semver form); if not dry run: `git tag $V && git push origin $V`, `gh release create $V dist/manifest.json dist/catalogue.json --generate-notes`, `npm publish --provenance --access public` (job `permissions: id-token: write, contents: write`). Display names: none — bundles carry `authorId` only until intakes exist (spec: names resolved at release time; out of scope here).
- [ ] **Step 1:** `node scripts/next-version.mjs` with no tags → `v2026.10.0` (or current month); with a fake tag `v2026.10.0` → `v2026.10.1`.
- [ ] **Step 2:** after Task 13, trigger `workflow_dispatch` with `dry_run: true` — Expected: green run, `dist/` artefacts uploaded as workflow artefact, no tag, no publish.
- [ ] **Step 3: Commit** `ci: scheduled calver release with dry run`.

### Task 13: Publish the repo (owner-confirmed, outward-facing)

- [ ] **Step 1 (confirm with owner first):** `gh repo create pepperhorn/chord-catalogue --public --source . --push --description "Open CC0 chord voicing catalogue (keyboard, fretted, bowed) in the chordl.voicing format"`.
- [ ] **Step 2:** branch protection on `main`: require `validate` check, require PR review, disallow force-push (`gh api` on `repos/pepperhorn/chord-catalogue/branches/main/protection`).
- [ ] **Step 3:** create the `catalogue-maintainers` team (or replace the CODEOWNERS placeholder with real handles the owner names).
- [ ] **Step 4:** open a test PR adding one voicing via the CLI (signed off) — Expected: `validate` green; close it unmerged. Run the release dry run (Task 12 Step 2).
- [ ] **Step 5 (owner action, before the first real release):** create the npm package `@pepperhorn/chord-catalogue` (first publish manually or via token) and register the repo's `release.yml` as Trusted Publisher; then flip `dry_run` default to `false`.
