import { describe, it, expect, vi } from "vitest";
import { loadTheme } from "./theme-fixture";

/**
 * The keyboard note-label alignment guard, and why it needs a file of its own.
 *
 * `keyboardNoteLabels` and `handsNoteLabels` zip two lists that are built by
 * different routes: the note NAMES come from the chord's spelling
 * (chordl-core's `resolveChord`, via `chordNotes`), the x positions from the
 * keys chordl's own `computeKeyboard` resolved for the window
 * (`keyCentresFor`). Nothing makes them the same length. Zipping past the end
 * of the centres yields `x: undefined`, which reaches the sheet as `x="NaN"`
 * and takes the label off the printed card — no exception, no warning, just a
 * keyboard with a note name missing, which is exactly what chordcards' DESIGN.md "fail
 * loudly, never print thin" rule forbids.
 *
 * The two lists agree for every chord this deck can currently render, which is
 * the whole difficulty: there is no input that reproduces the disagreement, so
 * the only way to test the guard is to introduce one. `keyCentresFor` is
 * mocked to drop its last entry — the shape of the failure a chordl change or
 * a new quality would produce — and the mock has to be module-wide, hence the
 * separate file: test/faces.test.ts checks real geometry through the same
 * module and must keep the real geometry.
 */
vi.mock("../src/keyboard-window", async (importOriginal) => {
  const real = await importOriginal<typeof import("../src/keyboard-window")>();
  return {
    ...real,
    keyCentresFor: (...args: Parameters<typeof real.keyCentresFor>) =>
      real.keyCentresFor(...args).slice(0, -1),
  };
});

const { keyboardNoteLabels, handsNoteLabels } = await import("../src/faces");

const THEME = loadTheme();

describe("keyboard note labels that outnumber their keys", () => {
  it("throws naming the chord rather than emitting a label with no key", () => {
    // Bm has three tones and the mock leaves two centres, so the third label
    // would print at x="NaN" — i.e. not at all.
    expect(() => keyboardNoteLabels("Bm", THEME)).toThrow(/"Bm"/);
    expect(() => keyboardNoteLabels("Bm", THEME)).toThrow(/3 note name\(s\) against 2/);
  });

  it("throws for the hands face's labels too", () => {
    // Three names, two centres: the third tone would print at x="NaN".
    expect(() => handsNoteLabels("C", THEME)).toThrow(/"C"/);
    expect(() => handsNoteLabels("C", THEME)).toThrow(/3 note name\(s\) against 2/);
  });
});
