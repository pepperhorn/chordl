/**
 * Index of a note name's diatonic step — its letter — in C..B order.
 *
 * Duplicated from `chordl-react`'s `diatonicStep` (`src/diatonic-step.ts`)
 * rather than shared: this package must not depend on `chordl-react` (it is
 * the other way around — `chordl-react` and `chordl-core` both depend on
 * this package), so importing back would be a cycle. `chordl-react` is the
 * only package that depends on both copies, and it pins them together —
 * see its `diatonic-step-parity` test, which fails if they drift.
 *
 * The step must come from the note's **letter**, not from a sharp-normalised
 * name, because normalising moves the letter: Ab becomes G#, whose letter is
 * G. A G-then-Ab run then looks like it wrapped past B when the music only
 * rose a semitone, and the second note would be pushed an octave too high by
 * a caller that stacks on this.
 */
const WHITE_NOTE_ORDER = ["C", "D", "E", "F", "G", "A", "B"];

export function diatonicStep(name: string): number {
  return WHITE_NOTE_ORDER.indexOf(name.charAt(0).toUpperCase());
}
