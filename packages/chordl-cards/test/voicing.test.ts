import { describe, it, expect } from "vitest";
import { parseTheme } from "../src/theme";
import json from "../themes/crf-default.json";
import { requestFor } from "../src/faces";
import type { CardFace } from "../src/faces";
import {
  alternativesFor,
  requestForVoicing,
  voicingFromRequest,
} from "../src/voicing";
import { shapeHash, notesMatchRealization } from "@pepperhorn/chordl-voicing";
const theme = parseTheme(json);
describe("voicing conversion", () => {
  for (const face of [
    "keyboard",
    "keyboard-hands",
    "guitar",
    "guitar-top3",
    "ukulele",
    "bass4",
  ] as CardFace[])
    for (const chord of ["C", "G", "Am", "F", "D7", "Em"])
      it(`${chord} ${face} preserves the entire rendering request`, () => {
        const req = requestFor(chord, face, theme);
        const v = voicingFromRequest(chord, req, face);
        expect(notesMatchRealization(v)).toEqual([]);
        expect(requestForVoicing(chord, v, face, theme)).toEqual(req);
      });
  it("standard first, unique computed alternatives", () => {
    for (const face of [
      "guitar",
      "keyboard",
      "keyboard-hands",
      "guitar-top3",
      "ukulele",
      "bass4",
    ] as CardFace[]) {
      const rows = alternativesFor("G", face, theme);
      expect(rows.length).toBeGreaterThan(1);
      expect(rows[0].isStandard).toBe(true);
      expect(
        new Set(rows.map((r) => shapeHash(r.voicing.realization))).size,
      ).toBe(rows.length);
      expect(
        rows.every((r) =>
          ["beginner", "emerging", "established"].includes(r.level),
        ),
      ).toBe(true);
    }
  });
  it("rejects mismatched faces", () => {
    const v = voicingFromRequest(
      "C",
      requestFor("C", "guitar", theme),
      "guitar",
    );
    expect(() => requestForVoicing("C", v, "ukulele", theme)).toThrow(
      /mismatch/,
    );
  });
});

it("retains the absolute register and hand split of a custom keyboard", () => {
  const v = voicingFromRequest(
    "C",
    requestFor("C", "keyboard-hands", theme),
    "keyboard-hands",
  );
  if (v.realization.kind !== "keyboard") throw new Error("fixture");
  v.realization.hands = { left: ["C2"], right: ["G4", "C5", "E5"] };
  const req = requestForVoicing("C", v, "keyboard-hands", theme);
  const out = voicingFromRequest("C", req, "keyboard-hands");
  expect(out.realization).toEqual(v.realization);
});

it("custom shapes retain absolute register and an extended fret box", () => {
  const v = voicingFromRequest("C", requestFor("C", "guitar", theme), "guitar");
  if (v.realization.kind === "fretted")
    v.realization.strings = [null, 3, 14, 0, 1, 0];
  const request = requestForVoicing("C", v, "guitar", theme);
  expect(request.kind === "guitar" && request.frets).toBe(14);
});

it("conversion produces schema-valid voicing records", async () => {
  const { validateChordFileSchema } = await import(
    "@pepperhorn/chordl-voicing"
  );
  const voicing = voicingFromRequest(
    "C",
    requestFor("C", "keyboard", theme),
    "keyboard",
  );
  expect(
    validateChordFileSchema({
      schema: "chordl.chord/1",
      chord: {
        id: "C:maj",
        symbol: "C",
        root: "C",
        quality: "maj",
        bass: null,
        aliases: [],
      },
      voicings: [voicing],
    }),
  ).toMatchObject({ ok: true });
});
