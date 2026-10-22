import { describe, expect, it } from "vitest";
import { parseTheme, toneColor } from "../src/theme";
import { RAW_THEME as RAW, loadTheme } from "./theme-fixture";

// Not ported: the two checks that compare the shipped theme against
// chordcards' src/palette.ts and src/highlight.ts (contrast guard). Those are
// print-side modules; they stay in chordcards with the theme file itself.
const clone = () => JSON.parse(JSON.stringify(RAW));

describe("the shipped theme", () => {
  it("loads and covers all twelve pitch classes", () => {
    const t = loadTheme();
    expect(Object.keys(t.pitches)).toHaveLength(12);
    expect(Object.keys(t.roots)).toHaveLength(12);
  });

  it("sets every label in one weight, 600 — only the root letter is heavier", () => {
    // titleFullName is exempt on purpose: it is the deliberately quiet,
    // secondary line under the title (Regular, reduced opacity), not a label.
    const { families, titleRoot, titleFullName, ...labels } = loadTheme().fonts;
    expect(titleRoot.weight).toBe(700);
    for (const [role, spec] of Object.entries(labels)) expect(spec.weight, role).toBe(600);
  });

  it("sets every printed type size on one of four tiers: 100 / 38 / 26 / 18", () => {
    const { families, ...roles } = loadTheme().fonts;
    for (const [role, spec] of Object.entries(roles)) {
      expect([100, 38, 26, 18], role).toContain(spec.size);
    }
    // The hand captions sit on the smallest tier, below the note names.
    expect(loadTheme().fonts.keyboardHandText.size).toBe(18);
    expect(loadTheme().fonts.badge.size).toBe(18);
  });

  it("sets the full chord name under the title in Poppins Regular at 18, 70% strength", () => {
    const f = loadTheme().fonts.titleFullName;
    expect(f).toEqual({ family: "ui", size: 18, weight: 400, style: "normal", opacity: 0.7 });
  });

  it("refuses a font opacity outside 0..1", () => {
    const raw = clone();
    raw.fonts.titleFullName.opacity = 1.5;
    expect(() => parseTheme(raw)).toThrow(/fonts\.titleFullName\.opacity/);
  });

  it("refuses a theme without a titleFullName font", () => {
    const raw = clone();
    delete raw.fonts.titleFullName;
    expect(() => parseTheme(raw)).toThrow(/fonts\.titleFullName/);
  });

  it("gives every root a background equal to its own pitch colour", () => {
    const t = loadTheme();
    for (const [root, entry] of Object.entries(t.roots)) {
      expect(entry.background, root).toBe(t.pitches[root].hex);
    }
  });

  it("labels in ink on every card: keyboardText and fretFingerText match the theme ink", () => {
    // Both were white before the 2026-08 redesign, which read at ~1.1:1 on the
    // light grounds. Ink clears every background in this palette at 6.1:1+.
    const t = loadTheme();
    for (const [root, entry] of Object.entries(t.roots)) {
      expect(entry.keyboardText, root).toBe(t.ink);
      expect(entry.fretFingerText, root).toBe(t.ink);
    }
  });

  it("strokes fret circles, without which pitch mode loses every root", () => {
    // In pitch mode a card's root marker is filled with exactly the card
    // background. svguitar draws finger markers borderless by default, so the
    // stroke is the only thing keeping the root visible. See src/theme.ts.
    const t = loadTheme();
    if (t.fret.colorMode === "pitch") {
      expect(t.fret.circleStrokeWidth).toBeGreaterThan(0);
      expect(t.fret.circleStrokeColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("toneColor", () => {
  it("uses the tone's own pitch colour in pitch mode", () => {
    const t = parseTheme({ ...clone(), keyboard: { ...RAW.keyboard, colorMode: "pitch" } });
    expect(toneColor(t, "keyboard", "E", "C")).toBe(t.pitches.E.hex);
  });

  it("uses the card's single highlight in single mode", () => {
    const t = parseTheme({ ...clone(), keyboard: { ...RAW.keyboard, colorMode: "single" } });
    expect(toneColor(t, "keyboard", "E", "C")).toBe(t.roots.C.keyboardHighlight);
  });

  it("reads the fret surface independently of the keyboard surface", () => {
    const raw = clone();
    raw.keyboard.colorMode = "pitch";
    raw.fret.colorMode = "single";
    const t = parseTheme(raw);
    expect(toneColor(t, "keyboard", "E", "C")).toBe(t.pitches.E.hex);
    expect(toneColor(t, "fret", "E", "C")).toBe(t.roots.C.fretCircle);
  });
});

describe("validation refuses to print a broken theme", () => {
  it("rejects a malformed colour rather than rendering it as undefined", () => {
    const raw = clone();
    raw.roots.C.background = "red";
    expect(() => parseTheme(raw)).toThrow(/roots\.C\.background.*hex/s);
  });

  it("rejects a malformed QR chip, whose padding is a scanning margin", () => {
    const raw = clone();
    raw.qrChip.fill = "white";
    expect(() => parseTheme(raw)).toThrow(/qrChip\.fill.*hex/s);
    const raw2 = clone();
    delete raw2.qrChip;
    expect(() => parseTheme(raw2)).toThrow(/qrChip/);
  });

  it("rejects a non-numeric title stroke or plate finish", () => {
    const raw = clone();
    raw.fonts.titleRoot.strokeWidth = "thick";
    expect(() => parseTheme(raw)).toThrow(/fonts\.titleRoot\.strokeWidth/);
    raw.fonts.titleRoot.strokeWidth = 7;
    raw.fonts.titleRoot.accidental = "tiny";
    expect(() => parseTheme(raw)).toThrow(/fonts\.titleRoot\.accidental/);
    raw.fonts.titleRoot.accidental = "raised";
    expect(parseTheme(raw).fonts.titleRoot.accidental).toBe("raised");
    raw.fonts.titleRoot.strokeWidth = "thick";
    expect(() => parseTheme(raw)).toThrow(/fonts\.titleRoot\.strokeWidth/);
    const raw2 = clone();
    raw2.fret.panelShadowOffset = null;
    expect(() => parseTheme(raw2)).toThrow(/fret\.panelShadowOffset/);
  });

  it("rejects a missing pitch entry", () => {
    const raw = clone();
    delete raw.pitches["F#"];
    expect(() => parseTheme(raw)).toThrow(/pitches\.F#/);
  });

  it("rejects an unknown colorMode", () => {
    const raw = clone();
    raw.fret.colorMode = "rainbow";
    expect(() => parseTheme(raw)).toThrow(/fret\.colorMode.*"pitch" or "single"/s);
  });

  it("rejects an unknown keyboard format", () => {
    const raw = clone();
    raw.keyboard.format = "huge";
    expect(() => parseTheme(raw)).toThrow(/keyboard\.format.*"compact" or "exact"/s);
  });

  it("rejects a non-integer key count", () => {
    const raw = clone();
    raw.keyboard.whiteKeys = 12.5;
    expect(() => parseTheme(raw)).toThrow(/keyboard\.whiteKeys.*positive integer/s);
  });

  it("rejects a missing font size", () => {
    const raw = clone();
    delete raw.fonts.titleRoot.size;
    expect(() => parseTheme(raw)).toThrow(/fonts\.titleRoot\.size/);
  });
});

describe("the optional playback block (web player only)", () => {
  it("is absent from the print theme, which parses exactly as before", () => {
    expect(loadTheme()).not.toHaveProperty("playback");
  });

  it("carries a default tempo and playback highlight when present", () => {
    const t = parseTheme({ ...clone(), playback: { arpeggioBpm: 90, highlightColor: "#fff56d" } });
    expect(t.playback).toEqual({ arpeggioBpm: 90, highlightColor: "#fff56d" });
  });

  it("rejects a tempo outside 40-300 or a non-hex highlight", () => {
    expect(() => parseTheme({ ...clone(), playback: { arpeggioBpm: 20 } })).toThrow(/playback\.arpeggioBpm/);
    expect(() => parseTheme({ ...clone(), playback: { arpeggioBpm: 120.5 } })).toThrow(/playback\.arpeggioBpm/);
    expect(() => parseTheme({ ...clone(), playback: { highlightColor: "gold" } })).toThrow(/playback\.highlightColor/);
  });
});
