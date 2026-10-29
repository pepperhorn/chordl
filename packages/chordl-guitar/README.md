# Guitar voicing generation and review

`guitarPositionFor(spelledChord, options?)` first validates chords-db positions,
then tries the regular power-chord shape, then ranks an exhaustive playable
candidate set. `generateGuitarVoicings(notes, options?)` exposes that ranked set.

```ts
const position = guitarPositionFor(
  { root: "A", pitchClasses: ["A", "C#", "Eb", "G", "Bb", "F#"] },
  { level: 3 },
);
// A13(b9,b5): a rootless grip can retain 3, b5, b7, b9, 13.
// position.review.reasons includes "omits:1" and "rootless".
```

The default teaching level is **2**. Levels 0–2 always retain the root. At
level 3, the root may be omitted from chords with six or more required tones,
from five-tone upper chords over a slash bass (including the formerly missing
Ab9/Eb), or from any five-tone chord with an explicit `{ comping: true }`.
A rootless grip must put a third/seventh lowest or sound the written slash bass
lowest. A rooted grip still puts the root/written slash bass lowest. A slash
bass equal to the root cannot be omitted. `rootless` and `omitted` disclose
root omissions; a renderer should explain “root left out; the bass player has
it”. Thirds, sevenths and named alterations are preserved in dense chords.

Natural 9 remains required under #11 alone. It is optional under a natural 11
or 13. These are spelling-aware rules: #11 differs from b5 even when the pitch
classes coincide.

Ranking penalizes register-dependent low seconds/thirds and minor ninths,
inner-string basses, wide finger reaches, long barres, high positions (convex
cost above fret 9), and opens under a high hand. Five-tone and larger chords
have no six-string bonus. These costs rank compromises; they do not certify
playability for a particular hand or enforce the future level-specific tiers.
The top tension need not be the highest voice.

Every returned position, including validated library shapes, carries `review`:

- `origin`: `chords-db`, `template:power-chord`, or `search`.
- `level`: requested teaching level, default 2.
- `reasons`: omission, register, dissonance, hand geometry and rejected-library
  reason codes (`ReasonCode` is exported). Empty means no measured warning.
- `confidence`: deterministic attention heuristic in 0–1, **not a probability**
  or teacher approval. Unflagged search starts at 0.88, library/template at 0.98.
- `needsReview`: `reasons.length > 0 || confidence < 0.8`.
- `reviewKey`: stable chord-constraint/level/absolute-grip/fingering identity.
  Group by this key to review enharmonic twins once (Bb9/C# and Bb9/Db, for
  example). Different fingerings or levels remain separate review items.

The key deduplicates review work without requiring a catalogue slug or a
stateful registry, and without marking otherwise clean twins as warnings.
The root's pitch class and each tone's degree/role remain in the key; merely sharing
an unordered pitch set does not conflate different bass or omission policies.
A non-chord bass is distinct from a seventh (which may double), even if both
spellings produce the same pitch set. No template origin is claimed for brute-force search results.

This package supplies metadata. Card/manifest consumers must forward it and
pass the teaching level; existing card rendering is unchanged.

## Reproduce the independent-oracle comparison

From the repository root, with the existing review outputs available:

```sh
node_modules/.bin/tsx packages/chordl-guitar/scripts/compare-voicings.mts \
  --plain /path/to/plain/verdicts.json \
  --slash /path/to/slash/verdicts.json \
  --missing /path/to/missing38.json \
  --out /path/to/generator-comparison \
  --baseline-ref d307e3b378c6864cd61fc39f6571cf0ee1a81586
```

Both versions regenerate all 3,157 oracle rows. The script refuses baseline
shape/fingering mismatches, validates new pitch coverage, reports changed
`replace` and `accept` rows separately, counts all 38 recoveries, and writes
review distributions, raw JSON and an HTML contact sheet. Comparison uses
explicit level 3; the default remains root-preserving level 2. Original verdicts
judge the old shapes: a changed `accept` is a regression watch item, and a
changed `replace` still needs a teacher's playing/listening check.

Package checks: `pnpm --filter @pepperhorn/chordl-guitar test:run` and
`pnpm --filter @pepperhorn/chordl-guitar build`.
