# Scale support: chord-shorthand scales and the full scale vocabulary

**Date:** 2026-07-30
**Status:** approved (design)

## Problem

Adding the word `scale` to a chord string should render a one-octave scale. Today it does not:

| Input | Current result | Expected |
|---|---|---|
| `dm scale` | Dm **chord** | D natural minor scale |
| `D scale` | D chord | D major scale |
| `Cmaj7 scale` | Cmaj7 chord | C major scale |
| `dm scale 2 octaves` | Dm chord | two-octave D natural minor |
| `dm harmonic minor scale` | **C minor** scale (bug) | D harmonic minor |
| `dm melodic minor` | **Cm chord** (bug) | D melodic minor |
| `dm scale in 2 8ves` | Dm chord | two-octave D natural minor |

The theory layer and the render path are already correct. `resolveScale()` in
`packages/chordl-core/src/resolver/scale-resolver.ts` returns one octave as
seven pitch classes plus the closing tonic, and `PianoChord.tsx` renders scales
on the keyboard with degree labels and optional fingering. Verified output:

```
D minor            -> D E F G A Bb C D
D harmonic minor   -> D E F G A Bb C# D
D melodic minor    -> D E F G A B C# D
D melodic minor ↓  -> D E F G A Bb C D
D minor, 2 octaves -> D E F G A Bb C D E F G A Bb C D
```

All the work is in the parser, `packages/chordl-core/src/parser/natural-language.ts`,
plus a small extension of the resolver's name table.

## Reference

The scale vocabulary and the chord→scale pairings come from the Creative Ranges
Foundation "Scale FORMULAS" sheet (`ScaleFormulas.jpg`, CC BY-NC-SA 4.0), which
annotates each scale with the chord it is used on. chordl is MIT licensed, so
the sheet is used only as a reference for *which* scales and pairings to
support. Interval formulas are facts, and note lists are derived from Tonal at
runtime; none of the sheet's layout or wording is copied into the repo.

## Section 1 — Scale vocabulary

Every scale on the sheet becomes nameable in a chord string. Tonal supplies 24
of the 27 directly. Verified gaps and their resolutions, all handled by
extending `SCALE_NAME_MAP` in `scale-resolver.ts`:

| Sheet name | Resolution |
|---|---|
| Sus Dominant (I II IV V VI bVII) | Tonal has it as `piongio`; alias `sus dominant` → `piongio` |
| Bebop Dominant | Tonal's plain `bebop`; alias `bebop dominant` → `bebop` |
| Bebop Dorian / Bebop Min | alias → Tonal's `bebop minor` |
| Blues Superscale (10 notes) | **not in Tonal**; needs a hardcoded interval list |
| Locrian ♮2 / Half Diminished | already work as `half-diminished` and `locrian #2` |

**Existing bug to fix:** `SCALE_NAME_MAP` currently maps `bebop` →
`bebop major`. Both the sheet and Tonal treat plain "bebop" as the dominant
form (C D E F G A Bb B). Bare `bebop` becomes bebop dominant; `bebop major`
stays reachable by its full name.

### Blues Superscale

Not present in Tonal, so `resolveScale()` gains a small custom-scale table
consulted before Tonal. One entry:

- Intervals: `1P 2M 3m 3M 4P 5d 5P 6M 7m 7M`
- In C: C D Eb E F Gb G A Bb B (C)

The table is a general escape hatch; a custom entry returns the same
`ResolvedScale` shape (notes, root, type, intervals) so degree labels,
fingering, and multi-octave expansion all keep working unchanged.

### Enharmonic spelling

Three scales come out of Tonal spelled with sharps where the sheet uses flats:

| Scale | Tonal | Wanted |
|---|---|---|
| Altered / Dim Whole Tone | C Db **D#** E **F#** Ab Bb | C Db **Eb** E **Gb** Ab Bb |
| Whole Tone | C D E F# G# **A#** | C D E F# G# **Bb** |
| Diminished H-W | C Db Eb E **F#** G A Bb | C Db Eb E **Gb** G A Bb |

Same pitches, different spelling. These scales get a `preferFlat` marker in the
name table, and `resolveScale()` runs their notes through the existing
`spellWithPreference(note, root, true)` helper in
`packages/chordl-core/src/engine/note-spelling.ts`. Pitch identity is unchanged,
so MIDI, highlight keys, and playback are unaffected — only the printed labels
change.

### Degree labels

Labels are computed from Tonal intervals via `degreesForIntervals()`, so they
are correct independent of the sheet. Where the sheet's own degree row is loose
— its Phrygian row reads I–II–III–IV–V–VI–VII while its notes are
C Db Eb F G Ab Bb — chordl shows the accurate I bII bIII IV V bVI bVII. Roman
numerals with `#`/`b` accidentals are the established convention in this repo.

## Section 2 — Chord shorthand → scale

`<chord> scale` maps the chord quality to a scale. Where the sheet lists several
scales for one chord, the shorthand picks the primary; the others remain
reachable by naming them explicitly (`dm7 dorian`, `dm phrygian`).

| Shorthand | Scale | Sheet's basis |
|---|---|---|
| `d`, `dmaj`, `dmaj7`, `d6`, `d9`, `d13`, `dM7` | D major | use on Cmaj |
| `dm`, `dmin`, `d-`, `dm7`, `dm9`, `dm11`, `dmMaj7` | D natural minor | use on Cm |
| `d7` | D mixolydian | use on C7 |
| `dsus`, `dsus4`, `d7sus` | D sus dominant | use on Csus or C7sus |
| `dm7b5`, `dø7`, `dø` | D locrian | use on Cm7b5 / CØ7 |
| `ddim`, `ddim7`, `d°7` | D diminished (W-H) | use on Cdim7 |
| `d7b9`, `d7#9`, `d7#11` | D diminished (H-W) | use on C7b9 / #9 / #11 |
| `d7alt` | D altered | use on C7alt |
| `daug`, `d+`, `d7+`, `d7#5` | D whole tone | use on C7+ or C7alt |
| `dmaj7#11` | D lydian | use on Cmaj7#11 |
| `d9#11` | D lydian dominant | use on C9#11 |
| `dmaj7#5` | D lydian augmented | use on Cmaj7#5 |

Anything not in the table (unrecognized suffix) falls back to major.

Precedence: an explicit scale name always wins over the quality map, so
`dm harmonic minor scale` is D harmonic minor, not D natural minor.

Two decisions, both settled:

1. `dm7b5` maps to plain **Locrian**, not Locrian ♮2 / Half-Diminished. The
   sheet lists both; plain Locrian is the more common first answer, and
   `dm7b5 half diminished scale` reaches the other.
2. Melodic minor defaults to the **ascending** form over one octave
   (D E F G A B C# D), matching the sheet's "Melodic Minor Ascending". The
   existing `descending` keyword flips it to natural minor. No automatic
   up-and-down 15-note render.

## Section 3 — Parser mechanics

Three changes in `natural-language.ts`, all in the scale-detection block that
already runs before chord extraction (~line 573).

### 3.1 Word-boundary fix (bug)

`SCALE_UNAMBIGUOUS_RE` and `SCALE_EXPLICIT_RE` capture the root as
`([A-Ga-g][#b]?)` with no left boundary, so the trailing **c** of "harmoni**c**"
is read as a root note: `dm harmonic minor scale` matches "c minor scale" and
renders C minor. Both patterns gain a `(?<![A-Za-z#b])` lookbehind on the root.
This also stops `dm melodic minor` from being shredded into a `Cm` chord.

Test cases: `dm harmonic minor scale`, `d harmonic minor`, `dm melodic minor`,
`bb harmonic minor scale`, `f# melodic minor`.

Implementation note: the file uses no lookbehind today. The build targets
ES2020 so `(?<!...)` is in-spec, and it needs Safari 16.4+ at runtime. If that
floor is unacceptable for a published package, the equivalent without lookbehind
is a `(?:^|[^A-Za-z#b])` prefix group with the capture indices shifted by one —
functionally identical, slightly noisier. Either is fine; pick one and use it
consistently in 3.1 and 3.2.

### 3.2 Chord-shorthand scale detection

A new pattern runs *after* the two existing scale patterns fail, so spelled-out
forms keep priority:

```
SCALE_FROM_CHORD_RE = /(?<![A-Za-z#b])([A-Ga-g][#b]?)((?:maj|min|m|aug|dim|sus|add|dom|M|°|ø|\+|-|[0-9#b]+)*)\s+scale\b/i
```

On a match: capitalize the root, normalize the suffix (lowercase, strip
whitespace), look it up in the quality→scale table from Section 2, and set
`isScale`, `scaleName`, `scaleOctaves` exactly as the existing branch does. The
suffix table is keyed on normalized suffixes so `dmin7`, `dm7`, and `d-7` all
land on natural minor.

Order in the resolution chain, first match wins:

1. `SCALE_UNAMBIGUOUS_RE` — `d dorian`, `d harmonic minor`, `d blues`
2. `SCALE_EXPLICIT_RE` — `d minor scale`, `d major scale`
3. `SCALE_FROM_CHORD_RE` — `dm scale`, `D scale`, `Cmaj7 scale`
4. no scale → existing chord path

Because `SCALE_FROM_CHORD_RE` requires the literal word `scale`, no bare chord
string changes meaning. `Dm7` is still a chord; only `Dm7 scale` becomes a
scale.

`SCALE_FROM_CHORD_RE` is added to the strip list feeding chord-name extraction
so a matched scale leaves no chord residue.

### 3.3 Octave spelling

`OCTAVES_RE` becomes `/\b(?:in\s+)?(\d+)\s*(?:octaves?|8ves?|8va)\b/i`, adding
`8ve`/`8ves`/`8va` and tolerating `2octaves`. The count already feeds both
`scaleOctaves` and the arpeggio `chordOctaves` fallback, and one octave stays
the default when no count is given.

Test cases: `dm scale 2 octaves`, `dm scale in 2 8ves`, `dm scale 2 8ve`,
`d minor scale 3 octaves`, and `dm scale` (defaults to 1).

## Testing

Vitest, in `packages/chordl-core/test/`. `natural-language.test.ts` currently
has **no** scale coverage at all, which is why the boundary bug survived.

New tests in `natural-language.test.ts`:

- shorthand → scale for each row of the Section 2 table
- unrecognized suffix falls back to major
- explicit name beats the quality map (`dm harmonic minor scale`)
- the boundary-bug cases from 3.1
- octave spellings from 3.3, including the default of 1
- bare chord strings unchanged (`Dm7`, `Cmaj7`, `f#m` are still chords)

New `scale-resolver.test.ts`:

- one octave = seven pitch classes plus closing tonic for major, natural minor,
  harmonic minor, melodic minor
- melodic minor descending = natural minor
- two octaves = 15 notes
- every scale in the vocabulary resolves non-empty, with a spot-checked note
  list per scale against the sheet
- Blues Superscale returns its 10 notes plus tonic
- the three flat-preferred scales are spelled with flats
- unknown scale name still throws

## Out of scope

- Staff-notation rendering of scales. Only `PianoChord` has a scale path today;
  adding one to `StaffNotation` is separate work.
- Automatic up-and-down (ascending-then-descending) scale rendering.
- Scale support in the chord-sheet/progression formats beyond what routing
  through `parseChordDescription` already gives.
