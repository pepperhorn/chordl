# Handoff: adhoc — bring crf-chords up to date with chordl (chordl lead → chords lead)

- **Date:** 2026-11-10
- **Type:** dispatch (cross-repo)
- **Ledger:** chordl 0052 (release) and 0053 (this handoff); the crf-chords lead assigns its own item ID
- **Repos:** source https://github.com/pepperhorn/chordl (main @ 8f3ad13); target https://github.com/pepperhorn/crf-chords (main @ 4c14051), local `/home/shaun/chords`
- **Status:** open — **unblocked 2026-11-10:** `@pepperhorn/chordl-core@0.6.3` and `@pepperhorn/chordl-react@0.5.3` are published (release runs 42714448779, 42714942893). The `0048` and `0050` changes are included.

## Goal
crf-chords is two to three releases behind chordl, and some of the newer chordl behaviour changes affect it. Upgrade its `@pepperhorn/chordl-*` dependencies to the releases listed below, adapt to the behaviour changes, and verify with crf-chords' own checks. Done means: crf-chords main installs the new versions from npm, its verify command passes, and the four impact checks below are confirmed and recorded.

## Where things stand (measured 2026-11-10)

| Package | crf-chords main pins | npm latest | chordl main | Notes |
|---|---|---|---|---|
| `@pepperhorn/chordl-core` | 0.6.1 | 0.6.2 | 0.6.2 **plus unpublished parser changes** | will publish as 0.6.3 (chordl 0052) |
| `@pepperhorn/chordl-react` | 0.5.1 | 0.5.1 | 0.5.3 (unpublished) | |
| `@pepperhorn/chordl-cards` | 0.3.0 | 0.3.0 | 0.3.0 | no change |
| `@pepperhorn/chordl-guitar` | 0.3.1 | — | 0.3.1 | no change |
| `@pepperhorn/chordl-listen` | 0.1.0 | — | 0.1.0 | no change |
| `@pepperhorn/chordl-voicings` | 0.4.1 | — | 0.4.1 | no change |
| `@pepperhorn/chordl-board` | not used | 0.2.3 | 0.2.4 (unpublished; held for becreative, chordl 0047) | n/a to crf-chords |

openchords is already current: it depends only on `@pepperhorn/chordl-voicing@0.2.0`, which hasn't changed.

## What changed in chordl that matters here
Links are to merged PRs. Each one's return handoff in `chordl/docs/handoffs/` has the detail.

1. **core 0.6.2, already on npm.** Bracketed alterations and slash fallback: #104 (0031).
2. **core, unpublished, will ship as 0.6.3. Parser strictness:**
   - #106 (0032): `C7alt` keeps its `alt`.
   - #110 (0038): a root is read only from a standalone chord token. Nonsense like "hello world", "banana" or "Zbq9" now gives `chordName: ""` and an error, where before it drew a chord. Resolver-accepted spellings (`Cmi7`, `CΔ`, `Co7`, `C-7`) parse to their full token, and `♭`/`♯` are normalised.
   - #113 (0046): "Ah"/"Eh" are words, not chords. "Cmi7/E in the left hand" keeps the chord quality.
   - Possibly #118 (0048, in review): `CΔ7` / `CmΔ7` / `C∆7` resolve.
3. **react 0.5.2, #112 (0045-t1).** `smplr` loads only when audio plays or a WAV export runs.
4. **react 0.5.3, #114 (0045-t2). Behaviour change.** `GuitarChord` and `GuitarChordPanel` now load SVGuitar and the guitar data on their first render, behind a loading fallback (`.chordl-board-card-loading`, `data-chordl-state="loading"`, no SVG). The rendered root `.bc-guitar-chord` reaches `data-chordl-state="ready"` once it has painted, or `"error"` if it fails. Export names and props are unchanged.
5. **react, possibly in the same release.** Staff notation will report `data-chordl-state` on each `.bc-staff` (#119, chordl 0050, in review).

## Impact checks to do in crf-chords
1. **SSR of guitar faces.** `src/pages/[slug].astro:168` renders `<ChordFaces client:visible …>`, which is server-rendered before hydration. With react 0.5.3, the server HTML for a guitar face will contain the loading placeholder, not the diagram. Decide whether that's acceptable for SEO, no-JS views and social cards. If it isn't, options include a server-side static SVG, or keeping guitar faces client-only with a sized placeholder. Measure the page before and after; don't assume.
2. **Browser tests that read the guitar SVG straight away.** `src/components/ChordFaces.browser.mjs:142` must wait for `.bc-guitar-chord[data-chordl-state="ready"]`. `progressions/Builder.amendments.browser.mjs:76` already waits for `.ccp-guitar svg`; confirm it still passes. Grep for any other immediate `querySelector(…svg)` on chordl output.
3. **Exports and screenshots.** Anything that rasterises a chord face (downloads, posters, OG images) must wait until no `[data-chordl-state="loading"]` remains in the captured element, with a bound. This is the same rule chordl-board's `captureBoard` uses (#114).
4. **Parser strictness.** Find every place crf-chords passes free text or stored symbols to chordl parsing (direct core imports are in `src/lib/library.ts`, and cards/react do it internally). Run its chord data and test fixtures through the new core: any symbol that now resolves to `""` or differently is a finding. `chordl/packages/chordl-core/test/parser-compat-sweep.mjs` shows the old-vs-new comparison method.

## Order
1. **chordl (chordl lead):** finish 0048 and 0050. Bump `chordl-core` to 0.6.3 with a CHANGELOG entry (chordl 0052). Then publish `chordl-core@0.6.3` and `chordl-react@0.5.3`, or later if 0050 lands, by pushing release tags (`.github/workflows/release.yml`). Publishing needs the human's OK. `chordl-board` stays unpublished until becreative is ready (chordl 0047), which doesn't affect crf-chords.
2. **crf-chords (receiving lead):** once both versions are on npm, bump them, do impact checks 1–4, and run its verify command.

## Acceptance criteria
- [ ] crf-chords `package.json` pins the published versions, from npm and not vendored.
- [ ] Impact checks 1–4 each recorded with evidence (file:line, a measurement, or a test).
- [ ] crf-chords verify passes: `pnpm test && pnpm exec astro check && pnpm build`, plus its browser tests for ChordFaces and the progressions builder.

## Verify with
```bash
# in crf-chords
pnpm install && pnpm test && pnpm exec astro check && pnpm build
```

## Known gotchas / decisions already made
- GBrain facts #696, #702, #707 and #714 (chordl) cover the parser rule, the readiness rule and the load-on-demand outcome.
- The human decided (2026-11-09) that unreadable chord input must show an error, not a best-guess chord.

## Open questions
- For impact check 1: is server-rendered guitar markup a product requirement for crf-chords (SEO or no-JS)? That's the crf-chords lead's or the human's call.

---
## Receiver ack
