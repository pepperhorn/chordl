import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// What each smplr loader was constructed with, so a test can assert where a
// patch would have been fetched from without touching the network.
const { soundfontOptions, sf2Options } = vi.hoisted(() => ({
  soundfontOptions: [] as Array<Record<string, unknown>>,
  sf2Options: [] as Array<Record<string, unknown>>,
}));

vi.mock("smplr", () => ({
  Soundfont: class {
    load: Promise<unknown>;
    constructor(_ctx: unknown, opts: Record<string, unknown>) {
      soundfontOptions.push(opts);
      this.load = Promise.resolve(this);
    }
    start = vi.fn(() => vi.fn());
  },
  Soundfont2Sampler: class {
    load: Promise<unknown>;
    instrumentNames = ["Ukulele"];
    constructor(_ctx: unknown, opts: Record<string, unknown>) {
      sf2Options.push(opts);
      this.load = Promise.resolve(this);
    }
    loadInstrument = vi.fn(async () => undefined);
    start = vi.fn(() => vi.fn());
  },
}));

vi.mock("soundfont2", () => ({ SoundFont2: class {} }));

class StubAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
}
vi.stubGlobal("AudioContext", StubAudioContext);

async function load() {
  vi.resetModules();
  return import("../src/audio/playback");
}

beforeEach(() => {
  soundfontOptions.length = 0;
  sf2Options.length = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("audio source defaults", () => {
  it("loads General MIDI patches by name, leaving smplr to pick its own host", async () => {
    const { preloadInstruments } = await load();
    await preloadInstruments(["acoustic_grand_piano"]);
    expect(soundfontOptions).toEqual([{ instrument: "acoustic_grand_piano" }]);
  });

  it("loads the ukulele from the package's own soundfonts directory", async () => {
    const { preloadInstruments } = await load();
    await preloadInstruments(["ukulele"]);
    expect(sf2Options).toHaveLength(1);
    expect(String(sf2Options[0].url)).toMatch(/\/soundfonts\/freepats-ukulele-20260811\.sf2$/);
  });
});

describe("configureAudio", () => {
  it("loads a patch from the URL the resolver gives, in the browser's format", async () => {
    const playback = await load();
    const resolver = vi.fn((instrument: string, format: string) => `/sf/${instrument}-${format}.js`);
    playback.configureAudio({ soundfontUrl: resolver });
    await playback.preloadInstruments(["electric_guitar_clean"]);
    const format = playback.preferredSoundfontFormat();
    expect(resolver).toHaveBeenCalledWith("electric_guitar_clean", format);
    // Only instrumentUrl: smplr warns when kit or instrument ride along with it.
    expect(soundfontOptions).toEqual([{ instrumentUrl: `/sf/electric_guitar_clean-${format}.js` }]);
  });

  it("falls back to the default source for an instrument the resolver leaves out", async () => {
    const playback = await load();
    playback.configureAudio({
      soundfontUrl: (instrument) => (instrument === "acoustic_grand_piano" ? "/sf/piano.js" : undefined),
    });
    await playback.preloadInstruments(["acoustic_grand_piano"]);
    await playback.preloadInstruments(["electric_bass_finger"]);
    expect(soundfontOptions).toEqual([
      { instrumentUrl: "/sf/piano.js" },
      { instrument: "electric_bass_finger" },
    ]);
  });

  it("loads the ukulele from the configured URL", async () => {
    const playback = await load();
    playback.configureAudio({ ukuleleSoundfontUrl: "/soundfonts/uke.sf2" });
    await playback.preloadInstruments(["ukulele"]);
    expect(sf2Options[0].url).toBe("/soundfonts/uke.sf2");
  });

  it("merges successive calls; undefined restores a default", async () => {
    const playback = await load();
    playback.configureAudio({ ukuleleSoundfontUrl: "/a.sf2" });
    playback.configureAudio({ soundfontUrl: () => "/x.js" });
    expect(playback.resolveUkuleleSoundfontUrl()).toBe("/a.sf2");
    expect(playback.resolveSoundfontUrl("acoustic_grand_piano", "mp3")).toBe("/x.js");
    playback.configureAudio({ ukuleleSoundfontUrl: undefined, soundfontUrl: undefined });
    expect(playback.resolveUkuleleSoundfontUrl()).toMatch(/\/soundfonts\/freepats-ukulele-20260811\.sf2$/);
    expect(playback.resolveSoundfontUrl("acoustic_grand_piano", "mp3")).toBeUndefined();
  });
});

describe("preferredSoundfontFormat (smplr's own rule)", () => {
  function stubAudio(canPlay: Record<string, string>, userAgent: string) {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
    vi.spyOn(document, "createElement").mockReturnValue({
      canPlayType: (type: string) => canPlay[type] ?? "",
    } as unknown as HTMLElement);
  }

  it("prefers ogg where the browser plays it", async () => {
    const { preferredSoundfontFormat } = await load();
    stubAudio({ "audio/ogg": "probably", "audio/mp3": "probably" }, "Mozilla/5.0 Chrome/140");
    expect(preferredSoundfontFormat()).toBe("ogg");
  });

  it("skips ogg on Safari", async () => {
    const { preferredSoundfontFormat } = await load();
    stubAudio({ "audio/ogg": "maybe", "audio/mp3": "maybe" }, "Mozilla/5.0 Version/18 Safari/605");
    expect(preferredSoundfontFormat()).toBe("mp3");
  });

  it("falls back to mp3 when neither format reports support", async () => {
    const { preferredSoundfontFormat } = await load();
    stubAudio({}, "Mozilla/5.0 Chrome/140");
    expect(preferredSoundfontFormat()).toBe("mp3");
  });
});
