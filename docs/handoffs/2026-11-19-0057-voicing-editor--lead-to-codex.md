# Handoff: 0057 — Voicing editor package: KeyboardSpeller + FrettedEditor (crf-staff lead → codex)

- **Date:** 2026-11-19
- **Type:** dispatch
- **Ledger:** chordl 0057 (replaces 0056, which returned blocked with nothing built) · **Spec:** crf-staff [spec 0030 r2](https://github.com/pepperhorn/crf-staff/blob/main/docs/specs/0030-chord-voicings-audition-builder.md) (D1–D3, Constraints, AC3, AC4) and this repo's `docs/superpowers/specs/2026-10-29-voicing-submissions-design.md` (format + review rules only) · **Plan:** crf-staff [plan 0030 r2](https://github.com/pepperhorn/crf-staff/blob/main/docs/plans/0030-chord-voicings-audition-builder.md) task t1
- **Mockups:** https://claude.ai/artifact/9swbXojKpCNkmPsbwgLek2 (screens 3 and 4 are the editors; they are interactive). If you can't open it, the same HTML is `docs/specs/0030-mockups.html` in pepperhorn/crf-staff.
- **Branch:** orch/0057-voicing-editor · **Worktree:** created by T3
- **PR:** —
- **Base commit:** see the commit that adds this handoff on `main`
- **Port (if running a server):** 5770
- **Status:** open

## Goal
Ship one new package, **`@pepperhorn/chordl-voicing-editor`**, with two single-chord editors that emit `chordl.voicing/1`, plus the helpers crf-staff needs to render and list voicings:

1. **`KeyboardSpeller`**: chordl's own text speller as a single-chord editor, **without the boards**. Teachers type a chord name, an inversion, note names or hands: `C maj 2nd inversion`, `E F# A B`, `E G C`, `rh G C E lh C`, `Eb Gb Bb // Db F`. It draws the keyboard (display only, not tappable), plays it, names it and checks it with the full chordl parser (`chordl-core` natural-language parsing, `identifyChords`, `matchesChordName`). Hands map to `keyboard-hands` (left/right); on plain `keyboard` every note goes to the right hand. Unparsable text says so. **Keyboard look (owner, 2026-11-19):** the CRF theme (`packages/chordl-core/src/themes/crf.ts`) and **note names on by default**, drawn at **`xl`** size (the board's `xl` card size / note-name size, `packages/chordl-board/src/types.ts` `BoardCardSize` and `cardStyle.ts`). Props may override theme, note names and size, but these are the defaults. **No board, grid, storage or multi-chord UI ships.** Whether you extract the input from `BoardEditor` (`packages/chordl-board`) into a shared component or build directly on chordl-core + `PianoChord` is your call (spec open question); record it under Decisions made.
2. **`FrettedEditor`**: a port of github.com/pepperhorn/frames `src/components/ChordWorkbench.tsx` (public, ~850 lines; read it with `gh api repos/pepperhorn/frames/contents/src/components/ChordWorkbench.tsx`). Keep **every input frames has**: per-string fret (number / `x` / `o`) and finger, barre rows, the starting-fret stepper, fret-code entry (`x32010`, and a separator form for frets ≥ 10). Drop its Warhol theme, global CSS, SVG/PNG/PDF export, scale/tab modes. **Add** a tappable diagram: tap a fret cell to place or remove a finger, tap above the nut to cycle open ↔ muted; the diagram and every field stay in sync both ways. Instruments: `guitar`, `guitar-top3` (only strings 1–3 editable, 4–6 locked muted), `ukulele`, `bass4` (frames calls it `bass`). Render through chordl's existing fretted rendering, not svguitar.
3. **`VoicingChecks`**: notes heard, degrees, hard fails vs warnings (omitted fifth, inversion = warning; a wrong note = hard fail), level pill; a polite live region.
4. Each editor takes `chord`, `face` (`CardFace`), an optional `initial` voicing (Tweak → `provenance.basedOn`), and calls `onChange(voicing | null, checks)`; the host owns the "Use this voicing" button, so also export a small `canUse(checks)` (false on a hard fail).
5. **Helpers:**
   - chordl-voicing: `levelOf(voicing): "beginner" | "emerging" | "established"` wrapping the existing experience rules (no new thresholds); extend `checkVoicing` for guitar-top3 / ukulele / bass4 if not covered.
   - chordl-cards: `requestForVoicing(chord, voicing, face, theme): FaceRequest` (throws on kind/face mismatch); `voicingFromRequest(chord, request, face)`; `alternativesFor(chord, face, theme, { limit = 8 })` → `{ voicing, label, kind, level, isStandard }[]`, standard first, deduped by `shapeHash`. Add `@pepperhorn/chordl-voicing` to `packages/chordl-cards/package.json` dependencies (**this is in scope now**; it is exactly what blocked 0056) and keep `test/runtime-deps.test.ts` green.

Build and test everything. **Do not publish to npm.** The owner publishes after merge.

## Context you need
- 0056's return (`docs/handoffs/2026-11-17-0056-voicing-editor--codex-to-lead.md`) and dispatch: most of its context still applies (APIs to build on: `requestFor`, `positionsFor`, `inversionsFor`, `playbackFor`, `ChordCardPlayer`; chordl-voicings `generateVariants` / `getAlternativeVoicings` / `levelForVoicing`; chordl-guitar `voicingReview.ts` / `experience.ts`). **Don't fork the rules.**
- crf-staff faces: `keyboard`, `keyboard-hands`, `guitar`, `guitar-top3`, `ukulele`, `bass4`.
- Host is crf-staff: an Astro + React 19 PWA, white page, token colours. It lazy-loads this package on first open of a sheet, inside a form.

## Scope
- **In:** the package above (components, `editor.css`, README with a usage example, a small demo page for the browser pass), the helpers, root build/test/lint chains.
- **Out:** submission storage, AI review, bowed instruments, editable tunings, publishing, any change to how `requestFor` picks the default shape, any visible change to `BoardEditor`.
- **Files you own:**
  - `packages/chordl-voicing-editor/**` (new);
  - additive `packages/chordl-voicing/src/**` + tests;
  - additive `packages/chordl-cards/src/**` + tests, and `packages/chordl-cards/package.json` (dependency add only);
  - `packages/chordl-board/src/**` + tests **only** for a behaviour-preserving extraction of the text input (existing board tests unchanged and green); `packages/chordl-board/package.json` only if that extraction needs an export entry;
  - root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` if needed;
  - your handoff files (ack section here, and `2026-11-19-0057-voicing-editor--codex-to-lead.md`).
- **Do not touch:** the ledger, other docs, other packages' public behaviour.

## Embedding rules (spec Constraints)
Scoped styles only: an importable `editor.css` under one class prefix, colours via CSS custom properties so hosts theme with tokens; no global CSS (the main porting work for frames). Unique control ids (`useId`). No document-level key listeners. Never submit a host form (`type="button"` everywhere). Every fret cell and nut target is a labelled button ("String 2 (B), fret 3, finger on"); fret cells ≥ 36 px, other targets ≥ 44 px; the keyboard scrolls horizontally inside its own container; works at 360 px. Level and state are text, never colour alone.

## Acceptance criteria
- [ ] `levelOf` agrees with the existing experience rules on their fixtures.
- [ ] Round trip: for all six faces × {C, G, Am, F, D7, Em}, the SVG for `requestForVoicing(voicingFromRequest(requestFor(c, f)))` matches `requestFor(c, f)`.
- [ ] `alternativesFor` returns the standard first, deduped, each with a level; ≥ 2 options for G on guitar.
- [ ] `FrettedEditor` DOM tests: build Cmaj7 `x32000` by tapping and by fret code, and the fields/diagram agree; barre row and starting-fret stepper round-trip; guitar-top3 locks strings 4–6; bass4 and ukulele load; Tweak seeds from `initial` and sets `provenance.basedOn`; a wrong note → hard fail and `canUse` false; omitted fifth → warning only.
- [ ] `KeyboardSpeller` DOM tests: `C maj 2nd inversion`, `E G C`, `E F# A B`, `rh G C E lh C` draw and check correctly; on `keyboard-hands` the hands go to the right side; nonsense text shows the "can't read that" message; no board UI rendered.
- [ ] `packages/chordl-cards/test/runtime-deps.test.ts` green with the new dependency.
- [ ] Real-browser pass (Playwright/Chromium) of the demo page at 360 px for both editors: screenshots attached to the return handoff, no console errors.
- [ ] Full verify green.

## Verify with
```bash
pnpm install --frozen-lockfile=false && pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site
```

## Known gotchas / decisions already made
- Owner decisions (crf-staff spec 0030 r2, 2026-11-19): keyboard = chordl's text speller without boards; strings = frames port with all its inputs plus a tappable diagram; both in one chordl package; levels are chordl's computed beginner/emerging/established.
- GBrain (projects/chordcards): openchords `barres[].fromString/toString` are **zero-based indices into `realization.strings` (low string first)**, not string numbers; barre fingers come from the source shape, not a default of 1.
- Musical facts are computed in code, never guessed.
- If scope must grow again, stop and return `blocked` with the exact file and why (AGENTS.md §7), as 0056 did.

## Open questions
- None blocking. Component, CSS-prefix and extraction choices are yours: record them under Decisions made.

---
## Receiver ack
<!-- Implementer: restate your understanding here and commit it on your branch before coding. -->

---
## Return
Write it in `docs/handoffs/2026-11-19-0057-voicing-editor--codex-to-lead.md`.
