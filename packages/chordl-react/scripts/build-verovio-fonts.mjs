// Build verovio custom-font zips (Bravura, Petaluma) from the upstream verovio
// data files and commit them to the repo, so the notation renderer loads its
// fonts from bundled zips via verovio's `fontAddCustom` rather than depending
// on whatever is compiled into the verovio WASM build.
//
// Zip layout expected by verovio (see verovio src/resources.cpp):
//   <Font>.xml           bounding boxes (units-per-em + one <g> per glyph)
//   <Font>/<CODE>.xml    one SVG-path file per glyph
//
// Verovio also accepts a <Font>.css (an @font-face carrying an embedded woff2,
// for HTML output). We deliberately leave it out: this app renders to SVG with
// every glyph drawn as a <use> of an embedded path, so nothing references that
// face. Measured on Verovio 6.2.0 across both fonts and six chord shapes, the
// engraved geometry, glyph set and emitted <style> block are byte-identical
// with and without it — and it is 80 KB of the Bravura zip and 102 KB of
// Petaluma, ~193 KB of base64 once embedded. Put it back only if output starts
// carrying <text> in the music font, which is what would need the face.
//
// Compression level is left at zip's default 6 on purpose: level 9 was measured
// at 413,345 B against 412,846 B for Bravura — very slightly *worse*. These are
// ~880 small XML files, each deflated separately and already at its limit.
//
// Requires the `zip` binary on PATH. Rarely run — the zips are committed, and
// regenerating them re-fetches from verovio's `develop` branch, so only do it
// when deliberately taking an upstream font update.
//
// Usage: node scripts/build-verovio-fonts.mjs [Bravura Petaluma ...]
import { writeFile, mkdir, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const RAW = "https://raw.githubusercontent.com/rism-digital/verovio/develop/data";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fonts", "verovio");
const CONCURRENCY = 24;
const fonts = process.argv.slice(2).length ? process.argv.slice(2) : ["Bravura", "Petaluma"];

async function fetchText(url, tries = 4) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (attempt === tries) throw new Error(`${url}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, run));
  return results;
}

for (const font of fonts) {
  console.log(`\n=== ${font} ===`);
  const boundingXml = await fetchText(`${RAW}/${font}.xml`);
  if (!boundingXml) throw new Error(`${font}.xml not found upstream`);

  const codes = [...boundingXml.matchAll(/<g c="([0-9A-Fa-f]+)"/g)].map((m) => m[1]);
  console.log(`glyphs: ${codes.length}, fetching...`);

  const staging = join(OUT_DIR, `.staging-${font}`);
  await rm(staging, { recursive: true, force: true });
  await mkdir(join(staging, font), { recursive: true });
  await writeFile(join(staging, `${font}.xml`), boundingXml);

  let done = 0;
  await pool(codes, async (code) => {
    const glyph = await fetchText(`${RAW}/${font}/${code}.xml`);
    if (glyph) await writeFile(join(staging, font, `${code}.xml`), glyph);
    if (++done % 100 === 0 || done === codes.length) {
      process.stdout.write(`\r  ${done}/${codes.length}`);
    }
  });
  process.stdout.write("\n");

  const zipPath = join(OUT_DIR, `${font}.zip`);
  await rm(zipPath, { force: true });
  const files = [`${font}.xml`, font];
  const res = spawnSync("zip", ["-q", "-r", "-X", zipPath, ...files], { cwd: staging });
  if (res.status !== 0) throw new Error(`zip failed for ${font}: ${res.stderr}`);
  await rm(staging, { recursive: true, force: true });
  console.log(`wrote ${zipPath}`);
}
console.log("\nDone.");
