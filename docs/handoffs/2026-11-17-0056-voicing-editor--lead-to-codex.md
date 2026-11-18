# Handoff: 0056 — Voicing editor package + voicing render/convert helpers (crf-staff lead → codex)

- **Date:** 2026-11-17
- **Type:** dispatch
- **Ledger:** chordl 0056 · **Spec:** this repo `docs/superpowers/specs/2026-10-29-voicing-submissions-design.md` (editor + format parts only) and crf-staff [spec 0030](https://github.com/pepperhorn/crf-staff/blob/main/docs/specs/0030-chord-voicings-audition-builder.md) · **Plan:** crf-staff [plan 0030](https://github.com/pepperhorn/crf-staff/blob/main/docs/plans/0030-chord-voicings-audition-builder.md) task T1
- **Branch:** orch/0056-voicing-editor · **Worktree:** created by T3
- **PR:** —
- **Base commit:** 56f28c2 (plus this docs commit)
- **Port (if running a server):** 5760
- **Status:** open

## Goal
Build what crf-staff (and later becreative and the chords site) needs to let a teacher audition the alternative shapes of a chord and build their own:
1. a new **`@pepperhorn/chordl-voicing-editor`** package: a fretted builder, a keyboard builder, and an overlay shell with live checks, emitting a `chordl.voicing/1` object;
2. **`requestForVoicing`** in chordl-cards, so a stored voicing renders and plays in `ChordCardPlayer`;
3. **`alternativesFor`** in chordl-cards, returning chordl's known shapes as `chordl.voicing/1` with level badges;
4. a **level function** in chordl-voicing.

Everything is built and tested in this monorepo. **Do not publish to npm.** The owner publishes after merge.

## Context you need
- The voicing format already exists in `packages/chordl-voicing` (0.2.0). Read the voicing-submissions spec sections "The shared voicing format", "Review: code facts…" (checks reuse `chordl-guitar/src/voicingReview.ts` + `experience.ts` and `chordl-voicings/src/experience.ts`; **don't fork the rules**), and "Porting the builder".
- **Fretted builder source to port:** github.com/pepperhorn/frames `src/components/ChordWorkbench.tsx` (public). Port the interaction, not the state shape. The builder edits a `fretted` realization and renders through chordl's existing guitar rendering. No frames styling/export/scale/tab modes.
- **Keyboard builder:** new. Tap keys over a 2–3 octave range to toggle notes; optional hand assignment (left/right) for an "exploded / two hands" mode; a live spelling against the chord.
- **Existing APIs to build on:**
  - chordl-cards: `requestFor`, `positionsFor(chord, face, theme, {limit})` → `FacePosition[]`, `inversionsFor`, `playbackFor`, `ChordCardPlayer` with its `request` prop, `KeyboardFaceRequest` / `GuitarFaceRequest`;
  - chordl-voicings: `generateVariants`, `getAlternativeVoicings`, `levelForVoicing`, `selectVoicingsForExperience`;
  - chordl-guitar: `lookupGuitarChord`, `dbPositionToChord`, `positionToMidi`, voicingReview/experience;
  - chordl-core: `identifyChords`, `matchesChordName`.
- **crf-staff faces:** `keyboard`, `keyboard-hands` (exploded triads, two hands), `guitar`, `guitar-top3` (top three strings), `ukulele`, `bass4`. The helpers take a `CardFace`.

## Scope
- **In:**
  1. **chordl-voicing:**
     - `levelOf(voicing): "beginner"|"emerging"|"established"`, a wrapper over the existing guitar/keyboard experience rules (no new thresholds);
     - export it;
     - extend `checkVoicing` if guitar-top3/bass4/ukulele aren't covered;
     - tests.
  2. **chordl-cards:**
     - `requestForVoicing(chord, voicing, face, theme): FaceRequest` (throws on a kind/face mismatch);
     - `voicingFromRequest(chord, request, face)` (FaceRequest → `chordl.voicing/1`);
     - `alternativesFor(chord, face, theme, {limit=8}) → { voicing, label, kind, level, isStandard }[]`: the standard first, then `positionsFor` (fretted) or keyboard variants + inversions, deduped by `shapeHash`;
     - tests, including a round trip `requestForVoicing(voicingFromRequest(requestFor(...)))` rendering identically for all six faces on C, G, Am, F, D7, Em.
  3. **New package `packages/chordl-voicing-editor`** (React, peer react ≥18, depends on chordl-voicing / chordl-cards / chordl-react / chordl-guitar):
     - `FrettedVoicingBuilder` (instrument from face; tap a fret to place/remove, tap above the nut to cycle open/muted, base-fret stepper, barre, optional finger numbers; for guitar-top3 only strings 1–3 are editable);
     - `KeyboardVoicingBuilder` (hand toggle when `face === 'keyboard-hands'`);
     - `VoicingChecks` (notes, degrees, hard fails vs warnings, level, polite live region);
     - `VoicingEditor`, which composes "Tweak this shape, or start fresh?" → builder + checks + Play, and emits `onUse(voicing)` / `onCancel()`, with `onUse` disabled on a hard fail.
     - Props carry `chord`, `face`, an optional `initial` voicing (tweak → `provenance.basedOn`) and a theme.
     - **Embedding rules** (spec Constraints): scoped styles (an importable `editor.css` with a prefixed class namespace and CSS custom properties for colours, so hosts theme via tokens), unique control IDs, no document-level key listeners, no form submission, every fret/key a labelled button (≥40 px targets), keyboard horizontally scrollable inside its own container, works at 360 px.
     - Add it to the root build/test/lint chains, plus a README with a usage example.
- **Out:**
  - AI review, plain-English input, submission adapter/storage, CC0/credit UI, bowed builder, editable tunings;
  - publishing;
  - any change to how `requestFor` picks the default shape.
- **Files you own:** `packages/chordl-voicing-editor/**`; additive changes in `packages/chordl-voicing/src/**` + tests, `packages/chordl-cards/src/**` + tests; root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` if needed; your handoff files.
- **Do not touch:** other packages' public behaviour, the ledger, other docs.

## Acceptance criteria
- [ ] `levelOf` agrees with the existing experience rules on their existing fixtures.
- [ ] `requestForVoicing` round trip: for all six faces × {C, G, Am, F, D7, Em} the rendered SVG for `requestForVoicing(voicingFromRequest(requestFor(c,f)))` matches `requestFor(c,f)`.
- [ ] `alternativesFor` returns the standard first, deduped, each with a level; ≥2 options for G guitar.
- [ ] Builders: dom tests build Cmaj7 (x32000) on guitar and C-E-G-B on keyboard; a wrong note shows a hard fail and blocks Use; an omitted fifth only warns; hand assignment works for keyboard-hands; guitar-top3 locks strings 4–6.
- [ ] A real-browser pass (Playwright/Chromium) of a small demo page at 360 px: screenshots, and no console errors (the spec says mocked wrappers have certified inert code before).
- [ ] Full verify green.

## Verify with
```bash
pnpm install --frozen-lockfile=false && pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
- Owner decisions (2026-11-17, crf-staff spec 0030):
  - the builder lives here;
  - levels are chordl's computed beginner/emerging/established (not the Directus 0–3 teaching ratings);
  - crf-staff stores the voicing JSON on its block row and in a shared for-review list.
- Musical facts are computed in code, never guessed. Reuse `voicingReview.ts`/`experience.ts`.
- GBrain: not consulted by lead this round.

## Open questions
- None blocking. Name choices (component names, CSS namespace) are yours: record them under Decisions made.

---
## Receiver ack

Codex, 2026-11-17: I will implement the new fretted/keyboard editor, live checks and overlay, plus additive voicing levels and card conversion/alternative helpers within the listed owned files. I will preserve default requestFor behavior, verify all six faces and the mobile browser flow, commit a return handoff, push this branch and open a draft PR. No npm publishing. No blocking questions. GBrain: unavailable in this session.

---
## Return
Write it in `docs/handoffs/2026-11-17-0056-voicing-editor--codex-to-lead.md`.
