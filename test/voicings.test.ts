import { describe, it, expect } from "vitest";
import {
  VOICING_LIBRARY,
  queryVoicings,
  findVoicing,
  realizeVoicing,
  voicingPitchClasses,
  inferStyle,
} from "../src/voicings";

describe("VOICING_LIBRARY", () => {
  it("contains entries from all 5 categories", () => {
    const styles = new Set(VOICING_LIBRARY.map((v) => v.tags.style));
    expect(styles.has("Shell")).toBe(true);
    expect(styles.has("Rootless Type A")).toBe(true);
    expect(styles.has("Rootless Type B")).toBe(true);
    expect(styles.has("Quartal")).toBe(true);
    expect(styles.has("Upper Structure")).toBe(true);
    expect(styles.has("Drop 2")).toBe(true);
  });

  it("has unique IDs", () => {
    const ids = VOICING_LIBRARY.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("queryVoicings", () => {
  it("filters by quality", () => {
    const results = queryVoicings({ quality: "maj7" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((v) => v.quality === "maj7")).toBe(true);
  });

  it("filters by style", () => {
    const results = queryVoicings({ style: "Shell" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((v) => v.tags.style === "Shell")).toBe(true);
  });

  it("filters by quality + style", () => {
    const results = queryVoicings({ quality: "min7", style: "Rootless Type A" });
    expect(results.length).toBe(1);
    expect(results[0].id).toBe("rootless-min7-a");
  });
});

describe("inferStyle", () => {
  it("maps 'Bill Evans' to Rootless Type A", () => {
    expect(inferStyle("Bill Evans")).toBe("Rootless Type A");
  });

  it("maps 'McCoy Tyner' to Quartal", () => {
    expect(inferStyle("McCoy Tyner")).toBe("Quartal");
  });

  it("maps 'bebop' to Shell", () => {
    expect(inferStyle("bebop")).toBe("Shell");
  });

  it("maps 'Herbie Hancock' to Upper Structure", () => {
    expect(inferStyle("Herbie Hancock")).toBe("Upper Structure");
  });

  it("returns undefined for unknown styles", () => {
    expect(inferStyle("unknown pianist")).toBeUndefined();
  });
});

describe("findVoicing", () => {
  it("finds a rootless min7 for Bill Evans style", () => {
    const v = findVoicing("min7", "Bill Evans");
    expect(v).toBeDefined();
    expect(v!.tags.style).toBe("Rootless Type A");
  });

  it("finds a shell for bebop style", () => {
    const v = findVoicing("dom7", "bebop");
    expect(v).toBeDefined();
    expect(v!.tags.style).toBe("Shell");
  });

  it("finds quartal for McCoy Tyner", () => {
    const v = findVoicing("min7", "McCoy Tyner");
    expect(v).toBeDefined();
    expect(v!.tags.style).toBe("Quartal");
  });

  it("falls back to any voicing when no style matches", () => {
    const v = findVoicing("maj7");
    expect(v).toBeDefined();
  });
});

describe("realizeVoicing", () => {
  it("realizes rootless min7 Type A in C", () => {
    const v = findVoicing("min7", "Bill Evans")!;
    const notes = realizeVoicing("C", v, 3);
    // Rootless min7 Type A: b3=Eb, 5=G, b7=Bb, 9=D
    // C3 + [3,7,10,14] = Eb3, G3, Bb3, D4
    expect(notes).toEqual(["Eb3", "G3", "Bb3", "D4"]);
  });

  it("realizes shell dom7 in G", () => {
    const v = queryVoicings({ quality: "dom7", style: "Shell" })[0];
    const notes = realizeVoicing("G", v, 3);
    // Shell dom7 Root+b7: G3 + [0,10] = G3, F4
    expect(notes).toEqual(["G3", "F4"]);
  });
});

describe("voicingPitchClasses", () => {
  it("returns pitch classes without octaves for keyboard highlighting", () => {
    const v = findVoicing("min7", "Bill Evans")!;
    const pcs = voicingPitchClasses("C", v, 3);
    // Eb3, G3, Bb3, D4 → D#, G, A#, D
    expect(pcs).toContain("D#");
    expect(pcs).toContain("G");
    expect(pcs).toContain("A#");
    expect(pcs).toContain("D");
  });
});
