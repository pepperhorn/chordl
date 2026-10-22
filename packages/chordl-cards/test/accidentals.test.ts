import { describe, it, expect } from "vitest";
import {
  ACCIDENTAL_METRICS, RAISED_SCALE, accidentalGlyphs, glyphBounds, measureChordSymbol, renderChordSymbolSvg,
  spokenChordSymbol, tokenizeChordSymbol, type AccidentalWeight,
} from "../src/accidentals";
import { POPPINS_ADVANCES, POPPINS_CHARS } from "../src/poppins-metrics";

const adv = (w: AccidentalWeight, ch: string) => POPPINS_ADVANCES[w][POPPINS_CHARS.indexOf(ch)];
const WEIGHTS: AccidentalWeight[] = [400, 600, 700];

describe("tokenizeChordSymbol", () => {
  it("reads a b after a note letter, or before a degree, as a flat", () => {
    expect(tokenizeChordSymbol("Eb")).toEqual([{ kind: "text", text: "E" }, { kind: "flat" }]);
    expect(tokenizeChordSymbol("m7b5")).toEqual([
      { kind: "text", text: "m7" }, { kind: "flat" }, { kind: "text", text: "5" },
    ]);
    expect(tokenizeChordSymbol("Abm7(b5)")).toEqual([
      { kind: "text", text: "A" }, { kind: "flat" }, { kind: "text", text: "m7(" },
      { kind: "flat" }, { kind: "text", text: "5)" },
    ]);
    expect(tokenizeChordSymbol("Bb Db")).toEqual([
      { kind: "text", text: "B" }, { kind: "flat" }, { kind: "text", text: " D" }, { kind: "flat" },
    ]);
    expect(tokenizeChordSymbol("Ebb")).toEqual([{ kind: "text", text: "E" }, { kind: "flat" }, { kind: "flat" }]);
  });

  it("reads every # as a sharp and passes the Unicode signs through", () => {
    expect(tokenizeChordSymbol("C#maj7")).toEqual([
      { kind: "text", text: "C" }, { kind: "sharp" }, { kind: "text", text: "maj7" },
    ]);
    expect(tokenizeChordSymbol("D♭♮♯")).toEqual([
      { kind: "text", text: "D" }, { kind: "flat" }, { kind: "natural" }, { kind: "sharp" },
    ]);
  });

  it("leaves a b inside a word alone", () => {
    expect(tokenizeChordSymbol("sub")).toEqual([{ kind: "text", text: "sub" }]);
    expect(tokenizeChordSymbol("dim")).toEqual([{ kind: "text", text: "dim" }]);
    expect(tokenizeChordSymbol("")).toEqual([]);
  });
});

describe("accidentalGlyphs", () => {
  it("has a flat, sharp and natural at every Poppins weight, set like characters", () => {
    for (const w of WEIGHTS) {
      for (const kind of ["flat", "sharp", "natural"] as const) {
        const g = accidentalGlyphs[w][kind];
        const b = glyphBounds(g);
        expect(g.advance).toBeGreaterThan(0);
        expect(b.xMin).toBeCloseTo(g.lsb, 0);
        expect(g.advance - b.xMax).toBeCloseTo(g.rsb, 0);
        expect(g.lsb).toBeGreaterThan(0);
        expect(g.rsb).toBeGreaterThan(0);
      }
    }
  });

  it("thickens only the flat's stem with weight, modestly, rising past cap height", () => {
    expect(accidentalGlyphs[400].flat.stem).toBe(ACCIDENTAL_METRICS.stem[400]);
    expect(accidentalGlyphs[600].flat.stem).toBeGreaterThan(accidentalGlyphs[400].flat.stem);
    expect(accidentalGlyphs[700].flat.stem).toBeGreaterThan(accidentalGlyphs[600].flat.stem);
    expect(accidentalGlyphs[700].flat.stem).toBeLessThan(ACCIDENTAL_METRICS.stem[700]);
    for (const w of WEIGHTS) {
      const flat = accidentalGlyphs[w].flat;
      const b = glyphBounds(flat);
      // Font units, y up: the stem tops out between cap height and ascender,
      // the bowl's point sits on the baseline.
      expect(b.yMax).toBeGreaterThanOrEqual(ACCIDENTAL_METRICS.capHeight[w]);
      expect(b.yMax).toBeLessThanOrEqual(ACCIDENTAL_METRICS.ascender);
      expect(b.yMin).toBeLessThanOrEqual(0);
    }
  });

  it("keeps the 400 bowl at every weight: same thin open teardrop, never a heavier belly", () => {
    // The counter, relative to the stem's right edge, is identical at every
    // weight, as are the bowl's top and its reach right of the stem.
    const counter = (w: AccidentalWeight) => {
      const g = accidentalGlyphs[w].flat;
      const xs = g.lsb + g.stem;
      return g.contours[1].map((cmd) => cmd.map((v, i) => (typeof v === "number" && i % 2 === 1 ? v - xs : v)));
    };
    expect(counter(600)).toEqual(counter(400));
    expect(counter(700)).toEqual(counter(400));
    expect(accidentalGlyphs[700].flat.bowlTop).toBe(accidentalGlyphs[400].flat.bowlTop);
    expect(accidentalGlyphs[700].flat.advance - accidentalGlyphs[700].flat.stem)
      .toBe(accidentalGlyphs[400].flat.advance - accidentalGlyphs[400].flat.stem);
  });

  it("keeps the flat's bowl below x-height, so it never reads as a lower-case b", () => {
    for (const w of WEIGHTS) {
      expect(accidentalGlyphs[w].flat.bowlTop!).toBeLessThan(ACCIDENTAL_METRICS.xHeight[w]);
    }
  });

  it("gets heavier with the weight", () => {
    expect(ACCIDENTAL_METRICS.stem[400]).toBe(91);
    expect(ACCIDENTAL_METRICS.stem[600]).toBe(140);
    expect(ACCIDENTAL_METRICS.stem[700]).toBe(171);
  });
});

describe("measureChordSymbol", () => {
  it("adds Poppins' advances for text and the glyph advances for accidentals", () => {
    const w = 700;
    const expected = (adv(w, "E") + accidentalGlyphs[w].flat.advance) / 10;
    expect(measureChordSymbol("Eb", { weight: w, size: 100 })).toBeCloseTo(expected, 6);
    expect(measureChordSymbol("m7", { weight: 600, size: 38 }))
      .toBeCloseTo(((adv(600, "m") + adv(600, "7")) * 38) / 1000, 6);
  });

  it("throws on a character it has no metrics for, rather than guessing", () => {
    expect(() => measureChordSymbol("C△", { weight: 600, size: 10 })).toThrow(/△/);
  });
});

describe("renderChordSymbolSvg", () => {
  it("sets text runs as <text> and accidentals as <path>, each at its measured x", () => {
    const svg = renderChordSymbolSvg("Bbm7b5", {
      weight: 600, size: 38, fill: "#231f20", x: 10, y: 50, fontFamily: "Poppins, sans-serif",
    });
    const texts = [...svg.matchAll(/<text [^>]*x="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map((m) => [Number(m[1]), m[2]]);
    expect(texts.map((t) => t[1])).toEqual(["B", "m7", "5"]);
    expect(texts[0][0]).toBeCloseTo(10, 4);
    const k = 38 / 1000;
    const flat = accidentalGlyphs[600].flat.advance * k;
    expect(texts[1][0]).toBeCloseTo(10 + adv(600, "B") * k + flat, 3);
    expect((svg.match(/class="chord-accidental chord-accidental-flat"/g) ?? []).length).toBe(2);
    expect(svg).not.toMatch(/>b</);
  });

  it("centres on x with anchor middle, and carries the stroke onto the glyphs", () => {
    const opts = { weight: 700 as const, size: 100, fill: "#fff", stroke: "#231f20", strokeWidth: 7, x: 200, y: 90, anchor: "middle" as const };
    const svg = renderChordSymbolSvg("Eb", opts);
    const w = measureChordSymbol("Eb", opts);
    const x0 = Number(svg.match(/<text [^>]*x="([\d.]+)"/)![1]);
    expect(x0).toBeCloseTo(200 - w / 2, 3);
    expect(svg).toMatch(/<path class="chord-accidental chord-accidental-flat"[^>]*fill="#fff"[^>]*stroke="#231f20"[^>]*stroke-width="7"[^>]*paint-order="stroke"/);
  });

  it("gives the glyphs the runs' class too, so a role's pieces are found together", () => {
    const svg = renderChordSymbolSvg("Eb", { weight: 600, size: 26, fill: "#000", className: "keyboard-note-label" });
    expect(svg).toMatch(/<text class="keyboard-note-label" /);
    expect(svg).toMatch(/<path class="keyboard-note-label chord-accidental chord-accidental-flat" /);
  });
});

describe("raised accidentals", () => {
  it("sets the glyph at ~62% and hangs it from cap height", () => {
    const opts = { weight: 700 as const, size: 100, fill: "#fff", x: 0, y: 100, accidentals: "raised" as const };
    const full = measureChordSymbol("Eb", { weight: 700, size: 100 });
    const raised = measureChordSymbol("Eb", opts);
    const g = accidentalGlyphs[700].flat;
    expect(full - raised).toBeCloseTo((g.advance * (1 - RAISED_SCALE)) / 10, 6);
    expect(RAISED_SCALE).toBeGreaterThanOrEqual(0.6);
    expect(RAISED_SCALE).toBeLessThanOrEqual(0.65);
    const d = renderChordSymbolSvg("Eb", opts).match(/<path[^>]* d="([^"]+)"/)![1];
    const ys = [...d.matchAll(/-?[\d.]+ (-?[\d.]+)/g)].map((m) => Number(m[1]));
    // Top of the glyph on the cap line (y down: baseline 100 minus cap height).
    expect(Math.min(...ys)).toBeCloseTo(100 - ACCIDENTAL_METRICS.capHeight[700] / 10, 0);
  });
});

describe("spokenChordSymbol", () => {
  it("says the accidentals as words", () => {
    expect(spokenChordSymbol("Eb")).toBe("E flat");
    expect(spokenChordSymbol("F#")).toBe("F sharp");
    expect(spokenChordSymbol("m7b5")).toBe("m7 flat 5");
    expect(spokenChordSymbol("Bb Db")).toBe("B flat D flat");
  });
});
