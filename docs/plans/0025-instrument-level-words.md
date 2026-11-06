# Plan 0025 — Instrument and level words in chord input

- **Spec:** ../specs/0025-instrument-level-words.md
- **Base:** main @ 4d43926
- **Verification (whole item):** `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site`

## Approach
Add `INSTRUMENT_RE` and `LEVEL_RE` extractors to `parseChordDescription`, alongside the existing format, size and style extractors. Set `result.instrument` and `result.level`, and add both regexes to the strip chain before residual chord-name extraction. Put the multi-word bass forms before plain `bass`, and make plain `bass` match only when it isn't part of an existing bass-note phrase. Add the optional fields to `ParsedChordRequest` in `chordl-core/src/types.ts`.

In `BoardEditor.tsx`, react to a change in the parsed instrument or level for the current input. Use an effect keyed on those parsed values, not on every keystroke, so manual control changes aren't overwritten while the words stay the same. Map the instrument to `setDisplayMode` and `setGuitarInstrument`, and the level to `setLevel`.

## Tasks

### T1 — parser fields + board wiring (single task, K = 0025)
- **Depends on:** —
- **Route:** implement (default), Codex → reviewed by Claude Opus
- **Owns:** `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/src/types.ts`, `packages/chordl-core/test/natural-language.test.ts`, `packages/chordl-board/src/BoardEditor.tsx`, a new `packages/chordl-board/test/board-editor-instrument-words.test.tsx`, `CHANGELOG.md` (Unreleased entry)
- **May read:** anything
- **Acceptance:** AC1–AC5
- **Verify:** whole-item command above
- **Notes / gotchas:**
  - `bass` collides with the existing bass-note regexes (`BASS_NOTE_RE`, `OVER_BASS_NOTE_RE`, `BASS_DEGREE_RE`). Read them first.
  - "a"/"an" are also the note A (see the comment at the top of natural-language.ts). Don't add filler words that eat roots.
  - Today `ukulele Am` → `E`: the residual extractor finds a root inside "ukulele". Stripping the instrument word must happen before residual extraction.
  - Board tests run under vitest with mocked wrappers. Per earlier lessons, mocked wrappers can certify inert code, so assert on the real Level radio state and display toggle, not on a mock call.
  - Port if you run the dev server: 5200 + 25*10 = 5450, with `--host 0.0.0.0`.

## Merge order
T1

## Risks
- The bass instrument and bass-note phrasing ambiguity (covered by AC3).
- The effect that applies parsed words could fight the user's manual control changes (covered by AC4's "leaves controls alone" check).
