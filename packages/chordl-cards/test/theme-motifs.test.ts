import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio, mixOklab, over } from "../src/colour";
import {
  MIN_PRINT_STROKE_PT,
  gradientColours,
  gradientContrast,
  parseTheme,
  resolveColourRef,
} from "../src/theme";
import { RAW_THEME as RAW, THEME_PATH, loadTheme } from "./theme-fixture";

const clone = () => JSON.parse(JSON.stringify(RAW));
const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

describe("colour maths", () => {
  it("mixes in oklab like CSS color-mix (C toward ink 8%, the sheen's darkest point)", () => {
    // Measured in Chromium (docs/animation.md in the chords site): ink 5.05:1, 70% ink 3.21:1.
    const dark = mixOklab("#f86e6e", "#231f20", 0.08);
    expect(contrastRatio("#231f20", dark)).toBeCloseTo(5.05, 2);
    expect(contrastRatio(over("#231f20", dark, 0.7), dark)).toBeCloseTo(3.21, 2);
  });

  it("returns the first colour at 0 and the second at 1", () => {
    expect(mixOklab("#f86e6e", "#ffffff", 0)).toBe("#f86e6e");
    expect(mixOklab("#f86e6e", "#ffffff", 1)).toBe("#ffffff");
  });
});

describe("the shipped theme's motifs", () => {
  const t = loadTheme();

  it("states the contrast floors: 4.5 body, 3 for 24px+, ink at 70% large-only", () => {
    expect(t.contrast).toEqual({ body: 4.5, large: 3, largeTextPx: 24, mutedInkOpacity: 0.7 });
    // The muted-ink opacity is the card's full-name line.
    expect(t.contrast!.mutedInkOpacity).toBe(t.fonts.titleFullName.opacity);
  });

  it("keeps ink >= 5.78:1 flat on every root (the floor the sheen spends from)", () => {
    for (const r of ROOTS) expect(contrastRatio(t.ink, t.roots[r].background), r).toBeGreaterThanOrEqual(5.78);
  });

  it("keeps ink at the body floor and 70% ink at the large floor on every point of every root's sheen", () => {
    for (const r of ROOTS) {
      const c = gradientContrast(t, r);
      expect(c.ink, r).toBeGreaterThanOrEqual(t.contrast!.body);
      expect(c.mutedInk, r).toBeGreaterThanOrEqual(t.contrast!.large);
    }
    // C is the worst root, as measured on the site.
    expect(gradientContrast(t, "C").ink).toBeCloseTo(5.05, 2);
  });

  it("carries the site's sheen: 105deg, 8% shade -> root -> 45% tint -> root -> 8% shade, drifting 44s", () => {
    const g = t.gradient!;
    expect(g.angle).toBe(105);
    expect(g.stops.map((s) => [s.at, s.toward, s.amount])).toEqual([
      [0.12, "ink", 0.08], [0.27, "paper", 0], [0.38, "paper", 0.22], [0.5, "paper", 0.45],
      [0.62, "paper", 0.22], [0.73, "paper", 0], [0.88, "ink", 0.08],
    ]);
    expect(g.drift).toEqual({ secondsPerCycle: 44, travel: 0.22, overscan: 0.5 });
    expect(g.counterHighlight).toEqual({ x: 0.28, y: 0.3, radius: 0.34, toward: "paper", amount: 0.4 });
  });

  it("resolves the stops to solid colours a card can fill with", () => {
    const c = gradientColours(t, "C");
    expect(c).toHaveLength(8);
    expect(c[1].hex).toBe("#f86e6e"); // amount 0 = the root itself
    for (const { hex } of c) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("carries the site's groove fingerprint: 7.25px pitch, 1.25px line, a 45's label", () => {
    const f = t.groove!.fingerprint;
    expect(f.ringPitch).toEqual({ px: 7.25, pt: 2.9 });
    expect(f.stroke).toEqual({ px: 1.25, pt: 0.5 });
    expect(f.label).toEqual({ hole: 0.035, holeRim: 0.045, radius: 0.26, rim: 0.27 });
    expect(f.grounds.dark).toEqual({ colour: "paper", line: 0.13, label: 0.05, sheen: 0.07 });
    expect(f.grounds.light).toEqual({ colour: "ink", line: 0.09, label: 0.035, sheen: 0.05 });
    expect(f.sizes).toEqual({ sm: 12, md: 22, lg: 34 });
    expect(f.presets[f.defaultPreset]).toEqual({ x: 1, y: 0 });
    expect(f.spin).toEqual({ secondsPerTurn: 90, default: "static" });
  });

  it("prints grooves no thinner than the floor, at the site's line-to-pitch ratio", () => {
    const f = t.groove!.fingerprint;
    expect(f.stroke.pt!).toBeGreaterThanOrEqual(MIN_PRINT_STROKE_PT);
    expect(f.stroke.pt! / f.ringPitch.pt!).toBeCloseTo(f.stroke.px / f.ringPitch.px, 2);
  });

  it("carries the ambient record: 12.5px elliptical grooves, 14% paper on the root, 60s turn", () => {
    const a = t.groove!.ambient!;
    expect(a.ringPitch).toEqual({ px: 12.5 });
    expect(a.stroke).toEqual({ px: 1.5 });
    expect(a.aspect).toBe(0.92);
    expect(a.grounds.root).toEqual({ colour: "paper", line: 0.14 });
    expect(a.mask).toEqual({ innerFrom: 0.14, innerTo: 0.26, outerFrom: 0.84 });
    expect(a.spin).toEqual({ secondsPerTurn: 60, default: "spinning" });
  });

  it("resolves colour roles", () => {
    expect(resolveColourRef(t, "ink", "C")).toBe("#231f20");
    expect(resolveColourRef(t, "paper", "C")).toBe("#ffffff");
    expect(resolveColourRef(t, "root", "A")).toBe("#88a7f8");
  });
});

describe("parseTheme: motif validation", () => {
  it("parses a theme without motifs to an object without motif keys", () => {
    const raw = clone();
    for (const k of ["paper", "contrast", "groove", "gradient"]) delete raw[k];
    const t = parseTheme(raw);
    for (const k of ["paper", "contrast", "groove", "gradient"]) expect(k in t, k).toBe(false);
  });

  it("refuses a sheen that takes ink under the body floor on any root", () => {
    const raw = clone();
    raw.gradient.stops[0].amount = 0.2; // 20% toward ink: C drops under 4.5
    expect(() => parseTheme(raw)).toThrow(/gradient: ink on C's darkest point is .* under the 4.5:1 body floor/);
  });

  it("refuses a sheen that takes 70% ink under the large floor", () => {
    const raw = clone();
    raw.contrast.large = 3.3; // C's muted ink is 3.21 on the 8% shade
    expect(() => parseTheme(raw)).toThrow(/large-text floor/);
  });

  it("refuses a gradient without contrast floors or paper", () => {
    const a = clone();
    delete a.contrast;
    expect(() => parseTheme(a)).toThrow(/gradient: needs "contrast"/);
    const b = clone();
    delete b.paper;
    expect(() => parseTheme(b)).toThrow(/groove: needs "paper"/);
  });

  it("refuses unordered stops and stops outside 0..1", () => {
    const a = clone();
    a.gradient.stops[2].at = 0.2;
    expect(() => parseTheme(a)).toThrow(/gradient\.stops: positions/);
    const b = clone();
    b.gradient.stops[3].amount = 1.2;
    expect(() => parseTheme(b)).toThrow(/gradient\.stops\[3\]\.amount/);
  });

  it("refuses a groove line too thin to print, or as thick as its pitch", () => {
    const a = clone();
    a.groove.fingerprint.stroke.pt = 0.1;
    expect(() => parseTheme(a)).toThrow(/groove\.fingerprint\.stroke\.pt: must be at least 0\.25pt/);
    const b = clone();
    b.groove.fingerprint.stroke.px = 8;
    expect(() => parseTheme(b)).toThrow(/stroke\.px: must be thinner/);
    const c = clone();
    delete c.groove.fingerprint.stroke.pt;
    expect(() => parseTheme(c)).toThrow(/groove\.fingerprint\.stroke\.pt: is required/);
  });

  it("refuses an unknown colour role, a missing default preset and fast ambient motion", () => {
    const a = clone();
    a.groove.fingerprint.grounds.dark.colour = "#ffffff";
    expect(() => parseTheme(a)).toThrow(/grounds\.dark\.colour: must be "ink", "paper" or "root"/);
    const b = clone();
    b.groove.fingerprint.defaultPreset = "corner-xx";
    expect(() => parseTheme(b)).toThrow(/defaultPreset/);
    const c = clone();
    c.groove.fingerprint.spin.secondsPerTurn = 5;
    expect(() => parseTheme(c)).toThrow(/at least 20s/);
    const d = clone();
    d.gradient.drift.secondsPerCycle = 3;
    expect(() => parseTheme(d)).toThrow(/drift\.secondsPerCycle/);
  });

  it("refuses label rings out of order", () => {
    const raw = clone();
    raw.groove.fingerprint.label.radius = 0.02;
    expect(() => parseTheme(raw)).toThrow(/groove\.fingerprint\.label/);
  });
});

describe("the theme ships in the package", () => {
  const pkg = JSON.parse(readFileSync(join(THEME_PATH, "..", "..", "package.json"), "utf8"));

  it("is exported as @pepperhorn/chordl-cards/themes/crf-default.json and listed in files", () => {
    expect(pkg.exports["./themes/crf-default.json"]).toBe("./themes/crf-default.json");
    expect(pkg.files).toContain("themes");
    expect(pkg.files).toContain("DESIGN.md");
  });
});
