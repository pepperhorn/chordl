import { describe, expect, it } from "vitest";
import {
  KEYBOARD_WHITE_KEYS,
  MIN_CONTEXT_KEYS,
  keyIndicesFor,
  keyboardWindow,
  voiceAscending,
} from "../src/keyboard-window";

/** chordcards decks/beginner-20.json, in card order. */
const DECK_CHORDS: string[] = [
  "C", "G", "D", "A", "Em", "Am", "Dm", "E", "C7", "G7",
  "Bm", "F", "D7", "E7", "A7", "Am7", "Dm7", "Em7", "Fmaj7", "Gm",
];

/** Sharp-spelled root-position tones, mirroring src/diagrams.ts's sharpPitchClasses. */
const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const PC: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};
const INTERVALS: Record<string, number[]> = {
  "": [0, 4, 7], m: [0, 3, 7], "7": [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
};
function tonesOf(chord: string): string[] {
  const [, root, quality] = chord.match(/^([A-G][#b]?)(.*)$/)!;
  return INTERVALS[quality.trim()].map((i) => PC_NAMES[(PC[root] + i) % 12]);
}

describe("voiceAscending", () => {
  it("stacks tones upward instead of wrapping within one octave", () => {
    // Bm is the chord that exposed the bug: as bare pitch classes it rendered
    // D-F#-B (a first inversion) because D and F# come before B in the octave.
    const semitones = voiceAscending(["B", "D", "F#"]);
    expect(semitones[0]).toBeLessThan(semitones[1]);
    expect(semitones[1]).toBeLessThan(semitones[2]);
    // D and F# are lifted an octave above B, not left below it.
    expect(semitones[1] - semitones[0]).toBe(3); // minor third
    expect(semitones[2] - semitones[0]).toBe(7); // perfect fifth
  });

  it("keeps a C-rooted chord inside one octave", () => {
    const semitones = voiceAscending(["C", "E", "G"]);
    expect(semitones[2] - semitones[0]).toBe(7);
  });

  it("throws on an unknown pitch class rather than voicing it silently", () => {
    expect(() => voiceAscending(["H"])).toThrow(/unknown pitch class/);
  });
});

describe("keyboardWindow", () => {
  it("gives every deck chord at least the guaranteed context on both sides", () => {
    for (const chord of DECK_CHORDS) {
      const w = keyboardWindow(tonesOf(chord), chord);
      expect(w.padLeft, `${chord} left pad`).toBeGreaterThanOrEqual(MIN_CONTEXT_KEYS);
      expect(w.padRight, `${chord} right pad`).toBeGreaterThanOrEqual(MIN_CONTEXT_KEYS);
    }
  });

  it("renders the same width on every card", () => {
    for (const chord of DECK_CHORDS) {
      expect(keyboardWindow(tonesOf(chord), chord).size).toBe(KEYBOARD_WHITE_KEYS);
    }
  });

  it("octave-qualifies every highlight key", () => {
    for (const chord of DECK_CHORDS) {
      for (const hk of keyboardWindow(tonesOf(chord), chord).highlightKeys) {
        expect(hk, `${chord}: "${hk}" must carry an octave`).toMatch(/^[A-G]#?:\d+$/);
      }
    }
  });

  it("throws rather than cropping a chord too wide for the window", () => {
    // A two-octave stack: far wider than any quality the deck supports, and
    // exactly the case that must fail loudly rather than lose a tone off-card.
    expect(() => keyboardWindow(["C", "E", "G", "C", "E", "G"], "Cwide")).toThrow(
      /spans \d+ white keys/,
    );
  });
});

describe("chord tones land in ascending order on the real keyboard", () => {
  // This is the regression guard for the original defect. It does not trust
  // keyboard-window's own arithmetic: it asks chordl's computeKeyboard where
  // each tone actually sits, so a future change that scatters the chord across
  // the range again fails here.
  it.each(DECK_CHORDS)("%s reads root-first, left to right", (chord) => {
    const indices = keyIndicesFor(keyboardWindow(tonesOf(chord), chord));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i], `${chord}: tone ${i} must sit right of tone ${i - 1}`)
        .toBeGreaterThan(indices[i - 1]);
    }
  });

  it("would have caught the old bare-pitch-class behaviour for Bm", () => {
    // Sanity-check the guard itself: the pre-fix rendering put D and F# left of
    // B. Asserting the fixed window disagrees with that ordering proves the
    // test above is measuring the thing that actually broke.
    const w = keyboardWindow(["B", "D", "F#"], "Bm");
    const [b, d, fSharp] = keyIndicesFor(w);
    expect(b).toBeLessThan(d);
    expect(d).toBeLessThan(fSharp);
  });
});

describe("keyboardWindow explicit semitones", () => {
  it("defaults to voiceAscending when none are given", () => {
    const pcs = ["C", "E", "G"];
    expect(keyboardWindow(pcs, "C")).toEqual(keyboardWindow(pcs, "C", undefined, voiceAscending(pcs)));
  });

  it("uses the semitones it is given", () => {
    const base = voiceAscending(["C"])[0];
    const w = keyboardWindow(["C", "E"], "C", { whiteKeys: 16, minContextKeys: 1 }, [base, base + 16]);
    expect(w.highlightKeys).toHaveLength(2);
    expect(w.highlightKeys[1].startsWith("E:")).toBe(true);
  });
});
