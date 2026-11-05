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
  Some formula-preserving Altered keys still necessarily contain a double
  accidental; a root selector alone cannot eliminate these.
- Package publishing remains a separate owner step.
