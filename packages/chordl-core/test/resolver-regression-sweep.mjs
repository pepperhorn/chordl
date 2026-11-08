// Read-only main/head comparison. Run from the repo root:
// node packages/chordl-core/test/resolver-regression-sweep.mjs [base-ref]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { ChordType, Note } from 'tonal';

const packageDir = fileURLToPath(new URL('../', import.meta.url));
const repoDir = path.resolve(packageDir, '../..');
const base = process.argv[2] ?? 'main';
const sourcePath = 'packages/chordl-core/src/resolver/chord-resolver.ts';
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chordl-resolver-sweep-'));
// Transpiled modules need the same installed dependencies as the package.
fs.symlinkSync(path.join(packageDir, 'node_modules'), path.join(workDir, 'node_modules'));
const sources = [
  execFileSync('git', ['show', `${base}:${sourcePath}`], { cwd: repoDir, encoding: 'utf8' }),
  fs.readFileSync(path.join(repoDir, sourcePath), 'utf8'),
];
const resolvers = [];
for (const [index, source] of sources.entries()) {
  const filename = path.join(workDir, `${index}.mjs`);
  fs.writeFileSync(filename, ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText);
  resolvers.push((await import(pathToFileURL(filename).href)).resolveChord);
}
const roots = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'Bb', 'B'];
const extras = [
  'm7b5b9', 'dim7b9', 'm7b9', '7b9b5', '7b5b9', '7#9b5', '7b5#9',
  '7b5b13', '9b5b13', '13#9b5', '7b5b9b13', 'maj7b5', 'm11b5', '7b13b9',
  '7b9b13', '7#11b9', '7#5#9', '7#5b9', '9#5#11', 'M#5add9', '7#5b9#11',
  'm6/9', '6/9', 'mMaj7', 'maj7#11', '13b9', '7sus4b9', '7omit3',
  'm7sus', 'm7sus4', 'maug', 'mmaj7',
];
const aliases = [...new Set([...ChordType.all().flatMap(t => t.aliases), ...extras])]
  .filter(s => !s.includes('('));
const safe = (fn, symbol) => { try { return fn(symbol); } catch { return null; } };
const pcs = notes => [...new Set(notes.map(Note.chroma))].sort().join(',');
const diffs = [];
const failures = [];
let total = 0;
for (const root of roots) for (const alias of aliases) for (const bass of ['', ...roots]) {
  const symbol = root + alias + (bass ? '/' + bass : '');
  total++;
  const old = safe(resolvers[0], symbol), now = safe(resolvers[1], symbol);
  if (JSON.stringify(old) === JSON.stringify(now)) continue;
  const kind = !old ? 'newly accepted' : !now ? 'now throws'
    : pcs(old.notes) !== pcs(now.notes) ? 'pitch classes' : 'metadata/order';
  diffs.push({ symbol, old, now, kind });
  if (!now || (!bass && (!old || pcs(old.notes) !== pcs(now.notes)))) {
    failures.push(symbol);
  } else if (bass) {
    const upper = safe(resolvers[1], root + alias);
    if (!upper || pcs(now.notes) !== pcs([...upper.notes, bass])
      || Note.chroma(now.notes[0]) !== Note.chroma(bass)
      || Note.chroma(now.root) !== Note.chroma(upper.root)) failures.push(symbol);
  }
}
const summary = {
  base, total, aliases: aliases.length, roots: roots.length, bassForms: roots.length + 1,
  differences: diffs.length,
  byKind: diffs.reduce((acc, d) => ({ ...acc, [d.kind]: (acc[d.kind] ?? 0) + 1 }), {}),
  failures,
};
const report = path.join(workDir, 'diff.json');
fs.writeFileSync(report, JSON.stringify({ summary, diffs }, null, 2));
console.log(JSON.stringify({ ...summary, report }, null, 2));
if (failures.length) process.exitCode = 1;
