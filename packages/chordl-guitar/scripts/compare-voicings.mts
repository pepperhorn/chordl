/**
* Local-only before/after audit. Run from the repository root:
* node_modules/.bin/tsx packages/chordl-guitar/scripts/compare-voicings.mts \
*   --plain /path/plain/verdicts.json --slash /path/slash/verdicts.json \
*   --missing /path/missing38.json --out /path/output \
*   --baseline-ref d307e3b378c6864cd61fc39f6571cf0ee1a81586
*
* Regenerates both versions from source, checks the baseline against the
* independent verdict files, and writes report.md, rows.json and contact-sheet.html.
* Does not write to the catalogue source or contact any service.
*/
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spelledChord } from "../../chordl-cards/src/catalogue.ts";
import { guitarPositionFor } from "../src/guitarPosition.ts";
import { analyzeChordTones, generateGuitarVoicings, positionSpellsChord } from "../src/voicingGenerator.ts";
import { reviewGuitarPosition } from "../src/voicingReview.ts";
import type { GuitarPosition } from "../src/guitarPosition.ts";
import type { GuitarReview } from "../src/voicingReview.ts";
const flags = Object.fromEntries(Array.from({ length: (process.argv.length - 2) / 2 }, (_, i) => process.argv.slice(2 + i * 2, 4 + i * 2)));
for (const arg of ["--plain", "--slash", "--missing", "--out"])
  if (!flags[arg])
    throw Error(`Missing ${arg}; see script header`);
const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = resolve(flags["--out"]);
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const provenance = {
  inputs: Object.fromEntries(["--plain", "--slash", "--missing"].map(k => [k, {path:resolve(flags[k]), sha256:sha256(flags[k])}])),
  source: Object.fromEntries(["voicingGenerator.ts", "guitarPosition.ts", "voicingReview.ts"].map(name => [name,sha256(resolve(repo,"packages/chordl-guitar/src",name))])),
};
const baselineRef = flags["--baseline-ref"] ?? "d307e3b378c6864cd61fc39f6571cf0ee1a81586";
const baselineHead = execFileSync("git", ["rev-parse", `${baselineRef}^{commit}`], { cwd: repo, encoding: "utf8" }).trim();
const temp = mkdtempSync(join(tmpdir(), "guitar-baseline-"));
// Isolate old modules without changing the working checkout. Their unchanged
// data/hand dependencies come from this package; generator and selector are old.
writeFileSync(join(temp, "package.json"), '{"type":"module"}');
for (const name of ["voicingGenerator", "guitarPosition"]) {
  let source = execFileSync("git", ["show", `${baselineHead}:packages/chordl-guitar/src/${name}.ts`], { cwd: repo, encoding: "utf8" });
  source = source.replace(/from "\.\/([^"\n]+)"/g, (_, relative: string) => {
    const target = relative === "voicingGenerator.js" ? join(temp, "voicingGenerator.ts") : resolve(repo, "packages/chordl-guitar/src", relative.replace(/\.js$/, ".ts"));
    return `from "${pathToFileURL(target).href}"`;
  });
  writeFileSync(join(temp, `${name}.ts`), source);
}
const { guitarPositionFor: beforeFor } = await import(pathToFileURL(join(temp, "guitarPosition.ts")).href);
const { analyzeChordTones: oldAnalyze } = await import(pathToFileURL(join(temp, "voicingGenerator.ts")).href);
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const abs = (p: any): number[] => p.frets.map((f: number) => f <= 0 ? f : f + p.baseFret - 1);
const changed = (a: any, b: any) => !a || !b || abs(a).join() !== abs(b).join() || a.fingers.join() !== b.fingers.join() || a.barres.join() !== b.barres.join();
const tally = (items: string[]) => Object.fromEntries([...new Set(items)].sort().map(k => [k, items.filter(v => v === k).length]));
type Row = {
  group: string;
  slug: string;
  symbol: string;
  verdict: string;
  changed: boolean;
  fretsChanged: boolean;
  before: any;
  after: GuitarPosition | null;
  previousReview: GuitarReview;
  afterReview: GuitarReview | null;
  oldFrets: number[];
  newFrets: number[] | null;
};
const rows: Row[] = [];
const mismatch: string[] = [];
const defaultLevelMissing: string[] = [];
for (const group of ["plain", "slash"]) {
  const oracle = read(flags[`--${group}`]);
  if (oracle.length !== (group === "plain" ? 700 : 2457))
    throw Error(`Unexpected ${group} oracle size: ${oracle.length}`);
  for (const v of oracle) {
    const chord = spelledChord(v.symbol, { strict: true });
    const before = beforeFor(chord);
    if (!before || abs(before).join() !== v.current_frets.join() || before.fingers.join() !== v.current_fingers.join())
      mismatch.push(v.slug);
    if (!before)
      throw Error(`No baseline shape: ${v.symbol}`);
    if (!guitarPositionFor(chord)) defaultLevelMissing.push(v.symbol);
    const after = guitarPositionFor(chord, { level: 3 });
    const analysis = analyzeChordTones(chord.root, chord.pitchClasses, chord.bass, { level: 3 });
    if (after && !positionSpellsChord(after, analysis))
      throw Error(`Invalid after shape: ${v.symbol}`);
    // Compare identical review heuristics on the old/new geometries. Old tone
    // policy is used only to label legitimate old omissions (including the R1 bug).
    const old = oldAnalyze(chord.root, chord.pitchClasses, chord.bass);
    const previousReview = reviewGuitarPosition(before, old, { level: 3, origin: before.generated ? "search" : "chords-db" });
    rows.push({ group, slug: v.slug, symbol: v.symbol, verdict: v.verdict, changed: changed(before, after), fretsChanged: !after || abs(before).join() !== abs(after).join(), before, after, previousReview, afterReview: after?.review ?? null, oldFrets: abs(before), newFrets: after ? abs(after) : null });
  }
}
if (mismatch.length)
  throw Error(`Baseline differs from ${mismatch.length} oracle rows: ${mismatch.slice(0, 15).join(", ")}`);
const missing = Object.keys(read(flags["--missing"])).map(symbol => {
  const chord = spelledChord(symbol, { strict: true });
  const before = beforeFor(chord), after = guitarPositionFor(chord, { level: 3 });
  if (before) throw Error(`Missing-list baseline already has a shape: ${symbol}`);
  if (after && !positionSpellsChord(after,analyzeChordTones(chord.root,chord.pitchClasses,chord.bass,{level:3}))) throw Error(`Invalid recovery: ${symbol}`);
  return { symbol, before: before ? abs(before) : null, after: after ? abs(after) : null, review: after?.review ?? null, rootless: after?.generated ? after.rootless : false };
});
const table = ["| Group / verdict | Rows | Changed | Unchanged |", "|---|---:|---:|---:|"];
for (const group of ["plain", "slash"])
  for (const verdict of ["accept", "accept-with-note", "replace", "no-good-shape"]) {
    const r = rows.filter(r => r.group === group && r.verdict === verdict);
    table.push(`| ${group} / ${verdict} | ${r.length} | ${r.filter(r => r.changed).length} | ${r.filter(r => !r.changed).length} |`);
  }
const reviews = rows.flatMap(r => r.afterReview ? [r.afterReview] : []);
const codes = tally(reviews.flatMap(r => r.reasons));
const confidences = tally(reviews.map(r => r.confidence >= .8 ? "0.80–1.00" : r.confidence >= .6 ? "0.60–0.79" : r.confidence >= .4 ? "0.40–0.59" : "0.00–0.39"));
const unique = new Map(reviews.map(r => [r.reviewKey, r]));
const stats = (items: GuitarReview[]) => ({
  highPosition: items.filter(r => r.reasons.includes("high-position")).length,
  above12: items.filter(r => r.reasons.includes("above-12")).length,
  openUnderHighHand: items.filter(r => r.reasons.includes("open-under-high-hand")).length,
  lowInterval: items.filter(r => r.reasons.includes("low-interval")).length,
  bassNotLow: items.filter(r => r.reasons.includes("bass-not-low")).length,
  fingerSpacing: items.filter(r => r.reasons.includes("finger-spacing")).length,
});
// Full candidate checks distinguish an unavoidable compromise from poor ranking.
const highWithLowAlternative: string[] = [];
let slashLow = 0;
for (const r of rows) {
  if (!r.after)
    continue;
  const a = abs(r.after), fretted = a.filter(f => f > 0), lo = fretted.length ? Math.min(...fretted) : 0;
  if (r.group === "slash" && a.findIndex(f => f >= 0) <= 1)
    slashLow++;
  if (lo >= 10) {
    const c = spelledChord(r.symbol, { strict: true });
    const candidates = generateGuitarVoicings(c.pitchClasses, { root: c.root, bass: c.bass, level: 3, limit: 100000 });
    if (candidates.some(p => Math.min(...abs(p).filter(f => f > 0)) <= 7))
      highWithLowAlternative.push(r.symbol);
  }
}
const policyShapes = new Map<string, Set<string>>();
for (const review of reviews) {
  const policyKey = review.reviewKey.split(":").slice(0,-3).join(":");
  const shapes = policyShapes.get(policyKey) ?? new Set<string>();
  shapes.add(review.reviewKey);
  policyShapes.set(policyKey,shapes);
}
const twinConflicts = [...policyShapes.values()].filter(s=>s.size>1).length;
if (twinConflicts) throw Error(`${twinConflicts} enharmonic policies chose inconsistent shapes`);
const totals = { defaultLevelMissing, rows: rows.length, changed: rows.filter(r => r.changed).length, replaceChanged: rows.filter(r => r.verdict === "replace" && r.changed).length, replaceTotal: rows.filter(r => r.verdict === "replace").length, acceptChanged: rows.filter(r => r.verdict === "accept" && r.changed).length, acceptTotal: rows.filter(r => r.verdict === "accept").length, missingSolved: missing.filter(r => r.after).length, missingTotal: missing.length, nowMissing: rows.filter(r => !r.after).map(r => r.symbol), needsReview: reviews.filter(r => r.needsReview).length, uniqueShapes: unique.size, uniqueNeedsReview: [...unique.values()].filter(r => r.needsReview).length, slashBassOnEA: slashLow, slashCount: rows.filter(r => r.group === "slash").length, highWithLowAlternative, reasonCodes: codes, confidence: confidences, signalsBefore: stats(rows.map(r => r.previousReview)), signalsAfter: stats(reviews) };
const distribution = (values: Record<string, number>) => ["| Signal | Count |", "|---|---:|", ...Object.entries(values).map(([k, n]) => `| ${k} | ${n} |`)].join("\n");
let report = `# Guitar generator comparison\n\nBaseline: \`${baselineHead}\`; after: working source. All ${rows.length} baseline shapes/fingerings match the independent oracle inputs. Both versions regenerated; after explicitly uses **teaching level 3**. Default callers remain at level 2 and never omit roots.\n\n${table.join("\n")}\n\n- Changed: **${totals.changed}/${rows.length}**.\n- Replace changed: **${totals.replaceChanged}/${totals.replaceTotal}**.\n- Accept changed (regression watch list, not proven regressions): **${totals.acceptChanged}/${totals.acceptTotal}**.\n- Previously missing recovered: **${totals.missingSolved}/${missing.length}**. New missing: **${totals.nowMissing.length}**.\n- Still need review: **${totals.needsReview}/${rows.length}**; **${totals.uniqueNeedsReview}** after grouping by review key (${unique.size} distinct review keys).\n- Slash bass on E/A: **${slashLow}/${totals.slashCount} (${(100 * slashLow / totals.slashCount).toFixed(1)}%)**.\n- Selected lo ≥10 despite a candidate lo ≤7: **${highWithLowAlternative.length}** (${highWithLowAlternative.join(", ") || "none"}).\n\n## Measured signals\n\n${["| Signal | Before | After |", "|---|---:|---:|", ...Object.keys(totals.signalsBefore).map(k => `| ${k} | ${(totals.signalsBefore as any)[k]} | ${(totals.signalsAfter as any)[k]} |`)].join("\n")}\n\n## Reason codes\n\n${distribution(codes)}\n\n## Confidence\n\n${distribution(confidences)}\n\nConfidence is a deterministic attention heuristic, not a probability of musical correctness. Search without measurable warnings starts at 0.88; each warning reduces it. Every reason still requires review. Enharmonic twins share reviewKey without an extra warning that would inflate the queue. No template layer is implemented here.\n\n## Limits and evidence\n\nChanged does not mean improved or teacher-approved. Original verdicts apply to the **old** shapes. No replacement suggestion is treated as ground truth; in particular the plain review's top-tone preference is not a hard constraint. Every returned shape passes pitch/required-tone validation. \`rows.json\` contains exact before/after positions, review metadata and the complete accept-change watch list; \`missing.json\` records all 38 recoveries. \`contact-sheet.html\` shows every changed shape and the recovered 38. Existing card/manifest code is unchanged: consumers must use position.review and explicitly request level 3 for rootless output.\n`;
report += `
The prioritised review's aspirational zero-open/high-position checks are **not fully met**: ${totals.signalsAfter.openUnderHighHand} selected shapes retain open strings with lo ≥5, and ${highWithLowAlternative.length} retain lo ≥10 with a lower candidate. Costs preserve valid alternatives rather than imposing a blanket hard cutoff; these shapes retain review reasons. The reason-code union includes every omission, all minor-ninth colours, and finger-spacing warnings, so it is intentionally more conservative than the review's ~1,105 estimate.
`;
report += `
At the unchanged default level 2, **${defaultLevelMissing.length}** previously generated rows now have no valid shape after the stricter ninth rule (${defaultLevelMissing.join(", ") || "none"}). These become available at explicit level 3; consumers must pass the teaching level.
`;
mkdirSync(out, { recursive: true });
writeFileSync(join(out,"provenance.json"),JSON.stringify({baselineHead,...provenance},null,2)+"\n");
writeFileSync(join(out, "report.md"), report);
writeFileSync(join(out, "rows.json"), JSON.stringify(rows, null, 2) + "\n");
writeFileSync(join(out, "missing.json"), JSON.stringify(missing, null, 2) + "\n");
writeFileSync(join(out, "summary.json"), JSON.stringify(totals, null, 2) + "\n");
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const diagram = (frets: number[] | null, fingers?: number[]) => {
  if (!frets)
    return '<span>No shape</span>';
  const f = frets.filter(n => n > 0), start = f.length ? Math.max(1, Math.min(...f)) : 1;
  return `<svg viewBox="0 0 160 135" role="img" aria-label="${esc(frets.map(n => n < 0 ? "x" : String(n)).join(" "))}"><text x="0" y="50" font-size="12" fill="currentColor">${start}fr</text>${Array.from({ length: 6 }, (_, i) => `<path d="M${35 + i * 20} 26V126" stroke="currentColor" opacity=".5"/><path d="M35 ${26 + i * 20}H135" stroke="currentColor" opacity=".5"/>`).join("")}${frets.map((n, i) => n <= 0 ? `<text x="${35 + i * 20}" y="17" text-anchor="middle" fill="currentColor">${n < 0 ? "×" : "○"}</text>` : `<circle cx="${35 + i * 20}" cy="${36 + (n - start) * 20}" r="6" fill="currentColor"/>`).join("")}</svg><small>${esc(frets.map(f=>f<0?"x":String(f)).join(" "))}${fingers ? " · fingers " + esc(fingers.join(" ")) : ""}</small>`;
};
const card = (r: Row) => `<article><strong>${esc(r.symbol)}</strong> <small>${esc(r.verdict)}</small><div class="pair"><div>Before${diagram(r.oldFrets,r.before.fingers)}</div><div>After${diagram(r.newFrets,r.after?.fingers)}</div></div><small>${esc(r.afterReview?.reasons.join(", ") || "no warnings")} · ${r.afterReview?.confidence ?? 0}</small></article>`;
const cards = rows.filter(r=>r.changed).map(card).join("");
const recovered = missing.map(r => `<article><strong>${esc(r.symbol)}</strong><div class="pair"><div>Before${diagram(r.before)}</div><div>Level 3${diagram(r.after)}</div></div><small>${esc(r.review?.reasons.join(", ") || "")}</small></article>`).join("");
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Generator changed shapes</title><style>:root{color-scheme:light dark}body{font:14px system-ui;margin:0;color:var(--foreground,#222)}h2{font-size:18px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}article{border:1px solid var(--border,#bbb);border-radius:8px;padding:12px;break-inside:avoid}.pair{display:flex;gap:8px}.pair>div{flex:1;text-align:center}svg{display:block;width:100%;height:135px}small{font-size:11px;color:var(--muted-foreground,#666)}@media(min-width:1000px){.grid{grid-template-columns:repeat(4,minmax(0,1fr))}}</style></head><body><p>${totals.changed} changed reviewed shapes · ${totals.missingSolved}/38 recovered · independent verdict labels describe the originals</p><section class="grid">${cards}</section><h2>Previously missing, level 3</h2><section class="grid">${recovered}</section></body></html>`;
writeFileSync(join(out, "contact-sheet.html"), html);
const sample = [
  ...rows.filter(r=>r.group==="plain" && r.verdict==="replace" && r.changed).slice(0,8),
  ...rows.filter(r=>r.group==="slash" && r.verdict==="replace" && r.changed).slice(0,8),
  ...rows.filter(r=>r.verdict==="accept" && r.changed).slice(0,4),
];
const sampleHtml = html.replace(cards,sample.map(card).join("")).replace(recovered, recovered.split("</article>").slice(0,4).join("</article>")+"</article>");
writeFileSync(join(out,"contact-sheet-sample.html"), sampleHtml);
rmSync(temp, { recursive: true });
console.log(JSON.stringify(totals, null, 2));
