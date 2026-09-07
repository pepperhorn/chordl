# Power chords across instruments, and grading what "approximate" means

**Date:** 2026-09-07
**Status:** approved — design agreed, ready for implementation planning
**Context:** follows `2026-09-07-guitar-top3-generated-voicings-design.md` (merged as #49). Supersedes Task 3 of `../plans/2026-08-09-chordl-guitar-gap-closing.md`, which scoped power chords for bass only.

## Problem

Three things converge on the same code, and doing them separately would produce a third power chord generator.

**1. `guitar-top3` has no power chords, and that is the chord a beginner most wants.** chords-db ships no `5` suffix at all — it is why `powerChords.ts` exists — so nothing flows into the generated top-3 table. A learner keeping up with more advanced friends reaches for `E5` before `E9`.

**2. The generated table grades beginner chords and exotic ones identically.** After #49, every `6` and every `9` is `approximate`. Both flags are honest, but they mean different things: `C6` is C-E-A, which is *genuinely and unavoidably* also an A-minor triad on three strings; `C69` is approximate because it had to drop its 9th and no longer contains the tone it is named for. A `C6` is a chord this audience plays. A `C69` is not. One flag cannot serve a caller who wants to warn about the second and not the first.

**3. Power chord logic already exists twice, and is about to exist a third time.** `powerChordPosition` in `chordl-guitar` hardcodes `INSTRUMENTS.guitar` and a 6-element array. `frames/src/lib/staticPresets.ts` carries `BASS_PRESETS`, ~110 lines of hand-fingered root-fifth shapes keyed `suffix: "5"`. The merged phase B plan then proposes generalising `powerChordPosition` to `bass4`/`bass5` and diffing it against those presets. Adding a separate top-3 path would repeat the `bassShapeFor` versus `powerChordPosition` split this project already has once.

## Decisions

### One generator, two axes

`powerChordPosition` generalises along **instrument** and **string set**, with validity derived from `openMidi` rather than enumerated. It serves `guitar`, `guitar-top3`, `bass4` and `bass5` from one implementation.

The derivation rule is the one already written into the merged phase B plan and is unchanged: a shape rooted at string index `i` is valid when it fits the instrument, and when **every adjacent pair it actually uses is a perfect fourth** (`openMidi[i+1] - openMidi[i] === 5`). This is why guitar's D-rooted three-note shape is invalid — D→G is a fourth but G→B is a major third, putting the third note a major seventh above the root rather than an octave. Nothing is hand-listed per instrument; adding an instrument costs nothing.

`bassShapeFor` in `generatedShapes.ts` stays as it is. It is a movable teaching pattern for chordl-board's cards, not a chords-db-shaped position, and #44's refresh already records why both exist.

### Two sounding strings, not three

`guitar-top3` currently requires exactly three sounding strings. A power chord is two pitch classes, so on G-B-E the third string must double one of them — and G-B-E's tuning (a major third, then a fourth) permits that for only **4 of 12 roots**. Relaxing to *at least two* gives **12 of 12**.

This is not a new convention. frames' own `BASS_PRESETS` already mute two of four strings — `[[4,0],[3,2,"2"],[2,"x"],[1,"x"]]` — so the house's existing power chord data is two-note. The rule becomes: **at least two sounding strings, at most three**, muted strings contiguous from the treble side.

### The root is the lowest sounding note

The decision this design exists to make. Both readings reach 12/12, so there is no coverage argument — only ease against correctness:

| | `E5` | `G5` | `C5` |
|---|---|---|---|
| root anywhere | `[x,0,0]` — **0 fingers**, two open strings | `[0,3,x]` — 1 finger | `[0,1,x]` — 1 finger |
| root lowest | `[x,5,7]` — 2 fingers, span 2, at the 5th fret | `[0,3,x]` — 1 finger | `[x,1,3]` — 2 fingers |

The zero-finger `E5` is tempting and it is the wrong default. Its two notes are B and E with **B on the bottom**: the sounding interval is a perfect fourth, which reads as an inversion, not as `E5`. #49 exists precisely because the table shipped diagrams that were really other chords, and shipping `E5` as a fourth would re-introduce that fault in the one chord this change is for.

**So: the root must be the lowest sounding note.** `G5`, `A5` and `B5` stay one-finger shapes; the rest become two fingers around the 5th fret, which is the honest cost.

The easier inverted shapes are not discarded — they are the natural content of a *beginner* rung once the difficulty ladder lands (see Open items). A rung that says "easiest possible" may legitimately accept an inversion where the default may not.

### `approximate` splits into graded reasons

One boolean cannot distinguish "unavoidable on three strings" from "lost the tone it is named for". Replace it with a reason, keeping `approximate` as a derived convenience so no consumer breaks:

| reason | meaning | example |
|---|---|---|
| `exact` | every chord tone sounds | `C major`, `C sus4` |
| `inherent` | complete, but three notes cannot distinguish it — no voicing can do better | `C6` (is also Am), `dim7`, `aug` |
| `rootless` | correct tones, root dropped | rootless 7th shells |
| `reduced` | **a tone the chord is named for is absent** | `C69` without its 9th |
| `substituted` | the shape is another chord's, offered because nothing better exists | the exotic tail |

`approximate` remains true for everything except `exact`, so existing callers keep working. The distinction that matters to a UI is `inherent` — never worth a warning badge, because no alternative exists — against `reduced`, which is the one a caller should question.

This also sharpens the duplicate-shape test: `inherent` collisions are expected and exempt; a `reduced` entry colliding with the chord it reduces to is a defect, which is exactly the `C69`/`C6` fault #49's review caught.

## Coverage

Power chords, G-B-E, root lowest, span ≤2, renderable: **12/12**. On `guitar`, `bass4` and `bass5` the existing E/A string-set behaviour is unchanged and bass gains its sets by derivation.

Re-grading moves no shapes. It reclassifies: the `6` chords and the symmetric qualities become `inherent` rather than sharing one flag with `C69`'s `reduced`.

## Constraints

- **Additive.** `powerChordPosition`, `powerChordShape`, `GUITAR_TOP3_PRESETS` and `lookupTop3Chord` keep their signatures. `PowerChordOptions` gains an optional `instrument`; `PowerChordStringSet` widens. `StaticPreset.approximate` stays and stays meaning what it means.
- `openMidi` is chords-db index order, low→high. svguitar numbers from the highest pitch, so G-B-E are strings 3, 2, 1. Exactly one function inverts — `dbPositionToChord`.
- The window rule from #49 holds: every emitted shape carries a `position`, and no shape mixes an open string with a fret past `INSTRUMENTS[...].frets`.
- No new dependency; `chordl-guitar` must keep publishing standalone.
- `suffix: "5"` is the existing convention, from `BASS_PRESETS`. Do not invent another.

## Testing

1. **Validity is derived, not listed** — assert the per-instrument valid string sets from `openMidi` rather than restating letters, so the table cannot drift from the data.
2. **Every power chord sounds root and fifth, root lowest** — across all 12 roots and all four instruments, via `positionToMidi`.
3. **Guitar behaviour is unchanged** — the existing E/A assertions must pass untouched.
4. **Diff against frames' `BASS_PRESETS`** — generated versus hand-fingered, reporting differences rather than assuming equivalence. A hand-authored shape that disagrees with the formula is a musical judgement worth understanding before it is overwritten.
5. **Reason grading** — every entry has exactly one reason; `approximate === (reason !== "exact")`; no `reduced` entry shares a sounding-tone set with the chord it reduces to.
6. **Two-or-three sounding strings** — never one, never a muted string between two sounding ones.

## Open items

- [ ] Implementation plan and build
- [ ] Difficulty graduation (beginner / establishing / emerging) — approved separately as *hand difficulty, same notes*. It depends on this: the inverted power chord shapes rejected above are a beginner rung's natural content, and the reason grading gives a rung something to filter on.
- [ ] Whether `frames` drops `BASS_PRESETS` once the generator covers bass. Decide on the diff in test 4, not before.
- [ ] Amend the #49 spec for the three items its implementation forced: renderability as a stated filter, `unrenderable` removed in favour of returning nothing, and top-3 positions carrying a real `baseFret`.
