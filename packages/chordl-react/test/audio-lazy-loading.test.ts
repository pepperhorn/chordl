import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("audio dependency loading", () => {
  const imported = vi.fn();
  const start = vi.fn((_event: { note: string | number; time: number; duration: number }) => vi.fn());
  const rendered = vi.fn();
  const constructed = vi.fn();
  let finishLoading: () => void;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    const load = new Promise<void>((resolve) => { finishLoading = resolve; });
    vi.doMock("smplr", () => {
      imported();
      return {
        Soundfont: class {
          load = load;
          start = start;
          constructor(context: unknown, options: unknown) {
            constructed(context, options);
          }
        },
      };
    });
    vi.stubGlobal("OfflineAudioContext", class {
      constructor(public numberOfChannels: number, public length: number, public sampleRate: number) {}
      async startRendering() {
        rendered();
        return {
          numberOfChannels: this.numberOfChannels,
          length: this.length,
          sampleRate: this.sampleRate,
          getChannelData: () => new Float32Array(this.length),
        };
      }
    });
    vi.stubGlobal("AudioContext", class {
      state = "running";
      currentTime = 0;
    });
  });

  afterEach(() => {
    vi.doUnmock("smplr");
    vi.unstubAllGlobals();
  });

  it("does not import smplr when export/playback modules or pure helpers are used", async () => {
    await import("../src/audio/zip-export");
    const { toAscendingNotes, buildPlaybackEvents } = await import("../src/audio/playback");
    expect(toAscendingNotes(["C", "E", "G"])).toEqual(["C4", "E4", "G4"]);
    expect(buildPlaybackEvents([60], "block", 0)).toHaveLength(1);
    expect(imported).not.toHaveBeenCalled();
    expect(constructed).not.toHaveBeenCalled();
  });

  it.each(["block", "arpeggio"] as const)("loads smplr on %s WAV export and waits for samples", async (mode) => {
    const { generateWav } = await import("../src/audio/wav-export");
    expect(imported).not.toHaveBeenCalled();
    const pending = generateWav([67, 60, 64], mode);
    await vi.waitFor(() => expect(constructed).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(imported).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    expect(rendered).not.toHaveBeenCalled();
    finishLoading();
    const wav = await pending;
    expect(start.mock.calls.map(([event]) => event)).toEqual([60, 64, 67].map((note, i) => ({
      note, time: mode === "arpeggio" ? i * 0.12 : 0, duration: 2.5,
    })));
    expect(rendered).toHaveBeenCalledTimes(1);
    const header = new DataView(wav.buffer);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
    expect(header.getUint16(22, true)).toBe(2);
    expect(header.getUint32(24, true)).toBe(44100);
    expect(header.getUint32(40, true)).toBe(wav.length - 44);
  });

  it("loads smplr on playback and waits for samples before scheduling", async () => {
    const { startPlayback } = await import("../src/audio/playback");
    expect(imported).not.toHaveBeenCalled();
    const pending = startPlayback([60, 64], { mode: "block" });
    await vi.waitFor(() => expect(constructed).toHaveBeenCalledTimes(1), { timeout: 5000 });
    expect(imported).toHaveBeenCalledTimes(1);
    expect(start).not.toHaveBeenCalled();
    finishLoading();
    const controller = await pending;
    controller.cancel();
    await controller.completion;
    expect(start).toHaveBeenCalledTimes(2);
  });
});
