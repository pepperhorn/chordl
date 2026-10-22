import { describe, it, expect } from "vitest";
import {
  ACCIDENTAL_METRICS, accidentalGlyphs, glyphBounds, measureChordSymbol, renderChordSymbolSvg,
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

  it("draws the flat's stem at Poppins' own stem weight, rising past cap height", () => {
    for (const w of WEIGHTS) {
      const flat = accidentalGlyphs[w].flat;
      expect(flat.stem).toBe(ACCIDENTAL_METRICS.stem[w]);
      const b = glyphBounds(flat);
      // Font units, y up: the stem tops out between cap height and ascender,
      // the bowl's point sits on the baseline.
      expect(b.yMax).toBeGreaterThanOrEqual(ACCIDENTAL_METRICS.capHeight[w]);
      expect(b.yMax).toBeLessThanOrEqual(ACCIDENTAL_METRICS.ascender);
      expect(b.yMin).toBeLessThanOrEqual(0);
    }
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
});

describe("spokenChordSymbol", () => {
  it("says the accidentals as words", () => {
    expect(spokenChordSymbol("Eb")).toBe("E flat");
    expect(spokenChordSymbol("F#")).toBe("F sharp");
    expect(spokenChordSymbol("m7b5")).toBe("m7 flat 5");
    expect(spokenChordSymbol("Bb Db")).toBe("B flat D flat");
  });
});
