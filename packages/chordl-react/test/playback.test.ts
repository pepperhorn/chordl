import { describe, expect, it } from "vitest";
import { arpeggioDelayMs, buildPlaybackEvents, noteToMidi, toAscendingNotes } from "../src/audio/playback";

describe("playback timeline", () => {
  it("converts the configured sixteenth-note BPM to a delay", () => {
    expect(arpeggioDelayMs(120)).toBe(125);
    expect(arpeggioDelayMs(60)).toBe(250);
  });

  it("schedules an arpeggio and gives each attack its own visual window", () => {
    const events = buildPlaybackEvents([60, 64, 67], "arpeggio", 10, 120, 1.5);
    expect(events.map((event) => event.time)).toEqual([10, 10.125, 10.25]);
    expect(events.map((event) => event.visualEnd)).toEqual([10.125, 10.25, 10.5]);
  });

  it("schedules a block at one time with all indices preserved", () => {
    const events = buildPlaybackEvents(["C4", "E4", "G4"], "block", 3);
    expect(events.map((event) => event.time)).toEqual([3, 3, 3]);
    expect(events.map((event) => event.index)).toEqual([0, 1, 2]);
  });

  it("preserves explicit octaves and computes MIDI", () => {
    expect(toAscendingNotes(["B", "D", "F"], 3)).toEqual(["B3", "D4", "F4"]);
    expect(noteToMidi("C4")).toBe(60);
    expect(noteToMidi("Bb3")).toBe(58);
  });
});
