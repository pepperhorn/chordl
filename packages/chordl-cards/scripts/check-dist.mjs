// Fails the build if dist/ holds an ESM file that Node cannot load: a relative
// import without a file extension (what a stray `tsc` emit leaves behind —
// `export … from "./hands"`), or an entry point that does not import cleanly.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dist = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const RELATIVE = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;

const problems = [];
for (const file of readdirSync(dist).filter((f) => f.endsWith(".js"))) {
  const text = readFileSync(join(dist, file), "utf8");
  for (const [, spec] of text.matchAll(RELATIVE)) {
    if (!/\.(m?js|json)$/.test(spec)) problems.push(`${file}: "${spec}" has no extension`);
  }
}
for (const entry of ["model.js", "chordl-cards.js"]) {
  try {
    await import(pathToFileURL(join(dist, entry)).href);
  } catch (err) {
    problems.push(`${entry}: ${err.message.split("\n")[0]}`);
  }
}
if (problems.length) {
  console.error("dist/ is not loadable as Node ESM:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("dist/ ok: every relative import has an extension; entries load in Node");
