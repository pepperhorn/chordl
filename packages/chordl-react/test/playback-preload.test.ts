import { describe, it, expect, vi } from "vitest";

// Collected by the smplr stub below so a test can assert which patches were
// actually constructed — the point of preloading is that each distinct one is
// fetched exactly once.
const { created } = vi.hoisted(() => ({ created: [] as string[] }));

vi.mock("smplr", () => ({
  Soundfont: class {
    load: Promise<unknown>;
    constructor(_ctx: unknown, opts: { instrument: string }) {
      created.push(opts.instrument);
      this.load = Promise.resolve(this);
    }
    start = vi.fn();
  },
  // The ukulele loads through a separate path that streams an .sf2 over the
  // network. Failing it here is deliberate: it is the realistic failure a
  // preload has to swallow rather than propagate.
  Soundfont2Sampler: class {
    load = Promise.reject(new Error("soundfont fetch failed"));
    start = vi.fn();
  },
}));

vi.mock("soundfont2", () => ({ SoundFont2: class {} }));

// jsdom has no Web Audio, and the patch loader builds a context eagerly.
class StubAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
}
vi.stubGlobal("AudioContext", StubAudioContext);

describe("preloadInstruments", () => {
  it("loads each distinct instrument once", async () => {
    const { preloadInstruments } = await import("../src/audio/playback");

    // Warm one patch on its own first. This doubles as the mock's first
    // resolution of `smplr`: the loader imports it dynamically, and two
    // concurrent dynamic imports of a not-yet-resolved factory mock let one of
    // them through to the real package, which then throws on the stub context.
    // That is a vitest quirk, not a property of the subject.
    await preloadInstruments(["acoustic_grand_piano"]);
    expect(created).toEqual(["acoustic_grand_piano"]);

    created.length = 0;
    await preloadInstruments([
      "electric_guitar_clean",
      "acoustic_grand_piano",
      "electric_guitar_clean",
    ]);
    // The repeated guitar collapsed to one load, and the piano warmed above was
    // not fetched a second time.
    expect(created).toEqual(["electric_guitar_clean"]);
  });

  it("resolves even when a patch fails to load", async () => {
    const { preloadInstruments } = await import("../src/audio/playback");
    await expect(preloadInstruments(["ukulele"])).resolves.toBeUndefined();
  });
});
