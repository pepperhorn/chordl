# Experience levels, and the guitar frame's display options

**Date:** 2026-09-07
**Status:** approved — design agreed, ready for implementation planning
**Context:** follows `2026-09-07-guitar-top3-generated-voicings-design.md` (#49) and `2026-09-07-power-chords-and-ambiguity-grading-design.md` (#50). The difficulty ladder was an open item on both; this is it.

## Problem

Four faults, all on the guitar frame, all measured.

**1. Nothing tells a learner which shape is within reach.** `chordl-guitar` computes the facts — `isOpenShape`, `hasBarre`, `baseFret` — and `voicingSelect.ts` already ships a three-rung ladder (`ShapeClass = "open" | "no-barre" | "any"`) with `matchesShapeClass` and a `widen()` that steps up when a rung runs dry. **No consumer uses any of it.** `SHAPE_CLASS_LADDER` and `ShapeClass` appear nowhere in `chordl-react` or `chordl-board`. `GuitarChordPanel` reads `result.shapes` raw and never calls `selectVoicings`, so every stored position is offered with nothing to distinguish them.

**2. The annotation controls lie on guitar.** `GuitarChordPanel` ignores note names, degrees and fingering **entirely** — they are piano-only. The controls sit enabled beside a guitar frame and do nothing when clicked.

**3. Diagrams draw empty fret rows.** Measured across the corpus:

| | frets a shape needs | drawn by default |
|---|---|---|
| guitar | 1–4 (36 / 418 / 1081 / 534 positions) | 5 |
| ukulele | 1–4 | 5 |
| guitar-top3 | 1–4 (64 / 153 / 243 / 56) | 4 |

**No shape in the corpus needs more than 4 frets.** Guitar and ukulele default to 5, so every diagram carries at least one empty row and the 36 single-fret positions carry four. `GuitarChord` already accepts a `frets` prop; `GuitarChordPanel` simply hands it the static `INSTRUMENTS[id].frets`.

**4. Top-3 has no difficulty data at all.** `Top3GeneratedEntry` carries `source`, `tier` and `approximate`. `tier` is *source precedence* — which rung of the generator's fallback ladder produced the shape — not how hard it is to play. A tier-1 `C major` and a tier-5 `C dim` say nothing about the hand.

## Decisions

### Experience level is a derived property of every shape

`level: "beginner" | "emerging" | "established"`, computed, never hand-assigned.

- **Six-string and ukulele**, from `PositionFacts`: `beginner` = `isOpenShape` (barre-free and at the nut); `emerging` = `!hasBarre`; `established` = the rest.
- **Top-3**, from the shape itself — the facts layer assumes six strings and barres, neither of which applies. Ranked on fret span, open-string count, finger count and neck position, the same axes #49's generator already ranks candidates by.

Measured distribution:

| | beginner | emerging | established |
|---|---|---|---|
| six-string corpus (2,069 positions) | 359 (17.4%) | 492 (23.8%) | 1,218 (58.9%) |
| top-3 (516 entries) | 124 | 183 | 209 |

It surfaces on `GuitarChordResult` — which today carries `shapes: Chord[]` and no per-shape metadata, so this is the API change — and on `Top3GeneratedEntry` and `StaticPreset`.

### Level filters; shape class refines

Two controls, as agreed, with distinct jobs. **Level** is the primary filter on the variation options: it answers "can I play this yet". **Shape class** is a refinement on the guitar frame: it answers "show me the open ones".

They overlap by construction, so the precedence has to be stated or the UI will contradict itself.

### When a combination is empty, relax rather than show nothing

This is the load-bearing rule, because emptiness is the common case rather than the edge:

- **220 of 529 chords (41.6%) have no open shape at all.**
- 88 chords have *only* barre shapes.

A hard beginner filter therefore returns nothing for nearly half the corpus. The order of relaxation:

1. Apply the level.
2. Within it, apply the shape class.
3. If that is empty, **drop the shape-class refinement** — an explicit level choice outranks a refinement.
4. If still empty, **widen the level by one rung**, and report that it widened so the UI can say "no beginner shape — showing emerging".
5. Never return nothing when a shape exists at any level.

Widening follows the `allowNextRung` behaviour `selectVoicings` already implements, and matches the call made for top-3 misses in #49: a learner gets something playable rather than a dead end. **The widening must be visible in the result**, not silent — a filter that quietly ignores itself is worse than one that reports it could not be honoured.

### Fret count is an option with a computed floor

Expose the existing `frets` prop as a control. The minimum is **the highest window-relative fret the displayed shape uses**, so a chord can never be cropped; the default becomes that minimum rather than the instrument's static number. A caller may ask for more (a roomier diagram) but never fewer.

This is per-shape, not per-instrument: switching variation re-computes the floor, and a diagram showing a 1-fret shape need not reserve four rows.

### Inapplicable annotations grey out, they do not disappear

On a guitar-family instrument, note names, degrees and fingering render disabled rather than hidden, so the controls keep their position when the instrument changes and a user is not left wondering where they went. Greying is the honest state: they are real controls that do not apply here, not controls that do not exist.

This records current behaviour rather than blessing it. Guitar diagrams *could* carry note names — svguitar draws text in dots — and if that is built, these controls stop being greyed. Nothing here should make that harder.

## Public API

Additive; `chordl-guitar` is published and `chordl-react` pins it exactly.

- `GuitarChordResult` gains per-shape metadata carrying `level`. The existing `positions` and `shapes` arrays keep their meaning, order and length.
- `Top3GeneratedEntry` and `StaticPreset` gain `level`.
- `GuitarChordPanel` gains optional `level`, `shapeClass` and `frets` props, each seeding internal state and re-syncing when the prop changes — the pattern `instrument` and `position` already use — plus `onLevelChange` / `onShapeClassChange` so a host can persist them.
- `ShapeClass`, `SHAPE_CLASS_LADDER` and `matchesShapeClass` are unchanged. The level is computed *from* the same facts; it does not replace them.

## Naming

**beginner → emerging → established.** Recorded because earlier discussion used "establishing" and "intermediate/experienced" for the same three rungs; one vocabulary, used everywhere, including in the top-3 table.

## Testing

1. **Level is derived, not stored** — assert it against `PositionFacts` for the six-string corpus rather than restating a table, so it cannot drift from the data.
2. **Every shape has exactly one level**, across both instruments and the top-3 table.
3. **The relaxation ladder** — a chord with no open shape returns an emerging shape and reports that it widened; a chord with only barre shapes returns those; nothing returns empty while any shape exists.
4. **Shape class is dropped before the level widens** — pin the order, since it is the part a reasonable person would implement the other way round.
5. **The fret floor never crops** — for every shape in the corpus, the computed minimum is at least the highest relative fret it uses.
6. **Annotations disabled on guitar, enabled on piano** — and that switching instrument does not move the controls.

## Open items

- [ ] Implementation plan and build
- [ ] Whether the board's title/subtitle/footer return behind a disclosure. #51 moved them out from a collapsed `<details>`, which was not asked for; the flicker it caused is fixed at its root, so this is now presentation, not correctness.
- [ ] Whether guitar diagrams should carry note names rather than grey the control. Out of scope; the greying is reversible.
- [ ] Top-3 stores one shape per chord, so it has no *variations* to filter. A level per entry is still useful for ordering a lesson, but a top-3 ladder in the same sense as the six-string one needs the generator to keep its runners-up — a change to what the table stores, and its own design cycle.
