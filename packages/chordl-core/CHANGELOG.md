# Changelog

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
