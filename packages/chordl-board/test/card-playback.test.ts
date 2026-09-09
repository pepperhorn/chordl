import { describe, it, expect } from "vitest";
import { resolveCardPlayback } from "../src/cardPlayback";
import type { BoardItem } from "../src/types";

const chord = (extra: Partial<BoardItem>): BoardItem =>
  ({ id: "a", kind: "chord", nl: "Cmaj7", display: "keyboard", ...extra });

describe("resolveCardPlayback", () => {
  it("prefers the stored pitches verbatim", () => {
    const out = resolveCardPlayback(chord({ playbackNotes: [60, 64, 67, 71], playbackInstrument: "electric_guitar_clean" }));
    expect(out).toEqual({ midi: [60, 64, 67, 71], instrument: "electric_guitar_clean" });
  });

  it("resolves a legacy card from its chord text", () => {
    // Cmaj7 at the staff's own octaves — the same pitches buildMei engraves,
    // which is root position from middle C.
    expect(resolveCardPlayback(chord({})).midi).toEqual([60, 64, 67, 71]);
  });

  it("keeps a rotation the chord text asks for", () => {
    const out = resolveCardPlayback(chord({ nl: "Cmaj7 starting on E" }));
    expect(out!.midi[0] % 12).toBe(4); // E in the bass, not C
    // The whole rotation, not just its bottom note: E G B, then C an octave up.
    expect(out!.midi).toEqual([64, 67, 71, 72]);
  });

  /*
   * The rotation match is by pitch, not by spelling. Bbm's own notes are
   * ["Bb", "Db", "F"], so a literal lookup of "C#" finds nothing and the card
   * sounds root position while `PianoChord` draws the first inversion — a
   * disagreement with nothing on screen to reveal it.
   */
  it("rotates on an enharmonic spelling of a chord tone", () => {
    const out = resolveCardPlayback(chord({ nl: "Bbm starting on C#" }));
    expect(out!.midi[0] % 12).toBe(1); // Db/C# in the bass
  });

  /* `PianoChord` resolves "the 3rd" to a chord tone and rotates onto it. */
  it("rotates on a degree the chord text names", () => {
    const out = resolveCardPlayback(chord({ nl: "Cmaj7 starting on the 3rd" }));
    expect(out!.midi[0] % 12).toBe(4); // E in the bass
  });

  it("picks the guitar patch for a guitar card", () => {
    expect(resolveCardPlayback(chord({ display: "guitar" }))!.instrument).toBe("electric_guitar_clean");
  });

  it("picks ukulele when the card names that instrument", () => {
    expect(resolveCardPlayback(chord({ display: "guitar", instrument: "ukulele" }))!.instrument).toBe("ukulele");
  });

  it("returns null for a text card", () => {
    expect(resolveCardPlayback({ id: "t", kind: "text", title: "Verse" })).toBeNull();
  });

  it("returns null rather than throwing on unparseable text", () => {
    expect(resolveCardPlayback(chord({ nl: "zzzz" }))).toBeNull();
  });

  it("returns null when the chord has no note to start on", () => {
    expect(resolveCardPlayback(chord({ nl: "Cmaj7 starting on F#" }))).toBeNull();
  });

  it("returns null for a chord card with no chord text", () => {
    expect(resolveCardPlayback({ id: "a", kind: "chord" })).toBeNull();
  });
});
