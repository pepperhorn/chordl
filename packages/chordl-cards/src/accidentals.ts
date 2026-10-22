/**
 * Accidental glyphs drawn to sit in Poppins, and a chord-symbol setter that
 * uses them.
 *
 * Poppins has no ♭/♯/♮, so labels were written in ASCII and a flat printed as
 * a lower-case "b" — which reads as the letter. These are music accidentals
 * drawn on Poppins' own grid (unitsPerEm 1000) from its own metrics, read off
 * the TTFs print embeds (scripts/poppins-metrics.py):
 *
 *   cap height 698 / 701 / 705, x-height 548 / 554 / 558 (400 / 600 / 700);
 *   ascender of b, d, l: 740; vertical stem ("l", "H"): 91 / 140 / 171;
 *   horizontal stroke (the bowl of "o", top and bottom): 80 / 122 / 148.
 *
 * Geometric like Poppins: monoline-ish, flat-cut stem ends, round shoulders.
 *
 * - Flat: a stem rising just past cap height (thickening half as fast as
 *   Poppins' stems with weight), and the 400-weight teardrop bowl at every
 *   weight, hung off it whose top stays under x-height and whose bottom
 *   tapers into a point at the foot of the stem — the engraved flat, not the
 *   round bowl of a "b".
 * - Sharp: two upright stems (0.62 of the stem width, the right one set higher)
 *   crossed by two heavier bars rising to the right.
 * - Natural: the two stems split top-left / bottom-right, joined by the same
 *   rising bars.
 *
 * Contours are in font units, y up, baseline 0. Each glyph carries its advance
 * and sidebearings so a run sets them like characters. Shapes overlap freely
 * (nonzero, same winding; the flat's counter is wound the other way): a fill
 * gives the union, and a `paint-order: stroke` outline (the card title) only
 * shows the outer edge because the fill covers every inner one.
 */
import { POPPINS_ADVANCES, POPPINS_CHARS } from "./poppins-metrics";

export type AccidentalWeight = 400 | 600 | 700;
export type AccidentalKind = "flat" | "sharp" | "natural";

type Cmd = ["M", number, number] | ["L", number, number] | ["C", number, number, number, number, number, number] | ["Z"];

export interface AccidentalGlyph {
  kind: AccidentalKind;
  /** Advance width, font units. */
  advance: number;
  lsb: number;
  rsb: number;
  /** Closed contours, font units, y up. */
  contours: Cmd[][];
  /** The stem width this glyph was drawn at. */
  stem: number;
  /** Flat only: the highest point of the bowl. */
  bowlTop?: number;
}

export const ACCIDENTAL_METRICS = {
  unitsPerEm: 1000,
  ascender: 740,
  capHeight: { 400: 698, 600: 701, 700: 705 } as Record<AccidentalWeight, number>,
  xHeight: { 400: 548, 600: 554, 700: 558 } as Record<AccidentalWeight, number>,
  stem: { 400: 91, 600: 140, 700: 171 } as Record<AccidentalWeight, number>,
  horizontal: { 400: 80, 600: 122, 700: 148 } as Record<AccidentalWeight, number>,
} as const;

const r = (n: number) => Math.round(n);

/** A polygon as one contour (points in order). */
const poly = (pts: [number, number][]): Cmd[] => [
  ["M", r(pts[0][0]), r(pts[0][1])],
  ...pts.slice(1).map(([x, y]) => ["L", r(x), r(y)] as Cmd),
  ["Z"],
];

/** Signed area of a contour's polygon hull (control points included; the sign is what matters). */
function signedArea(c: Cmd[]): number {
  const pts: [number, number][] = [];
  for (const cmd of c) {
    if (cmd[0] === "M" || cmd[0] === "L") pts.push([cmd[1], cmd[2]]);
    else if (cmd[0] === "C") pts.push([cmd[1], cmd[2]], [cmd[3], cmd[4]], [cmd[5], cmd[6]]);
  }
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** The same contour traced the other way round. */
function reverse(c: Cmd[]): Cmd[] {
  const start: [number, number] = [c[0][1] as number, c[0][2] as number];
  const segs: { from: [number, number]; cmd: Cmd }[] = [];
  let cur = start;
  for (const cmd of c.slice(1)) {
    if (cmd[0] === "Z") break;
    segs.push({ from: cur, cmd });
    cur = cmd[0] === "C" ? [cmd[5], cmd[6]] : [cmd[1] as number, cmd[2] as number];
  }
  // Close back to the start explicitly so every edge survives the reversal.
  if (cur[0] !== start[0] || cur[1] !== start[1]) segs.push({ from: cur, cmd: ["L", start[0], start[1]] });
  const out: Cmd[] = [["M", start[0], start[1]]];
  for (const { from, cmd } of segs.reverse()) {
    out.push(cmd[0] === "C" ? ["C", cmd[3], cmd[4], cmd[1], cmd[2], from[0], from[1]] : ["L", from[0], from[1]]);
  }
  out.push(["Z"]);
  return out;
}

/** Outer shapes counter-clockwise (y up), counters clockwise. */
const wound = (c: Cmd[], outer: boolean) => ((signedArea(c) > 0) === outer ? c : reverse(c));

function flat(w: AccidentalWeight): AccidentalGlyph {
  // Only the stem follows the weight, and only half way to Poppins' own stem:
  // a heavier bowl filled its counter and grew a "b"'s belly at 600/700. The
  // bowl is the 400 drawing at every weight — a thin, open teardrop.
  const S = r(ACCIDENTAL_METRICS.stem[400] + 0.5 * (ACCIDENTAL_METRICS.stem[w] - ACCIDENTAL_METRICS.stem[400]));
  const B = ACCIDENTAL_METRICS.stem[400]; // the bowl's own weight: Poppins 400
  const H = ACCIDENTAL_METRICS.horizontal[400];
  const xh = ACCIDENTAL_METRICS.xHeight[400];
  const lsb = 60;
  const rsb = 40;
  const top = 730; // past cap height (698-705), short of the ascender (740)
  const Wo = 210 + 0.95 * B; // bowl, stem's right edge to the bowl's outer right
  const L = lsb;
  const xs = L + S;
  const xr = xs + Wo;
  const peak = 0.84 * xh; // under x-height: never the bowl of a "b"
  const join = peak - 1.0 * H; // the shoulder rises off the stem to its peak
  const yR = 0.55 * peak; // the bowl's widest point, low: a teardrop, not a circle

  // Outer: stem, shoulder, round right side, then a near-straight run down to
  // a point at the stem's foot.
  const outer: Cmd[] = [
    ["M", L, 0], ["L", L, top], ["L", xs, top], ["L", xs, r(join)],
    ["C", r(xs + 0.3 * Wo), r(peak + 0.35 * (peak - join)), r(xr), r(0.98 * peak), r(xr), r(yR)],
    ["C", r(xr), r(0.6 * yR), r(xs + 0.5 * Wo), r(0.3 * yR), L, 0],
    ["Z"],
  ];

  const wall = 0.78 * B; // the bowl's right side, near a stem's weight
  const xi = xr - wall;
  const Wi = xi - xs;
  const iPeak = peak - 0.92 * H;
  const iJoin = join - 1.1 * H;
  const iyR = 0.95 * yR;
  const iFoot = 1.15 * H;
  const counter: Cmd[] = [
    ["M", xs, r(iJoin)],
    ["C", r(xs + 0.3 * Wi), r(iPeak + 0.3 * (iPeak - iJoin)), r(xi), r(0.97 * iPeak), r(xi), r(iyR)],
    ["C", r(xi), r(0.55 * iyR), r(xs + 0.45 * Wi), r(iFoot + 0.15 * (iyR - iFoot)), xs, r(iFoot)],
    ["Z"],
  ];

  const glyph: AccidentalGlyph = {
    kind: "flat", advance: r(xr + rsb), lsb, rsb, stem: S,
    contours: [wound(outer, true), wound(counter, false)],
  };
  glyph.bowlTop = r(curveMaxY(outer));
  return glyph;
}

/** Two rising bars, as polygons spanning x0..x1, centred (at x0) on y0 and y1. */
function bars(x0: number, x1: number, ys: number[], thick: number, rise: number): Cmd[][] {
  return ys.map((y) => poly([
    [x0, y - thick / 2], [x1, y - thick / 2 + rise], [x1, y + thick / 2 + rise], [x0, y + thick / 2],
  ]));
}

function sharp(w: AccidentalWeight): AccidentalGlyph {
  const S = ACCIDENTAL_METRICS.stem[w];
  const H = ACCIDENTAL_METRICS.horizontal[w];
  const lsb = 30;
  const rsb = 30;
  const body = 330 + 0.5 * S; // bar length
  const V = 0.62 * S; // the uprights are the lighter strokes
  const B = 0.98 * H; // the bars carry the weight, as in an engraved sharp
  const rise = 0.22 * body;
  const x0 = lsb;
  const x1 = lsb + body;
  const lx = x0 + 0.28 * body - V / 2;
  const rx = x0 + 0.72 * body - V / 2;
  const contours = [
    poly([[lx, -50], [lx + V, -50], [lx + V, 690], [lx, 690]]),
    poly([[rx, 0], [rx + V, 0], [rx + V, 740], [rx, 740]]),
    ...bars(x0, x1, [185, 455], B, rise),
  ].map((c) => wound(c, true));
  return { kind: "sharp", advance: r(x1 + rsb), lsb, rsb, stem: S, contours };
}

function natural(w: AccidentalWeight): AccidentalGlyph {
  const S = ACCIDENTAL_METRICS.stem[w];
  const H = ACCIDENTAL_METRICS.horizontal[w];
  const lsb = 60;
  const rsb = 50;
  const V = 0.75 * S;
  const body = 220 + 0.5 * S;
  const B = 1.05 * H;
  const rise = 0.2 * body;
  const x0 = lsb;
  const x1 = lsb + body;
  const lowY = 170;
  const highY = 470;
  const contours = [
    poly([[x0, lowY - B / 2], [x0 + V, lowY - B / 2], [x0 + V, 740], [x0, 740]]),
    poly([[x1 - V, -180], [x1, -180], [x1, highY + rise + B / 2], [x1 - V, highY + rise + B / 2]]),
    ...bars(x0, x1, [lowY, highY], B, rise),
  ].map((c) => wound(c, true));
  return { kind: "natural", advance: r(x1 + rsb), lsb, rsb, stem: S, contours };
}

/** Points along a contour, curves sampled. */
function samplePoints(c: Cmd[]): [number, number][] {
  const pts: [number, number][] = [];
  let cur: [number, number] = [0, 0];
  for (const cmd of c) {
    if (cmd[0] === "M" || cmd[0] === "L") {
      cur = [cmd[1], cmd[2]];
      pts.push(cur);
    } else if (cmd[0] === "C") {
      const [, x1, y1, x2, y2, x, y] = cmd;
      for (let i = 1; i <= 24; i++) {
        const t = i / 24;
        const u = 1 - t;
        pts.push([
          u * u * u * cur[0] + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
          u * u * u * cur[1] + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
        ]);
      }
      cur = [x, y];
    }
  }
  return pts;
}

function curveMaxY(c: Cmd[]): number {
  // The bowl only: skip the stem's corners (x at or left of the stem's right edge).
  const xs = c[2][0] === "L" ? (c[2][1] as number) : 0;
  return Math.max(...samplePoints(c).filter(([x]) => x > xs).map(([, y]) => y));
}

/** Ink bounds of a glyph in font units (y up). */
export function glyphBounds(g: AccidentalGlyph): { xMin: number; xMax: number; yMin: number; yMax: number } {
  const pts = g.contours.flatMap(samplePoints);
  return {
    xMin: Math.min(...pts.map((p) => p[0])),
    xMax: Math.max(...pts.map((p) => p[0])),
    yMin: Math.min(...pts.map((p) => p[1])),
    yMax: Math.max(...pts.map((p) => p[1])),
  };
}

const WEIGHTS: AccidentalWeight[] = [400, 600, 700];

/** Flat, sharp and natural for each Poppins weight print uses. */
export const accidentalGlyphs: Record<AccidentalWeight, Record<AccidentalKind, AccidentalGlyph>> =
  Object.fromEntries(WEIGHTS.map((w) => [w, { flat: flat(w), sharp: sharp(w), natural: natural(w) }])) as never;

/** SVG path data for a glyph placed with its origin at (x, baseline y), `size` units per em, y down. */
export function glyphPathData(g: AccidentalGlyph, x: number, y: number, size: number): string {
  const k = size / ACCIDENTAL_METRICS.unitsPerEm;
  const f = (n: number) => String(Math.round(n * 1000) / 1000);
  const X = (u: number) => f(x + u * k);
  const Y = (v: number) => f(y - v * k);
  return g.contours.map((c) => c.map((cmd) => {
    switch (cmd[0]) {
      case "M": return `M${X(cmd[1])} ${Y(cmd[2])}`;
      case "L": return `L${X(cmd[1])} ${Y(cmd[2])}`;
      case "C": return `C${X(cmd[1])} ${Y(cmd[2])} ${X(cmd[3])} ${Y(cmd[4])} ${X(cmd[5])} ${Y(cmd[6])}`;
      default: return "Z";
    }
  }).join("")).join("");
}

export type ChordToken = { kind: "text"; text: string } | { kind: AccidentalKind };

const SIGNS: Record<string, AccidentalKind> = { "♭": "flat", "♯": "sharp", "♮": "natural", "#": "sharp" };

/**
 * Splits a chord symbol or note name into text runs and accidentals. "#" is
 * always a sharp. A "b" is a flat when it follows a note letter (A-G) or
 * another flat ("Eb", "Ebb", "Bb Db") or comes before a degree ("m7b5",
 * "7(b9)"); any other "b" is a letter.
 */
export function tokenizeChordSymbol(text: string): ChordToken[] {
  const out: ChordToken[] = [];
  let run = "";
  const flush = () => {
    if (run) out.push({ kind: "text", text: run });
    run = "";
  };
  let prevFlat = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const sign = SIGNS[ch];
    const isFlat = ch === "b" && (/[A-G]/.test(text[i - 1] ?? "") || prevFlat || /\d/.test(text[i + 1] ?? ""));
    if (sign || isFlat) {
      flush();
      const kind = sign ?? "flat";
      out.push({ kind });
      prevFlat = kind === "flat";
    } else {
      run += ch;
      prevFlat = false;
    }
  }
  flush();
  return out;
}

const WORDS: Record<AccidentalKind, string> = { flat: "flat", sharp: "sharp", natural: "natural" };

/** "Eb" -> "E flat", "m7b5" -> "m7 flat 5": what a screen reader should say. */
export function spokenChordSymbol(text: string): string {
  return tokenizeChordSymbol(text)
    .map((t) => (t.kind === "text" ? t.text : ` ${WORDS[t.kind]} `))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ChordSymbolMetrics {
  weight: AccidentalWeight;
  /** Font size, in the caller's units. */
  size: number;
  /**
   * "full" (default): accidentals at full size on the baseline, like letters.
   * "raised": the chord-chart convention — set at RAISED_SCALE and hung from
   * cap height, superscript-like.
   */
  accidentals?: "full" | "raised";
}

/** Size of a raised accidental relative to a full one (~62% of cap height). */
export const RAISED_SCALE = 0.62;

const glyphScale = (m: ChordSymbolMetrics) => (m.accidentals === "raised" ? RAISED_SCALE : 1);

function textAdvance(text: string, weight: AccidentalWeight): number {
  let sum = 0;
  for (const ch of text) {
    const i = POPPINS_CHARS.indexOf(ch);
    if (i < 0) throw new Error(`no Poppins metrics for "${ch}" in "${text}"`);
    sum += POPPINS_ADVANCES[weight][i];
  }
  return sum;
}

/** A run's width set entirely in Poppins (no glyph substitution): "Eb" with a letter b. */
export function measurePoppinsText(text: string, { weight, size }: ChordSymbolMetrics): number {
  return (textAdvance(text, weight) * size) / ACCIDENTAL_METRICS.unitsPerEm;
}

/** One token's advance, font units. */
function tokenAdvance(t: ChordToken, m: ChordSymbolMetrics): number {
  return t.kind === "text" ? textAdvance(t.text, m.weight) : accidentalGlyphs[m.weight][t.kind].advance * glyphScale(m);
}

/** The set width of a chord symbol: Poppins' real advances plus the glyphs'. */
export function measureChordSymbol(text: string, m: ChordSymbolMetrics): number {
  const units = tokenizeChordSymbol(text).reduce((s, t) => s + tokenAdvance(t, m), 0);
  return (units * m.size) / ACCIDENTAL_METRICS.unitsPerEm;
}

export interface ChordSymbolSvgOptions extends ChordSymbolMetrics {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  /** Anchor point; `y` is the baseline. */
  x?: number;
  y?: number;
  anchor?: "start" | "middle" | "end";
  fontFamily?: string;
  /** Extra attributes for each <text> run (e.g. a font-variation style). */
  textAttrs?: string;
  /** Class on each <text> run; glyphs get it too, then "chord-accidental chord-accidental-<kind>". */
  className?: string;
}

const escapeXml = (s: string) =>
  s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

/**
 * The chord symbol as an SVG fragment: each text run a <text> at its measured
 * x (start-anchored), each accidental a <path>. With `stroke`, every piece
 * carries the stroke under its fill (`paint-order: stroke`). Poppins has no
 * Latin kerning, so measured x is where the renderer sets the run.
 */
export function renderChordSymbolSvg(text: string, opts: ChordSymbolSvgOptions): string {
  const { weight, size, fill } = opts;
  const k = size / ACCIDENTAL_METRICS.unitsPerEm;
  const width = measureChordSymbol(text, opts);
  const anchorShift = opts.anchor === "middle" ? width / 2 : opts.anchor === "end" ? width : 0;
  let x = (opts.x ?? 0) - anchorShift;
  const y = opts.y ?? 0;
  const n = (v: number) => String(Math.round(v * 1000) / 1000);
  const stroke = opts.stroke
    ? ` stroke="${opts.stroke}" stroke-width="${opts.strokeWidth ?? 1}" paint-order="stroke" stroke-linejoin="round"`
    : "";
  const cls = opts.className ? ` class="${opts.className}"` : "";
  const family = escapeXml(opts.fontFamily ?? "Poppins, sans-serif");
  const extra = opts.textAttrs ? ` ${opts.textAttrs}` : "";
  return tokenizeChordSymbol(text).map((t) => {
    let out: string;
    if (t.kind === "text") {
      out = `<text${cls} x="${n(x)}" y="${n(y)}" font-family="${family}" font-size="${size}" ` +
        `font-weight="${weight}" xml:space="preserve"${extra} fill="${fill}"${stroke}>${escapeXml(t.text)}</text>`;
    } else {
      const g = accidentalGlyphs[weight][t.kind];
      const gs = glyphScale(opts);
      // Raised: the scaled glyph's top on the cap line.
      const lift = gs === 1 ? 0 : (ACCIDENTAL_METRICS.capHeight[weight] - glyphBounds(g).yMax * gs) * k;
      out = `<path class="${opts.className ? `${opts.className} ` : ""}chord-accidental chord-accidental-${t.kind}" d="${glyphPathData(g, x, y - lift, size * gs)}" ` +
        `fill="${fill}"${stroke}/>`;
    }
    x += tokenAdvance(t, opts) * k;
    return out;
  }).join("");
}
