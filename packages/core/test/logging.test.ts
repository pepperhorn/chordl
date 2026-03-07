import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logChordRequest, LOG_SCHEMA_VERSION, type ChordLogEntry, type LogConfig } from "../src/logging";

describe("logChordRequest", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does nothing when logging is disabled", () => {
    logChordRequest(makeEntry(), { enabled: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does nothing when no endpoint is configured", () => {
    logChordRequest(makeEntry(), { enabled: true, endpoint: undefined });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends POST to configured endpoint when enabled", () => {
    logChordRequest(makeEntry(), {
      enabled: true,
      endpoint: "https://example.com/log",
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://example.com/log");
    expect(opts.method).toBe("POST");
    const body = JSON.parse(opts.body);
    expect(body.logSchema).toBe("1.0.0");
    expect(body.input).toBe("Cmaj7");
  });

  it("never throws even if fetch fails", () => {
    fetchSpy.mockRejectedValue(new Error("network down"));
    expect(() => {
      logChordRequest(makeEntry(), {
        enabled: true,
        endpoint: "https://example.com/log",
      });
    }).not.toThrow();
  });

  it("includes version info", () => {
    logChordRequest(makeEntry(), {
      enabled: true,
      endpoint: "https://example.com/log",
      versions: { core: "1.0.0", voicings: "1.1.0" },
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.versions.core).toBe("1.0.0");
    expect(body.versions.voicings).toBe("1.1.0");
  });

  it("includes timestamp", () => {
    logChordRequest(makeEntry(), {
      enabled: true,
      endpoint: "https://example.com/log",
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it("includes full pipeline telemetry", () => {
    logChordRequest(makeEntry(), {
      enabled: true,
      endpoint: "https://example.com/log",
    });
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.pipeline.parser).toBe("chord");
    expect(body.pipeline.resolver.method).toBe("tonal");
    expect(body.pipeline.output.notes).toEqual(["C4", "E4", "G4", "B4"]);
    expect(body.durationMs).toBe(5);
    expect(body.success).toBe(true);
  });

  it("LOG_SCHEMA_VERSION is 1.0.0", () => {
    expect(LOG_SCHEMA_VERSION).toBe("1.0.0");
  });
});

function makeEntry(): ChordLogEntry {
  return {
    input: "Cmaj7",
    pipeline: {
      parser: "chord",
      parsed: { chordName: "Cmaj7", inversion: undefined, bassDegree: undefined, styleHint: undefined, format: "compact" },
      resolver: { method: "tonal", type: "maj7", root: "C", pitchClasses: ["C", "E", "G", "B"] },
      voicing: { attempted: false, style: undefined, quality: "maj7", found: false },
      layout: { startFrom: "B", size: 6, chordOctave: 0 },
      output: { notes: ["C4", "E4", "G4", "B4"], highlightKeys: ["C", "E", "G", "B"], format: "svg" },
    },
    success: true,
    durationMs: 5,
  };
}
