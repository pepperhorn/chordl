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
- Package publishing remains a separate owner step.
