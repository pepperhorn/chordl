import { describe, it, expect } from "vitest";
import { Note } from "tonal";
import { VOICING_LIBRARY } from "../src/library.js";
import { voicingPitchClasses, voicingOctaveOffsets } from "../src/query.js";

const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/**
 * `voicingPitchClasses` answers *which* notes a voicing sounds;
 * `voicingOctaveOffsets` answers *where* it puts them. Only the two together
 * are the voicing. A caller that takes the classes alone has to guess the
 * octaves, and no guess made from note names can tell `shell-maj7-tenth`
 * (root and third an octave apart) from `shell-maj7-r3` (root and third
 * adjacent) — both are the pitch classes C and E.
 */
describe("voicingOctaveOffsets", () => {
  it("puts the tenth an octave above the root", () => {
    const tenth = VOICING_LIBRARY.find((v) => v.id === "shell-maj7-tenth")!;
    const third = VOICING_LIBRARY.find((v) => v.id === "shell-maj7-r3")!;

    expect(voicingPitchClasses("C", tenth)).toEqual(voicingPitchClasses("C", third));
    expect(voicingOctaveOffsets("C", tenth)).toEqual([0, 1]);
    expect(voicingOctaveOffsets("C", third)).toEqual([0, 0]);
  });

  it("keeps a close grip close", () => {
    // Bb Eb E Ab — four notes inside a minor seventh, one hand's worth. The
    // offsets are not all zero: the octave boundary falls at C, between the
    // Bb and the Eb, and one crossing is all this grip makes.
    const alt = VOICING_LIBRARY.find((v) => v.id === "rootless-alt-b")!;
    expect(voicingOctaveOffsets("C", alt)).toEqual([0, 1, 1, 1]);

    const names = voicingPitchClasses("C", alt);
    const offsets = voicingOctaveOffsets("C", alt);
    const midis = names.map((n, i) => Note.midi(`${n}${4 + offsets[i]}`)!);
    expect(midis[midis.length - 1] - midis[0]).toBe(10);
  });

  it("is index-parallel to the pitch classes", () => {
    for (const entry of VOICING_LIBRARY) {
      expect(voicingOctaveOffsets("C", entry)).toHaveLength(
        voicingPitchClasses("C", entry).length,
      );
    }
  });

  it("reproduces every entry's declared intervals, in every key", () => {
    for (const entry of VOICING_LIBRARY) {
      const declared = entry.intervals.map((i) => i - entry.intervals[0]);
      for (const root of ROOTS) {
        const names = voicingPitchClasses(root, entry);
        const offsets = voicingOctaveOffsets(root, entry);
        // Put each class back at its offset and measure what was drawn.
        const midis = names.map((n, i) => Note.midi(`${n}${4 + offsets[i]}`)!);
        const placed = midis.map((m) => m - midis[0]);
        expect({ id: entry.id, root, placed }).toEqual({ id: entry.id, root, placed: declared });
      }
    }
  });
});
