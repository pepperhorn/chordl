import { describe, it, expect, vi, beforeEach } from "vitest";

// Count how many times the WASM module factory actually runs: the whole point
// of prefetching is that it warms the SAME cached toolkit a later render
// awaits, rather than starting a second ~7 MB initialisation.
const created: unknown[] = [];
let failNextModule = false;

vi.mock("verovio/wasm", () => ({
  default: () => {
    if (failNextModule) return Promise.reject(new Error("wasm boom"));
    const mod = { id: created.length };
    created.push(mod);
    return Promise.resolve(mod);
  },
}));

vi.mock("verovio/esm", () => ({
  VerovioToolkit: class {
    mod: unknown;
    options: Record<string, unknown> = {};
    constructor(mod: unknown) { this.mod = mod; }
    setOptions(opts: Record<string, unknown>) { Object.assign(this.options, opts); }
    loadData() { return true; }
    renderToSVG() { return "<svg />"; }
    getPageCount() { return 1; }
  },
}));

// The real one is ~1 MB of base64 font zips.
vi.mock("../src/verovio-fonts.generated", () => ({
  VEROVIO_FONT_ZIPS: { Bravura: "zip-a", Petaluma: "zip-b" },
}));

beforeEach(() => {
  created.length = 0;
  failNextModule = false;
  vi.resetModules();
});

describe("prefetchVerovio", () => {
  it("warms the same cached toolkit a render later awaits", async () => {
    const { prefetchVerovio, getVerovioToolkit } = await import("../src/verovio");
    await prefetchVerovio();
    expect(created.length).toBe(1);

    const [a, b] = await Promise.all([getVerovioToolkit(), getVerovioToolkit()]);
    expect(a).toBe(b);
    // Still one initialisation: the prefetch did not double-load Verovio.
    expect(created.length).toBe(1);
  });

  it("does not double-initialise when fired repeatedly", async () => {
    const { prefetchVerovio } = await import("../src/verovio");
    await Promise.all([prefetchVerovio(), prefetchVerovio(), prefetchVerovio()]);
    expect(created.length).toBe(1);
  });

  it("swallows a failed warm-up and leaves a later load able to retry", async () => {
    const { prefetchVerovio, getVerovioToolkit } = await import("../src/verovio");
    failNextModule = true;
    // Must not reject: a background prefetch has nobody to catch it.
    await expect(prefetchVerovio()).resolves.toBeUndefined();

    failNextModule = false;
    await expect(getVerovioToolkit()).resolves.toBeTruthy();
    expect(created.length).toBe(1);
  });

  it("is exported from the package index", async () => {
    const index = await import("../src/index");
    expect(typeof index.prefetchVerovio).toBe("function");
  });
});
