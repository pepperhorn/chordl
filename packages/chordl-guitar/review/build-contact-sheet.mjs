/**
 * Build review/contact-sheet.html (self-contained) and, when Playwright is
 * available, review/contact-sheet.png.
 *
 *   node review/build-contact-sheet.mjs
 *   PLAYWRIGHT=/path/to/node_modules/playwright node review/build-contact-sheet.mjs
 *
 * esbuild is not a dependency of this package; it is borrowed from the
 * workspace's vite install, as this is a review tool, not part of the build.
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = join(here, "..");
const react = join(pkg, "..", "chordl-react");
const requireFromVite = createRequire(createRequire(join(react, "package.json")).resolve("vite"));
const esbuild = requireFromVite("esbuild");

const result = await esbuild.build({
  entryPoints: [join(here, "contact-sheet.entry.tsx")],
  bundle: true,
  write: false,
  format: "iife",
  minify: true,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  alias: {
    "@pepperhorn/chordl-core": join(pkg, "..", "chordl-core", "src", "index.ts"),
    "@pepperhorn/chordl-voicings": join(pkg, "..", "chordl-voicings", "src", "index.ts"),
  },
  nodePaths: ["chordl-react", "chordl-core", "chordl-voicings"].map((p) => join(pkg, "..", p, "node_modules")),
  logLevel: "warning",
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Generated guitar voicings — teacher review</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
body { margin: 0; font-family: Poppins, sans-serif; background: #f7f7f5; color: #1c1c1c; }
.contact-sheet { padding: 24px 32px; }
.contact-sheet__header h1 { font-size: 22px; font-weight: 600; margin: 0 0 6px; }
.contact-sheet__header p { margin: 0 0 20px; font-size: 13px; color: #555; max-width: 900px; }
.contact-sheet__grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 14px; }
.voicing-card { margin: 0; background: #fff; border: 1px solid #e3e3df; border-radius: 10px; padding: 10px 8px; display: flex; flex-direction: column; align-items: center; }
.voicing-card__name { font-weight: 600; font-size: 14px; }
.voicing-card__grip { font-family: ui-monospace, monospace; font-size: 13px; font-weight: 600; margin-top: 4px; }
.voicing-card__meta { font-size: 11px; color: #a3460f; }
.voicing-card__rule { font-size: 9px; color: #888; text-align: center; line-height: 1.3; margin-top: 2px; }
</style></head>
<body><div id="root"></div><script>${js}</script></body></html>`;

const htmlPath = join(here, "contact-sheet.html");
writeFileSync(htmlPath, html);
console.log(`wrote ${htmlPath} (${(html.length / 1024).toFixed(0)} KB)`);

if (process.env.PLAYWRIGHT) {
  const { chromium } = await import(pathToFileURL(join(process.env.PLAYWRIGHT, "index.mjs")).href);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => document.querySelectorAll(".bc-guitar-chord svg").length >= 30, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const pngPath = join(here, "contact-sheet.png");
  await page.screenshot({ path: pngPath, fullPage: true });
  await browser.close();
  console.log(`wrote ${pngPath}`);
}
