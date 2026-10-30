import { describe, expect, it } from "vitest";
import {
  BASE_QUALITIES, ALTERATIONS, parseChordId, formatChordId, chordIntervals,
} from "../src/index.js";

describe("chord ids", () => {
  it("parses C:maj7", () => {
    expect(parseChordId("C:maj7")).toEqual({ root: "C", quality: "maj7", bass: null, base: "maj7", alterations: [] });
    expect(chordIntervals("C:maj7")).toEqual(["1P", "3M", "5P", "7M"]);
  });
  it("treats enharmonic roots as distinct valid ids", () => {
    const a = parseChordId("C#:maj7"), b = parseChordId("Db:maj7");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toEqual(b);
  });
  it("applies alterations in order", () => {
    expect(chordIntervals("C:7#9b13")).toEqual(["1P", "3M", "5P", "7m", "9A", "13m"]);
    expect(parseChordId("C:7#9b13")!.alterations).toEqual(["#9", "b13"]);
    expect(chordIntervals("C:7b9#9")).toEqual(["1P", "3M", "5P", "7m", "9m", "9A"]);
    expect(chordIntervals("C:7b5#5")).toEqual(["1P", "3M", "5d", "5A", "7m"]);
    expect(chordIntervals("E:7b5#5b9")).toEqual(["1P", "3M", "5d", "5A", "7m", "9m"]);
    expect(chordIntervals("C:7b5")).toEqual(["1P", "3M", "5d", "7m"]);
    expect(chordIntervals("C:13b13")).toEqual(["1P", "3M", "5P", "7m", "9M", "13m"]);
    expect(chordIntervals("C:9#11")).toEqual(["1P", "3M", "5P", "7m", "9M", "11A"]);
  });
  it("rejects wrong alteration order and repeats", () => {
    expect(parseChordId("C:7b13#9")).toBeNull();
    expect(parseChordId("C:7#9#9")).toBeNull();
  });
  it("handles 7alt", () => {
    expect(parseChordId("C:7alt")).not.toBeNull();
    expect(chordIntervals("C:7alt")).toEqual(["1P", "3M", "7m"]);
    expect(parseChordId("C:7alt#9")).toBeNull();
  });
  it("rejects junk", () => {
    expect(parseChordId("C:zbq9")).toBeNull();
    expect(parseChordId("H:maj")).toBeNull();
    expect(parseChordId("C:maj7/H")).toBeNull();
    expect(parseChordId("Cmaj7")).toBeNull();
    expect(parseChordId("C:")).toBeNull();
  });
  it("parses bass", () => {
    expect(parseChordId("C:maj7/E")).toEqual({ root: "C", quality: "maj7", bass: "E", base: "maj7", alterations: [] });
  });
  it("requires a 7th for alterations", () => {
    expect(parseChordId("C:maj#5")).toBeNull();
    expect(parseChordId("C:6b5")).toBeNull();
    expect(parseChordId("C:maj7#5")).not.toBeNull();
  });
  it("prefers the longest base token", () => {
    expect(parseChordId("C:m7b5")!.base).toBe("m7b5");
    expect(parseChordId("C:69")!.base).toBe("69");
  });
  it("chordIntervals throws on invalid ids", () => {
    expect(() => chordIntervals("nope")).toThrow();
  });
  it("exposes tokens", () => {
    expect(Object.keys(BASE_QUALITIES)).toHaveLength(36);
    expect(ALTERATIONS).toEqual(["b5", "#5", "b9", "#9", "#11", "b13"]);
  });
  it("round-trips every valid id", () => {
    const ids = ["C:maj7", "C#:maj7", "Db:maj7", "C:7#9b13", "C:7alt", "C:maj7/E", "F#:m7b5", "Bb:13b13/D", "C:5", "E:7b5#5b9"];
    for (const id of ids) {
      const p = parseChordId(id);
      expect(p, id).not.toBeNull();
      expect(formatChordId(p!)).toBe(id);
    }
  });

  it.each([
    ["C:7omit3", ["1P", "5P", "7m"]],
    ["C:9sus4", ["1P", "4P", "5P", "7m", "9M"]],
    ["C:13sus4", ["1P", "4P", "5P", "7m", "9M", "13M"]],
    ["C:m#5", ["1P", "3m", "5A"]],
    ["C:m7add11", ["1P", "3m", "5P", "7m", "11P"]],
    ["C:m7sus4", ["1P", "3m", "4P", "7m"]],
    ["C:mmaj9", ["1P", "3m", "5P", "7M", "9M"]],
    ["C:mmaj9b5", ["1P", "3m", "5d", "7M", "9M"]],
    ["C:mmaj9#5", ["1P", "3m", "5A", "7M", "9M"]],
  ])("covers the card catalogue quality %s", (id, intervals) => {
    expect(chordIntervals(id)).toEqual(intervals);
  });

  it("does not let an added quality swallow a neighbouring token", () => {
    expect(parseChordId("C:m7b5")!.base).toBe("m7b5");
    expect(parseChordId("C:m7")!.base).toBe("m7");
    expect(parseChordId("C:mmaj7")!.base).toBe("mmaj7");
    expect(parseChordId("C:7sus4")!.base).toBe("7sus4");
  });
});
