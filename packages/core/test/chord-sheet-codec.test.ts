import { describe, it, expect } from "vitest";
import { encodeChordSheet, decodeChordSheet } from "../src/chord-sheet/codec";
import { CHORD_SHEET_SCHEMA_VERSION } from "../src/chord-sheet/schema";
import type { ChordSheetData } from "../src/types";

const MINIMAL: ChordSheetData = {
  v: "1.0",
  sections: [{ chords: [{ chord: "Cmaj7" }] }],
};

const FULL: ChordSheetData = {
  v: "1.0",
  heading: "Jazz Voicings",
  subheading: "ii-V-I Workout",
  defaults: { display: "keyboard", scale: 0.6 },
  sections: [
    {
      id: "A",
      heading: "Section A",
      subheading: "Basic shells",
      textAbove: "Play slowly",
      textBelow: "Repeat 4x",
      defaults: { format: "compact" },
      chords: [
        { chord: "Dm7", chordHeading: "ii", annotationText: "shell voicing" },
        { chord: "G7", chordHeading: "V" },
        { chord: "Cmaj7", chordHeading: "I" },
      ],
    },
    {
      heading: "Section B",
      chords: [{ chord: "Am7" }, { chord: "D7" }],
    },
  ],
};

describe("encodeChordSheet / decodeChordSheet", () => {
  it("roundtrips minimal data", async () => {
    const token = await encodeChordSheet(MINIMAL);
    const decoded = await decodeChordSheet(token);
    expect(decoded).toEqual(MINIMAL);
  });

  it("roundtrips full data", async () => {
    const token = await encodeChordSheet(FULL);
    const decoded = await decodeChordSheet(token);
    expect(decoded).toEqual(FULL);
  });

  it("token starts with bcs1. prefix", async () => {
    const token = await encodeChordSheet(MINIMAL);
    expect(token.startsWith("bcs1.")).toBe(true);
  });

  it("uncompressed fallback works", async () => {
    const token = await encodeChordSheet(MINIMAL, { skipCompression: true });
    expect(token.startsWith("bcs1.")).toBe(true);
    const decoded = await decodeChordSheet(token);
    expect(decoded).toEqual(MINIMAL);
  });

  it("stamps version when omitted", async () => {
    const noVersion = { sections: [{ chords: [{ chord: "C" }] }] } as ChordSheetData;
    const token = await encodeChordSheet(noVersion);
    const decoded = await decodeChordSheet(token);
    expect(decoded.v).toBe(CHORD_SHEET_SCHEMA_VERSION);
  });

  it("rejects incompatible major version", async () => {
    const future: ChordSheetData = { v: "2.0", sections: [{ chords: [{ chord: "C" }] }] };
    const token = await encodeChordSheet(future);
    await expect(decodeChordSheet(token)).rejects.toThrow("Incompatible schema version");
  });

  it("rejects invalid token prefix", async () => {
    await expect(decodeChordSheet("invalid.abc")).rejects.toThrow("must start with");
  });

  it("rejects garbled payload", async () => {
    // Use valid base64 that isn't valid JSON or deflate
    await expect(decodeChordSheet("bcs1.aGVsbG8")).rejects.toThrow();
  });
});
