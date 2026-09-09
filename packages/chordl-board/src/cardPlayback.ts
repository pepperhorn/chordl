import {
  parseChordDescription, resolveChord, buildMei,
  degreeToNote, rotateToStartingNote,
} from "@pepperhorn/chordl-core";
import type { PlaybackInstrument } from "@pepperhorn/chordl-core";
import { noteToMidi } from "@pepperhorn/chordl-react";
import { isTextCard } from "./types.js";
import type { BoardItem } from "./types.js";

export interface CardPlayback {
  midi: number[];
  instrument: PlaybackInstrument;
  /**
   * Whether a position in `midi` is also a position in the drawing's own
   * playback order — i.e. whether "note 2 of this chord is sounding" can be
   * handed to the renderer as a highlight.
   *
   * True for every stored voicing (the editor captured exactly what it drew)
   * and for the legacy keyboard path, whose ascending stack is the stack
   * `PianoChord` draws. False for a legacy `display: "guitar"` card: those
   * pitches come from the piano stack, three or four of them, while the panel
   * reads an index as a position in the *fretboard shape's* five or six
   * sounding strings. Index 0 would light the lowest sounding string whatever
   * pitch was heard, so a caller must not highlight from these.
   */
  indicesMatchDiagram: boolean;
}

/** The patch a card sounds in when it does not name one. */
function fallbackInstrument(item: BoardItem): PlaybackInstrument {
  if (item.display !== "guitar") return "acoustic_grand_piano";
  return item.instrument === "ukulele" ? "ukulele" : "electric_guitar_clean";
}

/**
 * What a card should sound.
 *
 * Stored `playbackNotes` win outright — they are the exact voicing the editor
 * captured. Everything else is a card saved before those existed, and is
 * resolved through `buildMei().playbackNotes`: the single resolution the staff
 * engraves from, so the card cannot sound a voicing it is not drawing. A
 * second resolve path here would be inaudible-until-wrong.
 *
 * `rotateToStartingNote` and `degreeToNote` come from chordl-core for the same
 * reason — `PianoChord` calls them too, so "starting on X" cannot rotate the
 * drawing one way and the sound another.
 *
 * Known limits of the legacy path, all of them cards with no stored voicing:
 *
 * - A style hint ("Cmaj7 rootless") picks a voicing from the library in
 *   `PianoChord`; here the plain chord tones are used, so such a card sounds
 *   the ascending stack it would draw without the hint.
 * - `over X` / `N octaves` / an octave shift likewise reach the drawing and
 *   not this.
 * - A `display: "guitar"` card draws a fretboard shape, whose pitches come
 *   from chordl-guitar rather than from this stack at all. That gap is
 *   audible *and* visible: a note index means "the nth sounding string" to
 *   `GuitarChordPanel`, and these indices count a piano stack instead. So
 *   such a card reports `indicesMatchDiagram: false` and callers must not
 *   highlight from it — a highlight that contradicts the sound is worse than
 *   none, because the diagram is the half that looks authoritative.
 *
 * Each of those is a card that sounds a *plainer* voicing of the right chord,
 * not a wrong one, and each disappears the moment the card is opened in the
 * editor and re-saved with `playbackNotes`. Closing them means lifting
 * `PianoChord`'s whole octave resolution out of the component, which is its
 * own piece of work.
 */
export function resolveCardPlayback(item: BoardItem): CardPlayback | null {
  if (isTextCard(item)) return null;
  const instrument = (item.playbackInstrument as PlaybackInstrument | undefined)
    ?? fallbackInstrument(item);
  if (item.playbackNotes?.length) {
    return { midi: item.playbackNotes, instrument, indicesMatchDiagram: true };
  }
  if (!item.nl) return null;
  try {
    const parsed = parseChordDescription(item.nl);
    const resolved = resolveChord(parsed.chordName || item.nl);
    let notes = resolved.notes;
    // A bass degree the chord does not have is the other thing `PianoChord`
    // throws over (`Cmaj7 with the 9th in the bass`), and it is resolved there
    // against the *unrotated* notes, before any "starting on" rotation — so it
    // is checked here in the same order. Without this the card refuses to draw
    // but still sounds: the one card on the board you could hear and not see.
    if (parsed.bassDegree != null && !degreeToNote(resolved.root, parsed.bassDegree, notes)) {
      return null;
    }
    // "starting on the 3rd" names the tone by degree; "starting on E" by name.
    const startingNote = parsed.startingNote
      ?? (parsed.startingDegree != null
        ? degreeToNote(resolved.root, parsed.startingDegree, notes)
        : undefined);
    if (startingNote) {
      const rotation = rotateToStartingNote(notes, startingNote);
      // A chord that has no such note is what `PianoChord` throws over. The
      // card would refuse to draw, so it must not sound either.
      if (rotation.index < 0) return null;
      notes = rotation.notes;
    } else if (parsed.startingDegree != null) {
      return null; // degree the chord does not have — likewise a draw failure
    }
    const midi = buildMei(notes).playbackNotes.map((n) => noteToMidi(n));
    if (!midi.length) return null;
    // See `indicesMatchDiagram`: this stack is the keyboard's, so it indexes
    // the keyboard's drawing and not a fretboard's sounding strings.
    return { midi, instrument, indicesMatchDiagram: item.display !== "guitar" };
  } catch {
    return null;
  }
}
