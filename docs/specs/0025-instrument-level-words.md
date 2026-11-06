# 0025 — Instrument and level words in chord input

- **Status:** approved
- **Ledger:** 0025 · **Plan:** ../plans/0025-instrument-level-words.md
- **Author:** lead · **Date:** 2026-11-06

## Problem
Typing `ukulele am beginner` on chordl.app shows an **E** chord. `parseChordDescription` (`packages/chordl-core/src/parser/natural-language.ts`) has no concept of instrument or experience-level words. They fall through to the residual chord-name extraction, which in this case finds a root inside the word "ukulele". When the chord comes first (`Am guitar beginner`), the words are silently dropped, so the chord parses but the request is ignored.

## Goals
1. The parser recognises instrument and level words in any position and returns them as structured fields. It strips them before extracting the chord name.
2. The board editor acts on them: an instrument word switches the display (and the frame instrument for fretted/bowed instruments), and a level word sets the Level control.

## Non-goals
- Progression input (`parseProgressionRequest`). Single-chord input only.
- New instruments or levels. Map onto what exists today.
- Persisting anything new. Cards already store `display`, `instrument` and `level`.

## User-visible behaviour
Vocabulary (case-insensitive, whole words only):

| Words | Result |
|---|---|
| `ukulele`, `uke` | instrument `ukulele` |
| `guitar`, `gtr` | instrument `guitar` |
| `bass4`, `4-string bass`, `4 string bass`, `bass guitar` | instrument `bass4` |
| `bass5`, `5-string bass`, `5 string bass` | instrument `bass5` |
| `violin`, `fiddle` | instrument `violin` |
| `piano`, `keys`, `keyboard` | instrument `piano` (back to the keyboard display) |
| `beginner`, `easy`, `basic` | level `beginner` |
| `emerging`, `intermediate` | level `emerging` |
| `established`, `advanced` | level `established` |

- `ukulele am beginner`, `Am ukulele beginner` and `beginner uke Am` all give chord `Am`, instrument `ukulele`, level `beginner`. The board shows the ukulele frame with the Level control on Beginner.
- An instrument word for a frame instrument sets the display mode to `guitar` and the frame instrument to that id. `piano`/`keys`/`keyboard` sets the display mode to `keyboard`.
- A level word with no instrument word only changes the level.
- With no instrument or level word, the current display/instrument/level are left exactly as they are (no reset).
- The words apply only when the **user edits** the input. Opening a saved card must keep its stored display, instrument and level, even if its text contains instrument or level words (review r1).
- Existing phrases that contain a vocabulary word keep their old meaning, e.g. `C with 2 keys on either side` (padding) and `C full keys` (format).
- **Bare `bass` is never an instrument** (human decision, 2026-11-06, review r1). It keeps its existing meanings: the bass-clef hand (`bass C treble E G B`, `bass Cmaj7`, `bass C`) and bass-note phrasing.
- Bass words must not break the existing bass-note phrasing: `C/E`, `C over E`, `C with E in the bass`, `C bass E` (whatever forms the parser supports today) keep parsing as a slash-bass chord and must **not** set instrument `bass4`.

## Constraints
- `chordl-core` must not depend on `chordl-guitar`. Express the instrument as a string union in core types that matches `InstrumentId` values plus `"piano"`.
- Follow the parser's existing "extract, then strip, then take the residual" pattern.
- Don't change behaviour for any existing input: the whole current test suite must still pass unchanged.

## Acceptance criteria
- [ ] AC1: `parseChordDescription` returns `instrument` and `level` for every row of the vocabulary table, in leading, middle and trailing positions, with the correct chord name (unit tests).
- [ ] AC2: `ukulele am beginner` → `{ chordName: "Am", instrument: "ukulele", level: "beginner" }`. `ukulele Am` no longer returns `E` (a regression test).
- [ ] AC3: bass-note phrasing is unchanged and sets no instrument (tests for each bass-note form the parser supports).
- [ ] AC4: in the board editor, typing `ukulele am beginner` switches the display to the ukulele frame and sets Level to Beginner. Typing `piano C` returns to the keyboard display. Input with no such words leaves those controls alone (component tests).
- [ ] AC5: `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site` passes.

## Open questions
None.
