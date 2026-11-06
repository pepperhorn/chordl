# Handoff: adhoc — "How to play" text for every shape (chords lead → chordl lead)

- **Date:** 2026-11-06 · **Type:** dispatch (cross-project) · **Status:** open
- **Ledger:** not assigned; take your next ID
- **Requested by:** Shaun, 2026-11-06. Consumer: crf-chords item 0027 (`pepperhorn/crf-chords` `docs/specs/0027-how-to-play-text.md`).

## Goal

Add one deterministic function to `@pepperhorn/chordl-cards` that turns a chord face's voicing into plain-English text. The text says how to play the shape and how to read its diagram, written for beginner and emerging players. One source then serves the chord site's player, read-aloud (text-to-speech), and, later, chordcards and openchords.

Shaun's example, Am on ukulele (`0 0 0 2`, with the 2nd finger on the G string):

> Place your 2nd finger on the 2nd fret of the G string (the one closest to you). All the other strings are open (the big O).

## Shape of the API (proposed; refine as you see fit)

```ts
describeShape(chord, face: CardFace, opts?): {
  play: string[];   // steps, in the order you'd place fingers
  read: string[];   // how to read this diagram type (short, reusable)
  text: string;     // play + read for display, with accidentals as glyph-ready names
  spoken: string;   // the same for text-to-speech: "B flat", "second fret", no symbols
}
```

- **Input:** the same placement or playback the card draws, from `positions.ts` and `playback.ts` (fingers, `baseFret`, barres, muted strings, keyboard notes and hands). The text must always match the diagram the player shows for that face and position.
- **Deterministic:** templates only, no AI, and pure, so it can run at build time and in tests. Note names use your accidental rules: the name the card prints, plus the spoken twin.

## Wording rules

**Fretted** (`guitar`, `guitar-top3`, `ukulele`, `bass4`):
- Name each fretted note by finger, fret and string, for example "2nd finger, 2nd fret, G string".
- Name strings by tuning letter plus where they are physically, as you hold the instrument, so it works for re-entrant ukulele: the diagram's left string is the one closest to your face.
- For guitar, the low E is "the thickest string".
- Open strings: "play open (the O)". Muted strings: "don't play this string (the X)".
- A barre: "lay your 1st finger flat across strings … at fret N".
- When `baseFret` is above 1: "this shape starts at fret N (the number beside the diagram)".
- If finger data is missing, say "any finger". Never invent a finger.

**Keyboard** (`keyboard`, `keyboard-hands`):
- List the keys from low to high, with which hand plays each.
- For `keyboard-hands`: the left hand plays the root, and the right hand plays the rest.
- Suggest fingers only for a plain three-note shape in one hand: thumb, middle and little finger (1–3–5). Otherwise give the keys only.
- Point to the coloured dots and to which dot is the root.

**Reading the diagram** (`read`): one short block per diagram type.
- **Fretboard:** vertical lines are strings, horizontal lines are frets, the thick top line is the nut, numbered dots are fingers, O means open and X means don't play.
- **Keyboard:** the coloured dots are the keys to press, and the root colour matches the card.

**Tone:** short sentences, "you", reading age about 8–10. Use ordinal words in `spoken` ("second fret"). Never use a letter b for a flat.

## Acceptance

- [ ] Golden tests:
  - Am on ukulele, matching Shaun's example in meaning;
  - C major on guitar (open, with a muted low E);
  - F major on guitar (full barre);
  - a shape with `baseFret` above 1;
  - C major on keyboard;
  - C major on `keyboard-hands`;
  - one chord with a flat, such as Bb, checking the glyph name in `text` and "B flat" in `spoken`.
- [ ] A property test: for every catalogue face the model can build, `describeShape` returns non-empty text and never throws, or it omits the face exactly as `facesFor` does.
- [ ] Exported from the package index, with a changeset or version bump so crf-chords can re-vendor it (`pnpm vendor:chordl`).

## Follow-ups (not this task)

- chordcards may print the text, or store it per face.
- openchords could publish the English text with each voicing (see chordcards#35 for ratings). A translation key per template would make other languages possible later.
