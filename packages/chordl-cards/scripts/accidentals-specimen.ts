// Specimen sheet for the accidental glyphs: each card role's size and weight,
// the glyphs beside Poppins letters, and the same strings in plain ASCII ("b",
// "#") for comparison. Writes review/accidentals-specimen.html; pass --png to
// rasterise it through Playwright (resolved from --playwright <dir>, e.g. a
// chordcards checkout, since this package does not depend on it).
//
//   npx tsx scripts/accidentals-specimen.ts --fonts ../../../chordcards/assets/fonts \
//     --png --playwright ../../../chordcards
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import {
  ACCIDENTAL_METRICS, accidentalGlyphs, glyphPathData, measureChordSymbol, measurePoppinsText, renderChordSymbolSvg,
  type AccidentalWeight,
} from "../src/accidentals";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const fonts = resolve(arg("--fonts") ?? "../../../chordcards/assets/fonts");
const out = resolve("review/accidentals-specimen.html");
const INK = "#231f20";
const GROUND = "#f4a259";
const W = 1600;

const face = (file: string, weight: number) =>
  `@font-face{font-family:Poppins;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(resolve(fonts, file)).toString("base64")})}`;

const parts: string[] = [];
let y = 30;
const label = (text: string, yy: number) =>
  `<text x="24" y="${yy}" font-family="Poppins" font-size="15" font-weight="600" fill="${INK}" opacity="0.6">${text}</text>`;

// 1. The glyphs large, on Poppins' guides, beside b / l / # / x at each weight.
for (const w of [400, 600, 700] as AccidentalWeight[]) {
  const size = 220;
  const base = y + 230;
  parts.push(label(`Poppins ${w} — guides: baseline, x-height ${ACCIDENTAL_METRICS.xHeight[w]}, cap ${ACCIDENTAL_METRICS.capHeight[w]}, ascender 740`, y + 10));
  for (const v of [0, ACCIDENTAL_METRICS.xHeight[w], ACCIDENTAL_METRICS.capHeight[w], 740]) {
    const gy = base - (v * size) / 1000;
    parts.push(`<line x1="24" x2="${W - 24}" y1="${gy}" y2="${gy}" stroke="#39f" stroke-width="1" opacity="0.5"/>`);
  }
  let x = 40;
  const seq: (string | "flat" | "sharp" | "natural")[] = ["H", "b", "flat", "l", "x", "sharp", "#", "natural", "E", "flat", "A", "flat", "F", "sharp"];
  for (const s of seq) {
    if (s === "flat" || s === "sharp" || s === "natural") {
      const g = accidentalGlyphs[w][s];
      parts.push(`<path d="${glyphPathData(g, x, base, size)}" fill="${INK}"/>`);
      x += (g.advance * size) / 1000;
    } else {
      parts.push(renderChordSymbolSvg(s, { weight: w, size, fill: INK, x, y: base, fontFamily: "Poppins" }));
      x += measureChordSymbol(s, { weight: w, size });
    }
  }
  y += 280;
}

// 2. Each card role, glyph version then ASCII version.
const STRINGS = ["Eb", "Bb", "m7b5", "F#", "C#maj7", "Db", "Abm7b5"];
const ascii = (s: string) => s; // plain Poppins text
const roles: { name: string; weight: AccidentalWeight; size: number }[] = [
  { name: "quality label 600 / 38", weight: 600, size: 38 },
  { name: "note names 600 / 26", weight: 600, size: 26 },
  { name: "small labels 600 / 18", weight: 600, size: 18 },
];

// The title: root 700/100 white with a 7pt ink stroke, quality 600/38 lifted 5, gap 8.
const TITLES: [string, string][] = [["Eb", "maj"], ["Bb", "min7"], ["F#", "7"], ["C#", "maj7"], ["Db", "maj"], ["Ab", "m7b5"]];
for (const glyphs of [true, false]) {
  parts.push(`<rect x="0" y="${y}" width="${W}" height="170" fill="${GROUND}"/>`);
  parts.push(label(`title 700 / 100 + quality 600 / 38 — ${glyphs ? "drawn accidentals" : "plain Poppins b / #"}`, y + 22));
  let x = 40;
  const base = y + 140;
  for (const [root, q] of TITLES) {
    const rootOpts = { weight: 700 as const, size: 100, fill: "#fff", stroke: INK, strokeWidth: 7, x, y: base, fontFamily: "Poppins" };
    const qx = x + (glyphs ? measureChordSymbol(root, rootOpts) : plainWidth(root, 700, 100)) + 8;
    const qOpts = { weight: 600 as const, size: 38, fill: INK, x: qx, y: base - 5, fontFamily: "Poppins" };
    parts.push(glyphs ? renderChordSymbolSvg(root, rootOpts) : plainText(root, rootOpts));
    parts.push(glyphs ? renderChordSymbolSvg(q, qOpts) : plainText(q, qOpts));
    x = qx + (glyphs ? measureChordSymbol(q, qOpts) : plainWidth(q, 600, 38)) + 46;
  }
  y += 180;
}

for (const role of roles) {
  for (const glyphs of [true, false]) {
    const h = role.size * 1.9 + 20;
    parts.push(label(`${role.name} — ${glyphs ? "drawn accidentals" : "plain Poppins b / #"}`, y + 16));
    let x = 40;
    const base = y + 22 + role.size * 1.15;
    for (const s of STRINGS) {
      const opts = { weight: role.weight, size: role.size, fill: INK, x, y: base, fontFamily: "Poppins" };
      parts.push(glyphs ? renderChordSymbolSvg(s, opts) : plainText(ascii(s), opts));
      x += (glyphs ? measureChordSymbol(s, opts) : plainWidth(s, role.weight, role.size)) + role.size * 1.4;
    }
    y += h;
  }
}

function plainText(s: string, o: { weight: number; size: number; fill: string; stroke?: string; strokeWidth?: number; x: number; y: number }) {
  const stroke = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.strokeWidth}" paint-order="stroke" stroke-linejoin="round"` : "";
  return `<text x="${o.x}" y="${o.y}" font-family="Poppins" font-size="${o.size}" font-weight="${o.weight}" fill="${o.fill}"${stroke}>${s}</text>`;
}
function plainWidth(s: string, weight: AccidentalWeight, size: number) {
  return measurePoppinsText(s, { weight, size });
}

const H = Math.ceil(y + 20);
const html = `<!doctype html><meta charset="utf-8"><style>${face("Poppins-Regular.ttf", 400)}${face("Poppins-SemiBold.ttf", 600)}${face("Poppins-Bold.ttf", 700)}
html,body{margin:0;background:#fff}</style>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("\n")}</svg>`;
mkdirSync(resolve("review"), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out}`);

if (process.argv.includes("--png")) {
  const from = resolve(arg("--playwright") ?? "../../../chordcards");
  const { chromium } = createRequire(resolve(from, "package.json"))("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const png = out.replace(/\.html$/, ".png");
  await page.screenshot({ path: png, fullPage: true });
  await browser.close();
  console.log(`wrote ${png}`);
}
