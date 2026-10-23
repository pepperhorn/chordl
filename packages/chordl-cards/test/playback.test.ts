import { describe, it, expect } from "vitest";
import { requestFor, sharpPitchClasses } from "../src/faces";
import { playbackFor } from "../src/playback";
import { loadTheme } from "./theme-fixture";

const THEME = loadTheme();
const play = (chord: string, face: Parameters<typeof requestFor>[1]) =>
  playbackFor(requestFor(chord, face, THEME));
const PCS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

describe("playbackFor keyboard faces", () => {
  it("sounds the window's keys, root in octave 3 (chordl's own default register)", () => {
    expect(play("C", "keyboard")).toEqual({ notes: [48, 52, 55], instrument: "acoustic_grand_piano" });
    expect(play("Bm", "keyboard").notes).toEqual([59, 62, 66]);
    expect(play("F#m7", "keyboard").notes).toEqual([54, 57, 61, 64]);
    expect(play("Ebmaj7", "keyboard").notes).toEqual([51, 55, 58, 62]);
  });

  it("sounds the exploded voicing bass-first, and says which notes each hand plays", () => {
    expect(play("C7", "keyboard-hands")).toEqual({
      notes: [48, 52, 58], instrument: "acoustic_grand_piano", hands: { lh: [0], rh: [1, 2] },
    });
    expect(play("C/E", "keyboard-hands").notes).toEqual([52, 55, 60]);
  });

  it("matches every Exploded Triads chord's tones, rising, bass in octave 3", () => {
    const roots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    const qualities = ["", "m", "6", "m6", "7", "maj7", "m7", "aug", "dim", "sus4"];
    for (const chord of roots.flatMap((r) => qualities.map((q) => r + q))) {
      for (const face of ["keyboard", "keyboard-hands"] as const) {
        const { notes } = play(chord, face);
        expect(notes[0], `${chord} ${face}`).toBeGreaterThanOrEqual(48);
        expect(notes[0], `${chord} ${face}`).toBeLessThan(60);
        for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThan(notes[i - 1]);
        const req = requestFor(chord, face, THEME);
        if (req.kind !== "keyboard") throw new Error("keyboard expected");
        expect(notes.map((n) => PCS[n % 12]), chord).toEqual(req.notes.map((n) => n.split(":")[0]));
      }
      expect(play(chord, "keyboard").notes.map((n) => PCS[n % 12])).toEqual(sharpPitchClasses(chord));
    }
  });
});

describe("playbackFor guitar-top3", () => {
  it("strums the sounding strings low to high, naming each one's physical index", () => {
    expect(play("C", "guitar-top3")).toEqual({
      notes: [55, 60, 64], instrument: "electric_guitar_clean", strings: [3, 4, 5],
    });
  });

  it("reads frets against a window that starts above the nut", () => {
    // F#m7 sits at position 10, Ebmaj7 at 8: frets are window-relative.
    expect(play("F#m7", "guitar-top3").notes).toEqual([66, 69, 76]);
    expect(play("Ebmaj7", "guitar-top3").notes).toEqual([63, 67, 74]);
  });

  it("sounds a barred string at the barre's fret", () => {
    const req = requestFor("C", "guitar-top3", THEME);
    if (req.kind !== "guitar") throw new Error("guitar expected");
    const barred = {
      ...req,
      shape: { fingers: [[1, 3], [4, "x"], [5, "x"], [6, "x"]], barres: [{ fromString: 3, toString: 1, fret: 2 }], position: 1 },
    } as typeof req;
    // G string fret 2 (A3), B string fret 2 (C#4), E string finger fret 3 (G4).
    expect(playbackFor(barred).notes).toEqual([57, 61, 67]);
  });
});
