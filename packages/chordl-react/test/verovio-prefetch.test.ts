import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Count how many times the WASM module factory actually runs: the whole point
// of prefetching is that it warms the SAME cached toolkit a later render
// awaits, rather than starting a second ~7 MB initialisation.
const created: unknown[] = [];
// How many *attempts* to fail, counted down as they happen. A boolean read at
// call time would be useless here: `initToolkit` awaits three dynamic imports
// before it ever reaches the module factory, so a test that flips a flag right
// after starting a load has already flipped it back by then.
let failAttempts = 0;
/** Every call of the WASM module factory, failed ones included. */
let attempts = 0;
// Lets a test fail the *engraving* rather than the toolkit, which must not be
// answered by re-initialising Verovio.
let failLoadData = false;

vi.mock("verovio/wasm", () => ({
  default: () => {
    attempts += 1;
    if (failAttempts > 0) {
      failAttempts -= 1;
      return Promise.reject(new Error("wasm boom"));
    }
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
    loadData() { return !failLoadData; }
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
  failAttempts = 0;
  attempts = 0;
  failLoadData = false;
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
    failAttempts = 1;
    // Must not reject: a background prefetch has nobody to catch it.
    await expect(prefetchVerovio()).resolves.toBeUndefined();

    await expect(getVerovioToolkit()).resolves.toBeTruthy();
    expect(created.length).toBe(1);
  });

  it("is exported from the package index", async () => {
    const index = await import("../src/index");
    expect(typeof index.prefetchVerovio).toBe("function");
  });
});

describe("isVerovioReady", () => {
  it("is false until the cached toolkit promise has resolved", async () => {
    const { isVerovioReady, getVerovioToolkit } = await import("../src/verovio");
    expect(isVerovioReady()).toBe(false);
    const pending = getVerovioToolkit();
    // In flight is not ready: the label this gates is about the download.
    expect(isVerovioReady()).toBe(false);
    await pending;
    expect(isVerovioReady()).toBe(true);
    // Asking must not start a load of its own.
    expect(created.length).toBe(1);
  });

  it("stays false after a failed attempt", async () => {
    const { isVerovioReady, getVerovioToolkit } = await import("../src/verovio");
    failAttempts = 1;
    await expect(getVerovioToolkit()).rejects.toThrow();
    expect(isVerovioReady()).toBe(false);
  });
});

describe("a render started against a doomed background attempt", () => {
  it("retries once and still engraves", async () => {
    const { prefetchVerovio, renderMeiToSvg } = await import("../src/verovio");
    // The background warm-up starts the shared attempt, and it is going to
    // fail. A staff mounting inside that window awaits the same promise, and
    // its effect deps never change again — without a retry it is stuck on
    // "notation unavailable" for the life of the page.
    failAttempts = 1;
    const warm = prefetchVerovio();
    const render = renderMeiToSvg("<mei/>");

    await warm;
    await expect(render).resolves.toContain("<svg");
    // Two attempts, one success: the retry, not a re-download loop.
    expect(attempts).toBe(2);
    expect(created.length).toBe(1);
  });

  it("gives up after a single retry rather than looping", async () => {
    const { renderMeiToSvg } = await import("../src/verovio");
    failAttempts = 10;
    await expect(renderMeiToSvg("<mei/>")).rejects.toThrow(/wasm boom/);
    // One attempt, one retry, then the failure surfaces.
    expect(attempts).toBe(2);
    expect(created.length).toBe(0);
  });

  it("does not re-initialise when the engraving itself is what failed", async () => {
    const { renderMeiToSvg } = await import("../src/verovio");
    failLoadData = true;
    await expect(renderMeiToSvg("<mei/>")).rejects.toThrow(/failed to load notation data/);
    // A bad MEI is not a transient toolkit failure — no second 7 MB init.
    expect(attempts).toBe(1);
    expect(created.length).toBe(1);
  });
});

describe("prefetchVerovioWhenIdle", () => {
  /** Install a `navigator.connection` shape (or remove it entirely). */
  function setConnection(conn: Record<string, unknown> | undefined) {
    if (conn === undefined) {
      delete (navigator as { connection?: unknown }).connection;
      return;
    }
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: conn,
    });
  }

  /** Run any idle callback synchronously so the assertion needs no timers. */
  function stubIdle() {
    const calls: (() => void)[] = [];
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      writable: true,
      value: (cb: () => void) => { calls.push(cb); return 1; },
    });
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      writable: true,
      value: () => {},
    });
    return calls;
  }

  afterEach(() => {
    setConnection(undefined);
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
    delete (window as { cancelIdleCallback?: unknown }).cancelIdleCallback;
  });

  it("warms on idle when the Network Information API is absent", async () => {
    setConnection(undefined);
    const idle = stubIdle();
    const { prefetchVerovioWhenIdle } = await import("../src/verovio");
    prefetchVerovioWhenIdle();
    expect(idle.length).toBe(1);
    idle[0]();
    await vi.waitFor(() => expect(created.length).toBe(1));
  });

  it("warms on idle on an ordinary connection", async () => {
    setConnection({ effectiveType: "4g", saveData: false });
    const idle = stubIdle();
    const { prefetchVerovioWhenIdle } = await import("../src/verovio");
    prefetchVerovioWhenIdle();
    expect(idle.length).toBe(1);
    idle[0]();
    await vi.waitFor(() => expect(created.length).toBe(1));
  });

  it("skips the background download when the user asked to save data", async () => {
    setConnection({ effectiveType: "4g", saveData: true });
    const idle = stubIdle();
    const { prefetchVerovioWhenIdle } = await import("../src/verovio");
    prefetchVerovioWhenIdle();
    expect(idle.length).toBe(0);
    expect(created.length).toBe(0);
  });

  it("skips the background download on a 2g connection", async () => {
    for (const effectiveType of ["slow-2g", "2g"]) {
      setConnection({ effectiveType, saveData: false });
      const idle = stubIdle();
      const { prefetchVerovioWhenIdle } = await import("../src/verovio");
      prefetchVerovioWhenIdle();
      expect(idle.length).toBe(0);
    }
    expect(created.length).toBe(0);
  });

  it("still warms explicitly on a saveData connection", async () => {
    // The gate covers the *unrequested* warm-up only. A pointer on the Display
    // toggle, or a view that already needs a staff, still loads Verovio.
    setConnection({ effectiveType: "4g", saveData: true });
    const { prefetchVerovio } = await import("../src/verovio");
    await prefetchVerovio();
    expect(created.length).toBe(1);
  });

  it("returns a cancel that unschedules the idle callback", async () => {
    setConnection(undefined);
    stubIdle();
    let cancelled: number | null = null;
    Object.defineProperty(window, "cancelIdleCallback", {
      configurable: true,
      writable: true,
      value: (id: number) => { cancelled = id; },
    });
    const { prefetchVerovioWhenIdle } = await import("../src/verovio");
    prefetchVerovioWhenIdle()();
    expect(cancelled).toBe(1);
  });

  it("falls back to a timeout where requestIdleCallback is missing", async () => {
    setConnection(undefined);
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
    vi.useFakeTimers();
    try {
      const { prefetchVerovioWhenIdle } = await import("../src/verovio");
      prefetchVerovioWhenIdle();
      expect(created.length).toBe(0);
      vi.advanceTimersByTime(2_000);
    } finally {
      vi.useRealTimers();
    }
    await vi.waitFor(() => expect(created.length).toBe(1));
  });
});
