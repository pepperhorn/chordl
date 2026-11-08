# Changelog

## 0.6.1

- Accept ASCII comma-separated alteration brackets after a nonempty chord
  quality, using `b5`, `#5`, `b9`, `#9`, `b11`, `#11`, `b13`, `#13`,
  `add9`, `add11`, `add13`, `addb9`, `add#9`, `add#11`, or `addb13`,
  when the base resolves. Leading `(add...)` is also accepted. Leading
  accidental brackets such as `C(b5)`, `C(#5)`, `C(b9)`, `C(#9)`,
  `C(#11)`, `C(b13)` and `C(b5)/E` still throw; they never alter the root.
- Strip the complete alteration tail in the fallback. Altered degrees replace
  their natural degree, so `b5` / `#5` replace the fifth, including in plain
  `7b9b5` / `7#9b5` forms; `b5` is kept as `5d`, not reinterpreted as `#11`.
- Catalogue parity is checked on all 15 roots for every bracketed canonical,
  display and alias spelling. Exactly these catalogue suffixes resolve:

  ```text
  (add9), 6(add9)
  7(b5), 7(#5), 7(b9), 7(#9), 7(b9,b5), 7(b9,#5), 7(#9,b5),
  7(#9,#5), 7(#11,b9), 7(#11,b9,#5), 7(#11,#9), 7(#11,#9,#5)
  9(b5), 9(#5), 9(#11), 9(#11,#5)
  13(b5), 13(#5), 13(b9), 13(#9), 13(b9,b5), 13(b9,#5),
  13(#9,b5), 13(#9,#5), 13(#11), 13(#11,#5), 13(#11,b9), 13(#11,#9)
  maj7(b5), maj7(#5), maj7(b9), maj7(#9)
  maj9(b5), maj9(#5), maj9(#11), maj9(#11,#5)
  maj13(#11), maj13(#11,#5)
  m(b5), m(#5), m(add9), m7(b5), m7(#5), m7(b9), m7(add11),
  m9(b5), m9(#5), m9(#11), m11(b5)
  m7b5(b9), m7(b5,b9), dim7(b9), °7(b9)
  ```

  Other bracketed catalogue spellings throw, including slash-separated lists,
  Unicode accidentals, minor-major/suspended/omit parentheses, and `ø7(b9)`.
  `maj13(#5)`, `m13(b5)` and `m13(#5)` explicitly throw because Tonal's base
  omits the catalogue's natural eleventh. Unaltered `maj13`/`m13`
  retain their existing semantics. Slash basses that need the fallback
  remain unsupported.

## 0.6.0

- Add a host-supplied scale library: `ScaleDef` and `StepToken`, interval-aware
  spelling, circular step validation, degree labels, relative and parallel modes,
  excerpts and demonstration cards.
- Add seven-note diatonic triads, sevenths, and ninths with Roman numerals,
  chord symbols, and CRF `chords.slug` values. No catalogue or CMS dependency.
- Export the new API from core and pass it through chordl-react. Existing
  `resolveScale` behaviour is unchanged.
- Excerpts use inclusive, one-based degree ranges; degrees wrap into later
  octaves. Extra octaves extend the upper endpoint by one scale length each.
  Descending reverses that range; up-down mirrors it without repeating the peak.
- Review r1: diatonic Roman numerals now retain formula degree accidentals
  (Unicode ♭/♯); parent lookup preserves letters except for impractical parent
  keys, with flat ties on fallback. Relative demos rotate parent spelling.
- Add the non-breaking `preferredRoot(pc, def?)` form to rank actual scale
  spellings, favoring fewer double accidentals and fewer total accidentals.
  The seed's Altered formula (`1 b2 #2 3 b5 #5 b7`) necessarily yields
  double-accidental chord roots in Db, Eb, E, F#, Ab, and B: 30 of 5,292
  mode/key/stack rows. These are accepted for T10's missing-chord list.
- Review r2: preserve multiple degree alterations (`bb7` → `♭♭VII`) in
  degree labels and Romans. Align the Altered fixture to the seed and test
  the complete matrix against the exact accepted double-accidental cases.
- Package publishing remains a separate owner step.
