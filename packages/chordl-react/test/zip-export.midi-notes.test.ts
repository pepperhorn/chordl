import { describe, expect, it, vi } from "vitest";
import { generateMidiFile } from "@pepperhorn/chordl-core";

describe("generateMidiFile midiNotes", () => {
  it("writes exact MIDI numbers in order, ignoring note names", () => {
    const midi = generateMidiFile({ notes: ["C", "E"], midiNotes: [67, 60, 64, 72] });
    const ons: number[] = [];
    for (let i = 14; i < midi.length - 2; i++) if (midi[i] === 0x90 && midi[i + 2] === 90) ons.push(midi[i + 1]);
    expect(ons).toEqual([67, 60, 64, 72]);
  });

  it("is unchanged for name-only callers", () => {
    const named = generateMidiFile({ notes: ["C4", "E4", "G4"] });
    const exact = generateMidiFile({ notes: [], midiNotes: [60, 64, 67] });
    expect(Array.from(named)).toEqual(Array.from(exact));
  });
});

describe("generateWav with MIDI numbers", () => {
  it("hands smplr the exact numbers, low to high", async () => {
    const started: Array<string | number> = [];
    vi.resetModules();
    vi.doMock("smplr", () => ({
      Soundfont: class {
        load = Promise.resolve();
        start({ note }: { note: string | number }) { started.push(note); }
      },
    }));
    class FakeOffline {
      constructor(public ch: number, public length: number, public sampleRate: number) {}
      async startRendering() {
        return { numberOfChannels: 1, sampleRate: this.sampleRate, length: 1, getChannelData: () => new Float32Array(1) };
      }
    }
    vi.stubGlobal("OfflineAudioContext", FakeOffline);
    const { generateWav } = await import("../src/audio/wav-export");
    const wav = await generateWav([67, 60, 64, 72], "block");
    expect(started).toEqual([60, 64, 67, 72]);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    vi.unstubAllGlobals();
    vi.doUnmock("smplr");
  });
});
