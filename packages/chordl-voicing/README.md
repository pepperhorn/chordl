# @pepperhorn/chordl-voicing

An open JSON format for chord voicings (fretted, keyboard, bowed), with TypeScript
types, JSON Schemas, a canonical formatter, content hashes, a catalogue validator
and a `chordl-voicing` command line tool.

A **chord file** holds one chord and all of its voicings. A **voicing** records which
notes sound, how they are realized on an instrument, who wrote it, and how it relates
to other voicings (revisions, supersession, duplicates). Files are plain JSON, one per
chord, designed to live in a git repository and be reviewed as diffs.

## Schemas

| Schema id | Describes |
| --- | --- |
| `chordl.chord/1` | A chord file: the chord (`id`, `symbol`, `root`, `quality`, `bass`, `aliases`) and its `voicings` |
| `chordl.voicing/1` | One voicing: `notes`, a `realization`, `provenance`, `relations` and `hashes` |

Both are JSON Schema draft 2020-12, shipped as `schema/chord.schema.json` and
`schema/voicing.schema.json` (also importable as
`@pepperhorn/chordl-voicing/schema/chord.schema.json`).

Chord ids look like `C:maj7` or `C:7/E`: `<root>:<quality>[/<bass>]`. Pitches are
ASCII scientific pitch (`Eb4`, never `E♭4`). Each note carries a jazz degree such as
`I`, `bIII`, `#IV`.

## Realizations

The `realization` of a voicing has a `kind` of `fretted`, `keyboard` or `bowed`.

Fretted. `strings` holds absolute frets (`null` is muted), in chordl-guitar string order:

```json
{
  "kind": "fretted",
  "instrument": "guitar",
  "tuning": ["E2", "A2", "D3", "G3", "B3", "E4"],
  "strings": [null, 3, 2, 0, 0, 0],
  "fingers": [null, 3, 2, null, null, null],
  "baseFret": 1,
  "barres": [],
  "capo": null
}
```

Keyboard. Pitches per hand; `fingering` is optional:

```json
{ "kind": "keyboard", "hands": { "left": ["C3", "G3"], "right": ["E4", "B4"] } }
```

Bowed. One stop per sounding string:

```json
{
  "kind": "bowed",
  "instrument": "violin",
  "tuning": ["G3", "D4", "A4", "E5"],
  "stops": [{ "string": 2, "pitch": "C5", "finger": 2 }],
  "position": 1
}
```

## Library

```ts
import {
  validateChordFileSchema, checkVoicing, formatChordFile, isCanonical, withHashes,
} from "@pepperhorn/chordl-voicing";

const result = validateChordFileSchema(json);
if (!result.ok) console.error(result.errors); // [{ path, message }]
else {
  for (const voicing of result.value.voicings) {
    const { hard, flags } = checkVoicing(voicing); // hard = must fix, flags = review
  }
  const text = formatChordFile(result.value);    // canonical JSON text
}
```

Other exports: `parseChordId`, `formatChordId`, `chordIntervals`, `labelNotes`,
`soundingMidi`, `notesMatchRealization`, `shapeHash`, `pitchHash`, `withHashes`,
`chordFilePath`, `validateCatalogue` and the types (`ChordFile`, `Voicing`,
`Realization`, ...).

Hashes (`hashes.shape`, `hashes.pitch`) cover musical content only, so tier, status
and provenance edits never change them. The exact file form and hash rules are in
[docs/CANONICAL.md](./docs/CANONICAL.md).

## CLI

Run it inside a catalogue checkout (files live under `chords/`):

```sh
npx @pepperhorn/chordl-voicing <command>
```

### new

Create a voicing and add it to the chord's file (creating the file if needed):

```sh
# Fretted: one character per string, or comma-separated; x = muted
chordl-voicing new --chord C:maj7 --instrument guitar --frets x32000 --author gh:alice

# Barre chords: --barre <fret>:<fromString>-<toString>, repeatable.
# Strings are numbered from 0 (the first string in the tuning, thickest on guitar).
# A barre counts as one finger, so a full F shape passes the four-finger check.
chordl-voicing new --chord F:maj --instrument guitar --frets 133211 \
  --barre 1:0-5 --author gh:alice

# Keyboard: --notes "<left> | <right>", pitches space-separated.
# Without a "|", every note goes to the right hand.
chordl-voicing new --chord C:maj7 --instrument piano \
  --notes "C3 G3 | E4 B4" --author gh:alice
```

`--author` is a prefixed id such as `gh:alice`. `--tier` is `community` (default) or
`curated`. Note names and degrees are worked out from the chord, hashes are filled
in, and the voicing is checked before it is written. Bowed voicings are written by
hand.

### format

```sh
chordl-voicing format            # rewrite every file under chords/ to canonical form
chordl-voicing format --check    # print a diff and exit 1 if any file is not canonical
chordl-voicing format chords/C/C__maj7.json
```

### validate

```sh
chordl-voicing validate [--base <dir>] [--licences <file>]
```

Checks schema, canonical form, hashes, notes against realization, and catalogue rules.
With `--base`, also checks history against an earlier checkout (revisions must be
appended, not edited). Exits 1 on any error.

### bundle

```sh
chordl-voicing bundle --out dist --version v2026.10.1
```

Writes `manifest.json`, `catalogue.json` and `by-instrument/<instrument>.json`.
`catalogue.json` holds every revision of every voicing, including retired ones;
`by-instrument/<instrument>.json` and the manifest counts cover live voicings only.

Exit codes: 0 success, 1 failure, 2 usage error.

## Licence

MIT
