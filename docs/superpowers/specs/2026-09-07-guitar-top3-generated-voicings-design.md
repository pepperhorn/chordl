# guitar-top3: generated three-string voicings

**Date:** 2026-09-07
**Status:** approved — design agreed, ready for implementation
**Context:** `guitar-top3` renders beginner chord shapes on the top three strings. The table is 20 hand-authored entries and covers 7 of 12 roots. This replaces it with a generated, verified table covering all 12.

## Problem

`GUITAR_TOP3_PRESETS` in `packages/chordl-guitar/src/staticPresets.ts` is 20 hand-authored shapes. Three faults, in ascending order of severity:

**1. Coverage.** Only 7 of 12 roots appear at all; C#, D#, F#, G#, A# have nothing. By quality: major 6/12, minor 5/12, dominant 7 5/12, m7 3/12, maj7 1/12, and zero for sus2, sus4, dim, aug, 6 and 9. The key of E cannot cadence — B major is absent (only B minor exists) and B7 with it. A-F#m-D-E is unplayable although A, D and E all exist.

**2. A miss is a dead end.** `lookupGuitarChord` returns `null` for an unknown top-3 chord, deliberately: falling back to a six-string shape under a three-string label would be a lie, and that reasoning stands. But `GuitarChordPanel` then renders grey notice text with no diagram, and board cards render with `showControls={false}` and a pinned instrument — so a card on a missing chord has no recovery path at all. Every gap is a hard visible failure for exactly the audience this instrument targets.

**3. Three presets render an identical diagram to another preset.**

| | shape (G,B,E) | sounds | identical to |
|---|---|---|---|
| `A m7` | `[0,1,0]` | C E G | `C major` |
| `F maj7` | `[2,1,0]` | C E A | `A minor` |
| `D m7` | `[2,1,1]` | C F A | `F major` |

The cause is an unstated and inconsistent policy on which tone to drop from a four-note chord. The table drops the **5th** in four cases (C7, G7, E7, Em7) and the **root** in five (D7, A7, Am7, Dm7, Fmaj7). Dropping the root is never safe, and the failure is systematic rather than unlucky:

- dominant 7 without its root is 3rd-5th-b7, **always a diminished triad on the 3rd**. `D7` sounds exactly F#dim; `A7` sounds exactly C#dim.
- m7 without its root is **always the major triad on the b3rd**.
- maj7 without its root is **always the minor triad on the 3rd**.

The existing per-preset test cannot see this: it checks one preset at a time against its own chord tones, so it never compares presets to each other.

## Decision

Generate the table from `@tombatossals/chords-db`, falling back to arithmetic construction where the corpus is silent, and check the result in as source. Keep the instrument restricted to the **G-B-E window**; the top three strings are the product definition, not a tuning parameter.

### Why generated rather than extended by hand

Mining every three-adjacent-string window of all 2,069 stored guitar positions establishes that the current comment — "chords-db has no three-string voicings, so these cannot be derived" — is true as literally written and misleading as used. chords-db stores no three-string *entries*, but three-string sub-shapes of six-string positions exist in quantity:

| Bar (G-B-E window, span ≤2, all three strings sounding) | pairs of 529 |
|---|---|
| Musically complete (3rd + root-or-5th, 7th kept where the parent has one) | 402 |
| ...and unambiguous | 230 |
| Root present (never dropped) | 244 |
| ...and unambiguous | 169 |

The method validates against known shapes: extracting the G-B-E window from open C (`X32010`) yields `[0,1,0]` and from open G yields `[0,0,3]`, reproducing two existing hand-authored presets exactly. **All 20 current presets are derivable.**

### Why arithmetic construction is also needed

Four qualities are poorly served or absent from the corpus in this window. `dim` has **zero** qualifying G-B-E windows — chords-db's stored diminished voicings mute or spread the top strings in every case. But a three-note chord on three known open strings is a solved arithmetic problem, and this package already generates rather than stores shapes where that is true (`powerChords.ts`, `generatedShapes.ts`). Constructing directly from pitch classes gives:

| quality | constructible on G-B-E, span ≤2, within 12 frets |
|---|---|
| dim | 12/12 |
| sus2 | 12/12 |
| sus4 | 12/12 |
| aug | 12/12 |

Several are excellent: `C sus4` is `[0,1,1]`, span 0 with an open string; `A sus2` is `[2,0,0]`, span 0 with two.

### Source precedence

Per (root, suffix), take the first tier that yields a shape:

1. **Existing hand-authored preset**, if it contains the root and is unambiguous. These are the canonical first-position beginner shapes and 15 of the 20 qualify; preserving them keeps current output stable. The five that drop the root (D7, A7, Am7, Dm7, Fmaj7) do not qualify and are regenerated — this is what fixes fault 3.
2. **Corpus, root present, unambiguous, highest fret ≤5.**
3. **Corpus, root present, unambiguous,** any position.
4. **Corpus, complete and unambiguous,** any position (root may be absent only if the result is not another named chord).
5. **Arithmetic construction** — exact pitch classes by definition, span ≤2, lowest position first.
6. **Corpus, complete,** accepting ambiguity. Marked `approximate`.
7. **Corpus, any window** with three sounding strings and span ≤2. Marked `approximate`.
8. `null`.

Within a tier, rank by: highest fret ascending, then span ascending, then open-string count descending, then finger count ascending.

Construction sits at tier 5, above the ambiguous corpus tiers, because an exactly-correct generated shape beats a real-but-misleading stored one. It sits below the unambiguous corpus tiers because those are human-played voicings that someone has actually fingered.

### Dropping tones from four-note chords

Three strings cannot hold four tones. **Drop the 5th. Never drop the root.** Where the 5th is already absent from a candidate, prefer keeping the 7th over the 5th — the 7th is what names the chord. This is the rule the existing table follows in four cases and violates in five.

### Symmetric chords are inherently ambiguous, and that is not a defect

A diminished triad is stacked minor thirds and an augmented triad is stacked major thirds, so each shape genuinely names three (aug) or four (dim7) roots. `C aug`, `E aug` and `Ab aug` all correctly produce `[1,1,0]`. The generator must not treat this as a collision to resolve, and the duplicate-shape test (below) must exempt these qualities. The chord label disambiguates, exactly as it does for the rootless dominant shells guitarists already use.

### Always return a shape

Per product decision: **kids get something to play rather than an error.** Tiers 6 and 7 accept ambiguity in order to fill dim and sus and anything else the earlier tiers miss, and each such entry carries `approximate: true` so a caller can present it differently if it wants. Only chords with no qualifying window at all fall through to `null`.

Fourteen (root, suffix) pairs have no three-adjacent-string span-≤2 window in any form: all 12 `alt` chords, plus two edge cases. This is structural — chords-db's altered-dominant voicings deliberately spread root, 3rd, 7th and the alteration across non-adjacent strings to leave room for tensions. These stay `null`; there is nothing honest to return.

## Resulting coverage

All 12 roots, for every quality the corpus or construction can express:

| | maj | min | 7 | m7 | maj7 | 6 | 9 | sus2 | sus4 | dim | aug |
|---|---|---|---|---|---|---|---|---|---|---|---|
| unambiguous, any position | 12 | 12 | 9 | 10 | 8 | 8 | 5 | — | — | — | — |
| with construction and approximate fallback | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 12 | 12 |

Against today's 6/5/5/3/1 and zeroes. The previously blocking gaps resolve: **B major** `[4,4,2]`, **B7** `[4,4,5]`, **F#m** `[2,2,2]` — the last a one-finger mini-barre at the 2nd fret.

## Shape of the artefact

A generated TypeScript table checked in as source, not a build-time artefact in `src/generated/`.

The slim chord JSON is gitignored and rebuilt because it is bulk data nobody reads. This table is the opposite: roughly 500 shapes that a human should be able to review in a diff, because — as the current file's own comment says — a wrong shape is unrecoverable once printed. Checking it in makes every future change to the generator visible as a change to its output.

Drift is prevented by a test that re-runs the generator and asserts the checked-in table is byte-identical, so the two cannot separate silently.

## Testing

1. **Regeneration is stable** — running the generator reproduces the checked-in table exactly.
2. **Every entry sounds its chord** — derive pitch classes from `positionToMidi` against `INSTRUMENTS["guitar-top3"].openMidi` and compare to the chord tones the suffix implies. Verify against the package's own pitch math, never a reimplementation.
3. **No two entries share a shape**, except where both are symmetric-chord qualities (dim, dim7, aug). This is the test the current suite lacks and the one that would have caught fault 3.
4. **The root is present** in every non-`approximate` entry.
5. **Span ≤2 and exactly three sounding strings** for every entry.
6. **The 15 qualifying legacy presets are unchanged**, pinned individually so a generator change cannot quietly restyle a chord a learner already knows.
7. **The five root-dropped legacy presets have changed**, asserted explicitly so the fix cannot regress.

## Constraints

- **Additive to the public API.** `GUITAR_TOP3_PRESETS` and `lookupTop3Chord` keep their names and signatures. `StaticPreset` may gain optional fields; it may not lose or rename any.
- `openMidi` is chords-db index order, low→high. svguitar numbers strings from the highest pitch, so G-B-E is svguitar strings 3, 2, 1. Exactly one function inverts string order — `dbPositionToChord`. The generator must state which convention each table uses and must not add a second inversion.
- Absolute fret is `baseFret - 1 + f` for `f > 0`; `-1` (muted) and `0` (open) are sentinels and are never offset.
- Strings 4-6 stay muted, as now.
- No new dependency. `chordl-guitar` depends only on `@tombatossals/chords-db` and `svguitar`, which is what lets it publish standalone.
- The no-fallback-to-six-strings rule stands.

## Open items

- [ ] Implementation plan and build
- [ ] Decide whether `approximate` entries should render with a visual marker, or whether the flag stays advisory. Out of scope here; it is a `chordl-react` presentation question.
- [ ] Revisit the fret-5 preference in tier 2 once there is real usage data — it is a judgement about beginner orientation, not a derived value.
