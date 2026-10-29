// The full-catalogue faces: the six-string guitar face (chords-db, checked, or
// a generated voicing flagged for teacher review) and the plain keyboard for
// every catalogue chord and slash chord, widened where 13 keys cannot hold it.
import { describe, expect, it } from "vitest";
import { INSTRUMENTS, guitarPositionFor, positionToMidi } from "@pepperhorn/chordl-guitar";
import { spelledChord } from "../src/catalogue";
import {
  faceNoteNames, keyboardNoteLabels, requestFor, type GuitarFaceRequest, type KeyboardFaceRequest,
} from "../src/faces";
import { keyIndicesFor } from "../src/keyboard-window";
import { playbackFor } from "../src/playback";
import { loadTheme } from "./theme-fixture";

const THEME = loadTheme();
const guitar = (chord: string) => requestFor(chord, "guitar", THEME) as GuitarFaceRequest;
const keyboard = (chord: string) => requestFor(chord, "keyboard", THEME) as KeyboardFaceRequest;

describe("guitar face (six strings)", () => {
  it("takes a checked chords-db shape where there is one", () => {
    const req = guitar("C");
    expect(req).toMatchObject({ kind: "guitar", instrument: "guitar", generated: false, source: "chords-db", omitted: [] });
  });

  it("falls back to a generated voicing, flagged with what it leaves out", () => {
    const req = guitar("C13(#11)");
    expect(req.generated).toBe(true);
    expect(req.source).toBe("generated");
    expect(Array.isArray(req.omitted)).toBe(true);
  });

  it("works for slash chords, with the bass lowest", () => {
    const req = guitar("D7/C");
    const pb = playbackFor(req);
    expect(pb.notes[0] % 12).toBe(0);
    expect(Math.min(...pb.notes)).toBe(pb.notes[0]);
  });

  it("sounds exactly the position's strings, low to high", () => {
    for (const chord of ["C", "F#m7", "Bb13", "C7(b9,#5)", "Abmaj7/C", "E5"]) {
      const p = spelledChord(chord, { strict: true });
      const pos = guitarPositionFor(p)!;
      expect(playbackFor(guitar(chord)).notes, chord).toEqual(positionToMidi(pos, INSTRUMENTS.guitar.openMidi));
    }
  });

  it("throws, naming the chord, where no position exists", () => {
    expect(() => guitar("C13(b9,#5)")).toThrow(/no six-string guitar position for "C13\(b9,#5\)"/);
    expect(() => guitar("Cfoo")).toThrow(/unsupported/);
  });
});

describe("plain keyboard face, whole catalogue", () => {
  it("keeps the theme's 13 keys where the chord fits with its context", () => {
    const req = keyboard("C9");
    expect(req.size).toBe(13);
    expect(faceNoteNames("C9", "keyboard")).toEqual(["C", "E", "G", "Bb", "D"]);
  });

  it("widens to the smallest window with one key of context when 13 cannot hold it", () => {
    const req = keyboard("C13");
    // C up to the A an octave and a sixth above: 13 white keys, +1 either side.
    expect(req.size).toBe(15);
    const idx = keyIndicesFor({ startFrom: req.startFrom as never, size: req.size, highlightKeys: req.notes, padLeft: 0, padRight: 0 }, req.format);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });

  it("puts a slash bass directly below the upper chord in root position", () => {
    const req = keyboard("D7/C");
    expect(req.notes.map((n) => n.split(":")[0])).toEqual(["C", "D", "F#", "A", "C"]);
    const idx = keyIndicesFor({ startFrom: req.startFrom as never, size: req.size, highlightKeys: req.notes, padLeft: 0, padRight: 0 }, req.format);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
    expect(keyboardNoteLabels("D7/C", THEME).map((l) => l.text)).toEqual(["C", "D", "F#", "A", "C"]);
    expect(playbackFor(req).notes).toEqual([48, 50, 54, 57, 60]);
  });

  it("labels with the catalogue's printed spelling: doubles simplified, the dim7 6th kept", () => {
    // Double accidentals are printed simplified (Bbb -> A, Dbb -> C).
    expect(faceNoteNames("Gbdim7", "keyboard")).toEqual(["Gb", "A", "C", "Eb"]);
    expect(faceNoteNames("Ebdim7", "keyboard")).toEqual(["Eb", "Gb", "A", "C"]);
    expect(faceNoteNames("C#", "keyboard")).toEqual(["C#", "E#", "G#"]);
    expect(keyboard("G#aug").notes.map((n) => n.split(":")[0])).toEqual(["G#", "C", "E"]);
  });
});
