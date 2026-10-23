// Specimen v2: the flat's thin 400 bowl at every weight, and the title's two
// accidental treatments side by side — "full" (letter-sized, the default) and
// "raised" (~62%, hung from cap height; theme fonts.titleRoot.accidental).
// Titles at 100 (root 700 white + 7pt ink stroke, quality 600/38), then the
// symbols at 38 / 26 / 18 (600). Writes review/accidentals-specimen-v2.html,
// and the .png with --png (Playwright resolved from --playwright <dir>).
//
//   npx tsx scripts/accidentals-specimen-v2.ts --fonts ../../../chordcards/assets/fonts \
//     --png --playwright ../../../chordcards
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { measureChordSymbol, renderChordSymbolSvg, type AccidentalWeight } from "../src/accidentals";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const fonts = resolve(arg("--fonts") ?? "../../../chordcards/assets/fonts");
const out = resolve("review/accidentals-specimen-v2.html");
const INK = "#231f20";
const GROUNDS = ["#b8a334", "#cc97e8", "#7de3dc", "#f4a259", "#a3e36f", "#f4845f"];
const W = 1700;
const COL = W / 2;
const face = (file: string, weight: number) =>
  `@font-face{font-family:Poppins;font-weight:${weight};src:url(data:font/ttf;base64,${readFileSync(resolve(fonts, file)).toString("base64")})}`;
const label = (text: string, x: number, y: number) =>
  `<text x="${x}" y="${y}" font-family="Poppins" font-size="15" font-weight="600" fill="${INK}" opacity="0.6">${text}</text>`;

const TITLES: [string, string][] = [["Eb", ""], ["Bb", "m7b5"], ["Ab", "maj7"], ["Db", ""], ["F#", ""], ["C#", "maj7"]];
const parts: string[] = [];
let y = 20;
for (const mode of ["full", "raised"] as const) parts.push(label(mode === "full" ? "FULL (default)" : "RAISED (theme option)", mode === "full" ? 24 : COL + 24, y + 10));
y += 24;

// 100pt titles, two per row per column.
for (let i = 0; i < TITLES.length; i += 2) {
  parts.push(`<rect x="0" y="${y}" width="${W}" height="150" fill="${GROUNDS[i / 2]}"/>`);
  for (const mode of ["full", "raised"] as const) {
    let x = (mode === "full" ? 0 : COL) + 30;
    for (const [root, q] of TITLES.slice(i, i + 2)) {
      const base = y + 120;
      const r = { weight: 700 as const, size: 100, accidentals: mode, fill: "#fff", stroke: INK, strokeWidth: 7, x, y: base, fontFamily: "Poppins" };
      parts.push(renderChordSymbolSvg(root, r));
      let end = x + measureChordSymbol(root, r);
      if (q) {
        const qo = { weight: 600 as const, size: 38, fill: INK, x: end + 8, y: base - 5, fontFamily: "Poppins" };
        parts.push(renderChordSymbolSvg(q, qo));
        end = qo.x + measureChordSymbol(q, qo);
      }
      x = end + 50;
    }
  }
  y += 160;
}
parts.push(`<line x1="${COL}" x2="${COL}" y1="30" y2="${y}" stroke="${INK}" stroke-width="1" opacity="0.3"/>`);

// Smaller sizes, whole symbols, ink on white, 600 (and 700 / 400 for weight check at 38).
const SYMBOLS = ["Eb", "Bbm7b5", "Abmaj7", "Db", "F#", "C#maj7"];
for (const [size, weight] of [[38, 700], [38, 600], [38, 400], [26, 600], [18, 600]] as [number, AccidentalWeight][]) {
  for (const mode of ["full", "raised"] as const) {
    const x0 = (mode === "full" ? 0 : COL) + 24;
    parts.push(label(`${size}pt / ${weight}`, x0, y + 14));
    let x = x0;
    for (const s of SYMBOLS) {
      const o = { weight, size, accidentals: mode, fill: INK, x, y: y + 22 + size, fontFamily: "Poppins" };
      parts.push(renderChordSymbolSvg(s, o));
      x += measureChordSymbol(s, o) + size * 0.9;
    }
  }
  y += size * 1.5 + 34;
}

const H = Math.ceil(y + 10);
const html = `<!doctype html><meta charset="utf-8"><style>${face("Poppins-Regular.ttf", 400)}${face("Poppins-SemiBold.ttf", 600)}${face("Poppins-Bold.ttf", 700)}
html,body{margin:0;background:#fff}</style>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("\n")}</svg>`;
mkdirSync(resolve("review"), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out}`);

if (process.argv.includes("--png")) {
  const { chromium } = createRequire(resolve(resolve(arg("--playwright") ?? "../../../chordcards"), "package.json"))("playwright");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const png = out.replace(/\.html$/, ".png");
  await page.screenshot({ path: png, fullPage: true });
  await browser.close();
  console.log(`wrote ${png}`);
}
