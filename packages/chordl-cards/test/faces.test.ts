import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { computeKeyboard, resolveChord } from "@pepperhorn/chordl-core";
import {
  chordNotes, faceNoteNames, handBracketsFor, handLabels, handsNoteLabels, keyboardNoteLabels,
  requestFor, sharpPitchClasses, type CardFace,
} from "../src/faces";
import { keyIndicesFor } from "../src/keyboard-window";
import { handsWindow } from "../src/hands";
import { fullChordName, qualityLabelFor } from "../src/names";
import { FIXTURES, loadTheme } from "./theme-fixture";

const THEME = loadTheme();

// ── Ported from chordcards test/diagrams.test.ts (the browser-free parts) ────

describe("chordNotes", () => {
  it("gives root-position pitch classes", () => {
    expect(chordNotes("Bm")).toEqual(["B", "D", "F#"]);
    expect(chordNotes("C")).toEqual(["C", "E", "G"]);
    expect(chordNotes("G7")).toEqual(["G", "B", "D", "F"]);
  });

  it("spells flats correctly rather than always defaulting to sharps", () => {
    expect(chordNotes("Gm")).toEqual(["G", "Bb", "D"]);
    expect(chordNotes("C7")).toEqual(["C", "E", "G", "Bb"]);
  });

  it("covers the sixths, aug, dim and sus4, in chordl-core's spelling", () => {
    for (const chord of ["C6", "Ebm6", "Gaug", "Bbdim", "F#sus4"]) {
      expect(chordNotes(chord), chord).toEqual(resolveChord(chord).notes);
    }
    expect(sharpPitchClasses("Ebm6")).toEqual(["D#", "F#", "A#", "C"]);
    expect(sharpPitchClasses("Gaug")).toEqual(["G", "B", "D#"]);
    expect(sharpPitchClasses("Cdim")).toEqual(["C", "D#", "F#"]);
    expect(sharpPitchClasses("Csus4")).toEqual(["C", "F", "G"]);
  });

  it("throws on an unsupported quality rather than guessing", () => {
    expect(() => chordNotes("Cdim7")).toThrow(/unsupported/);
  });
});

describe("keyboard note labels", () => {
  it("puts a note label at the centre of each highlighted key, left to right", () => {
    const labels = keyboardNoteLabels("Bm", THEME);
    expect(labels.map((l) => l.text)).toEqual(["B", "D", "F#"]);
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i].x).toBeGreaterThan(labels[i - 1].x);
    }
  });

  it("spells labels for display, not by the sharp matching identity", () => {
    expect(keyboardNoteLabels("Gm", THEME).map((l) => l.text)).toEqual(["G", "Bb", "D"]);
  });
});

describe("top-3 requests", () => {
  it("treats a suffix that names an Object property as unsupported, not as a quality", () => {
    expect(() => sharpPitchClasses("Cconstructor")).toThrow(/unsupported quality/);
    expect(() => chordNotes("CvalueOf")).toThrow(/unsupported quality/);
    expect(() => requestFor("CtoString", "guitar-top3", THEME)).toThrow(/unsupported chord suffix/);
  });

  it("throws on an unsupported chord suffix before ever consulting a shape table", () => {
    expect(() => requestFor("C#dim", "guitar-top3", THEME)).toThrow(/unsupported/);
  });
});

describe("keyboard-hands requests", () => {
  it("refuses a chord with no exploded voicing, naming face and chord", () => {
    expect(() => requestFor("C9", "keyboard-hands", THEME)).toThrow(/keyboard-hands.*C9/);
  });

  it("leaves the plain keyboard request without hands", () => {
    expect(requestFor("C", "keyboard", THEME)).not.toHaveProperty("hands");
    expect(requestFor("C", "keyboard-hands", THEME)).toHaveProperty("hands", { lh: [0], rh: [1, 2] });
  });
});

describe("handsNoteLabels and handLabels", () => {
  it("names the bass then the two R.H. tones, left to right", () => {
    const labels = handsNoteLabels("C7", THEME);
    expect(labels.map((l) => l.text)).toEqual(["C", "E", "Bb"]);
    expect(labels[0].x).toBeLessThan(labels[1].x);
    expect(labels[1].x).toBeLessThan(labels[2].x);
  });

  it("puts a slash bass first", () => {
    expect(handsNoteLabels("C/E", THEME).map((l) => l.text)).toEqual(["E", "G", "C"]);
  });

  it("places L.H. over the bass and R.H. midway between the right-hand keys", () => {
    const notes = handsNoteLabels("C", THEME);
    const hands = handLabels("C", THEME);
    expect(hands.map((l) => l.text)).toEqual(["L.H.", "R.H."]);
    expect(hands[0].x).toBe(notes[0].x);
    expect(hands[1].x).toBeCloseTo((notes[1].x + notes[2].x) / 2, 9);
  });
});

// ── Byte-identity with chordcards ────────────────────────────────────────────
//
// fixtures/chordcards-golden.json was produced by running chordcards' own
// src/diagrams.ts `requestFor` (feat/exploded-triads, 2026-10-22) and its label
// helpers against themes/crf-default.json, for every Exploded Triads chord,
// the beginner-20 deck and a handful of edge cases. The print cache key is a
// hash of JSON.stringify(request), so equality is checked on the serialised
// string — key order included — not structurally.

type Golden = Record<string, Record<string, { ok?: unknown; error?: string } | string>>;
const GOLDEN: Golden = JSON.parse(
  readFileSync(`${FIXTURES}/chordcards-golden.json`, "utf8"),
);
const FACE_KEYS: Array<[CardFace, string]> = [
  ["keyboard", "keyboard"], ["keyboard-hands", "hands"], ["guitar-top3", "top3"],
];
const attempt = (f: () => unknown): { ok?: unknown; error?: string } => {
  try { return { ok: f() }; } catch (e) { return { error: (e as Error).message }; }
};
const same = (actual: { ok?: unknown; error?: string }, golden: unknown) =>
  expect(JSON.stringify(actual)).toBe(JSON.stringify(golden));

describe("byte-identical with chordcards", () => {
  it("covers the chords the golden file was made from", () => {
    expect(Object.keys(GOLDEN).length).toBeGreaterThanOrEqual(124);
  });

  it.each(Object.keys(GOLDEN))("%s: every face request, label and name", (chord) => {
    const g = GOLDEN[chord];
    for (const [face, key] of FACE_KEYS) same(attempt(() => requestFor(chord, face, THEME)), g[key]);
    same(attempt(() => keyboardNoteLabels(chord, THEME)), g.keyboardNoteLabels);
    same(attempt(() => handsNoteLabels(chord, THEME)), g.handsNoteLabels);
    same(attempt(() => handLabels(chord, THEME)), g.handLabels);
    expect(qualityLabelFor(chord)).toBe(g.qualityLabel);
    expect(fullChordName(chord)).toBe(g.fullName);
  });
});

// ── New in chordl-cards: what the render host / player derives ──────────────

describe("handBracketsFor", () => {
  it("is undefined for a request with no hands", () => {
    expect(handBracketsFor(requestFor("C", "keyboard", THEME))).toBeUndefined();
  });

  it("maps the L.H./R.H. note indices to the keys the window lit", () => {
    for (const chord of ["C", "C7", "F#m7", "Ebmaj7", "C/E"]) {
      const req = requestFor(chord, "keyboard-hands", THEME);
      if (req.kind !== "keyboard") throw new Error("expected keyboard");
      const keys = keyIndicesFor(handsWindow(chord).window, THEME.keyboard.format);
      expect(handBracketsFor(req), chord).toEqual([
        { label: "L.H.", keyIndices: [keys[0]] },
        { label: "R.H.", keyIndices: [keys[1], keys[2]] },
      ]);
      const all = computeKeyboard(req.startFrom as never, req.size, req.format);
      expect(all[keys[0]].note).toBe(req.notes[0].split(":")[0]);
    }
  });
});

describe("faceNoteNames", () => {
  it("is the display spelling, aligned with the request's notes", () => {
    for (const chord of ["C", "Gm", "F#m7", "Ebmaj7", "Bbdim"]) {
      expect(faceNoteNames(chord, "keyboard"), chord).toEqual(keyboardNoteLabels(chord, THEME).map((l) => l.text));
      expect(faceNoteNames(chord, "keyboard-hands"), chord).toEqual(handsNoteLabels(chord, THEME).map((l) => l.text));
    }
  });

  it("has nothing to say for the guitar face", () => {
    expect(faceNoteNames("C", "guitar-top3")).toBeUndefined();
  });
});
