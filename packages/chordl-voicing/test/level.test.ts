import { levelForVoicing } from "@pepperhorn/chordl-voicings";
import { it, expect } from "vitest";
import {
  levelForFacts,
  levelForTop3,
  positionFacts,
  INSTRUMENTS,
} from "@pepperhorn/chordl-guitar";
import { levelOf } from "../src/level.js";
import type { Voicing } from "../src/types.js";
it("uses existing fretted experience rules, ignoring stored levels", () => {
  for (const [instrument, frets, barres] of [
    ["guitar", [-1, 3, 2, 0, 1, 0], []],
    ["guitar", [1, 3, 3, 2, 1, 1], [1]],
    ["ukulele", [0, 0, 0, 3], []],
    ["bass4", [-1, 3, 5, 5], []],
    ["guitar-top3", [-1, -1, -1, 5, 5, 5], []],
  ] as const) {
    const cfg = INSTRUMENTS[instrument];
    const pos = {
      frets: [...frets],
      fingers: frets.map(() => 0),
      baseFret: 1,
      barres: [...barres],
    };
    const v = {
      chordId: "C:maj",
      level: "beginner",
      realization: {
        kind: "fretted",
        instrument,
        tuning: cfg.openMidi.map(
          (m) => ["E2", "A2", "D3", "G3", "B3", "E4"][cfg.openMidi.indexOf(m)],
        ),
        strings: frets.map((f) => (f < 0 ? null : f)),
        fingers: frets.map(() => null),
        baseFret: 1,
        barres: barres.map((f) => ({ fret: f, fromString: 0, toString: 5 })),
        capo: null,
      },
    } as unknown as Voicing;
    // Tunings follow the actual instrument, including reentrant ukulele.
    const names = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    if (v.realization.kind === "fretted")
      v.realization.tuning = cfg.openMidi.map(
        (m) => `${names[m % 12]}${Math.floor(m / 12) - 1}`,
      );
    expect(levelOf(v)).toBe(
      instrument === "guitar-top3"
        ? levelForTop3([...frets].slice(-3), 1)
        : levelForFacts(positionFacts(pos, cfg.openMidi, 0)),
    );
  }
});

it("uses keyboard rules for roots, inversions, tensions and octave doublings", () => {
  for (const notes of [
    [60, 64, 67],
    [64, 67, 72],
    [60, 64, 71],
    [60, 64, 66, 70],
    [48, 60, 64, 67, 72],
  ]) {
    const names = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const v = {
      chordId: "C:maj",
      realization: {
        kind: "keyboard",
        hands: {
          left: [],
          right: notes.map((m) => `${names[m % 12]}${Math.floor(m / 12) - 1}`),
        },
      },
    } as unknown as Voicing;
    const lowest = Math.min(...notes);
    const offset = lowest % 12;
    expect(levelOf(v)).toBe(
      levelForVoicing(notes.map((m) => m - lowest + offset)),
    );
  }
});

it("delegates keyboard levels to the existing rules", async () => {
  const { levelForVoicing } = await import("@pepperhorn/chordl-voicings");
  for (const notes of [
    [0, 4, 7],
    [0, 4, 7, 11],
    [0, 4, 7, 14],
    [0, 4, 7, 10, 13],
  ]) {
    const names = [
      "C",
      "C#",
      "D",
      "D#",
      "E",
      "F",
      "F#",
      "G",
      "G#",
      "A",
      "A#",
      "B",
    ];
    const pitches = notes.map(
      (n) => `${names[n % 12]}${4 + Math.floor(n / 12)}`,
    );
    const v = {
      chordId: "C:maj",
      realization: { kind: "keyboard", hands: { left: [], right: pitches } },
    } as unknown as Voicing;
    expect(levelOf(v)).toBe(levelForVoicing(notes));
  }
});
