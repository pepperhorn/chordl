# Canonical form and content hashes

## File form

A chord file is canonical when it is exactly the output of `formatChordFile`:

- UTF-8, no BOM, LF line endings, 2-space indent, one trailing newline.
- Keys appear in a fixed order (the property order of the interfaces in `src/types.ts`, exported as `KEY_ORDER`), at every nesting level. Optional keys that are absent stay absent.
- Array order is preserved, except `voicings`, which are sorted by `id` (ascending string order), then by `rev`.
- Unknown keys are a schema error. The formatter never drops them; it leaves them after the known keys.

`isCanonical(text)` strips a BOM, normalises line endings, parses, reformats, and compares the raw text to the result. CRLF or BOM input therefore fails the check, and `expected` is the fixed text. Unparseable JSON returns `{ ok: false, expected: "" }`.

## Hashes

Hashes cover musical content only: the realization's positions and pitches. Status, tier, provenance, relations, fingering and barres never affect them. Both are `"sha256:"` plus 64 lowercase hex characters, computed over the UTF-8 bytes of the canonical string.

### Fret convention

`strings` hold absolute frets, as numbers or `null` for a muted string. `baseFret` is display only and is not hashed. Fret numbers count from the capo: with `capo = 2`, fret 0 sounds two semitones above the open string. The hash includes the capo value, so the same frets with a different capo hash differently.

### Shape hash (`shape/1`)

| Kind | Canonical string |
| --- | --- |
| fretted | `shape/1\|fretted\|<instrument>\|<tuning MIDI numbers in string order, ",">\|capo=<n, 0 if null>\|<frets joined ",", "x" for null>` |
| keyboard | `shape/1\|keyboard\|L=<left MIDI numbers ascending, ",">\|R=<right MIDI numbers ascending, ",">` |
| bowed | `shape/1\|bowed\|<instrument>\|<tuning MIDI numbers in string order, ",">\|<string:midi pairs, sorted by string then midi, ",">` |

Fretted `strings` and `tuning` stay in chordl-guitar string order (not pitch order). Tuning and keyboard pitches are hashed as MIDI numbers, so `Eb2` and `D#2` are equal.

### Pitch hash (`pitch/1`)

`pitch/1|<sounding MIDI numbers ascending, joined ",">`

Sounding pitches come from `soundingMidi`: for fretted, tuning MIDI + fret + capo for each non-muted string. Different shapes that sound the same pitches share a pitch hash.
