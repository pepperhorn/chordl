// Read-only parser probe adapted from PR #110 review r1.
// node packages/chordl-core/test/parser-compat-sweep.mjs [base-ref]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const repo = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const base = process.argv[2] ?? 'main';
const baseHead = execFileSync('git', ['rev-parse', base], {cwd: repo, encoding: 'utf8'}).trim();
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'chordl-parser-compat-'));
import { createRequire } from 'node:module';
const req = createRequire(path.join(repo, 'packages/chordl-core/package.json'));
const ts = req('typescript');
const nm = path.join(repo,'packages/chordl-core/node_modules');
if (!fs.existsSync(path.join(out,'node_modules'))) fs.symlinkSync(nm, path.join(out,'node_modules'));
const tr = s => ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const res = fs.readFileSync(path.join(repo,'packages/chordl-core/src/resolver/chord-resolver.ts'),'utf8');
fs.writeFileSync(path.join(out,'resolver.mjs'), tr(res).replace(/from "\.\.\/[^"]+"/g, m=>{throw new Error('resolver import '+m)}));
const P='packages/chordl-core/src/parser/natural-language.ts';
const srcs = { old: execFileSync('git',['show',`${base}:${P}`],{cwd:repo,encoding:'utf8'}), new: fs.readFileSync(path.join(repo,P),'utf8')};
const parse = {};
for (const [k,s] of Object.entries(srcs)) {
  const f = path.join(out,k+'.mjs');
  fs.writeFileSync(f, tr(s).replace('"../resolver/chord-resolver.js"','"./resolver.mjs"'));
  parse[k] = (await import(pathToFileURL(f).href)).parseChordDescription;
}
const { resolveChord } = await import(pathToFileURL(path.join(out,'resolver.mjs')).href);
const { ChordType, Note } = req('tonal');
const extras = ['m7b5b9','dim7b9','m7b9','7b9b5','7#9b5','7b5b13','9b5b13','13#9b5','maj7b5','m11b5','7#11b9','7#5#9','M#5add9','m6/9','6/9','mMaj7','maj7#11','13b9','7sus4b9','7omit3','m7sus4','maug','mmaj7','7alt','maj','min','m','dim','aug','sus2','sus4','add9','7(b9)','7(#11)','9(#11)','maj7(#11)','m7(b5)','ø','°','°7','ø7','M7','m7','7','9','11','13','6','69','dom7','alt'];
const aliases = [...new Set([...ChordType.all().flatMap(t=>t.aliases), ...extras, ''])];
const roots = ['C','F#','Bb','Eb','A','E','B','G','D','Ab','Db','C#','Gb','F'];
const ok = s => { try { return resolveChord(s).notes.length>0 } catch { return false } };
const syms = [];
for (const r of roots) for (const a of aliases) { const s=r+a; if (ok(s)) syms.push(s); }
const slash = []; for (const s of syms.filter((_,i)=>i%7===0)) for (const b of ['E','Bb','F#','G']) if (ok(s+'/'+b)) slash.push(s+'/'+b);
const all = [...syms, ...slash];
const tmpl = [x=>x, x=>`play ${x}`, x=>`show me ${x}`, x=>`${x} over E`, x=>`${x} in drop 2`, x=>`a ${x} chord`, x=>`${x} with degrees`, x=>`play ${x} in drop 2 with degrees`, x=>`${x} in the left hand`, x=>`(${x})`, x=>`${x}, please`, x=>`${x}.`];
const inputs = [];
const expected = new Map();
for (const s of all) for (const t of tmpl) { inputs.push(t(s)); expected.set(t(s), s); }
// case / unicode
for (const s of syms.slice(0,400)) { inputs.push(s.charAt(0).toLowerCase()+s.slice(1)); inputs.push(s.replace(/^([A-G])b/,'$1♭').replace(/^([A-G])#/,'$1♯')); }
inputs.push('a C major chord','A','a','a minor','A minor','A over C#','play a Bb7','play a C','a Cmaj7','play A','play a','A7','a7','Am','am','A/C#','a/c#','Ab','ab','C♭','B♭7','F♯m7','E♭maj7/G','play an Eb7','an A7','hello world','@@@ not a chord @@@','Zbq9','banana','C major','C minor','Cmaj7 over G','Bb7 over D','play Bb7 over D','G7 in root position','C7 alt','C7(alt)','Calt7','C7alt9','Cmaj7#11','C-7','C-','C+','C+7','Cm7-5','C△7','CΔ7','C^7','Csus','C7sus','Cmaj9#11','C/E','C/Bb','C/G voicing','C 7','C 7alt','C maj7','C m7','show me a C','give me an F#m7b5','Dm7 G7 Cmaj7','ii V I in C','C E G','notes C E G','C, E, G');
const edges = new Map([
 ['give me a dominant C7','C7'], ['show a suspended G','G'],
 ['a major seventh on C','C'], ['a minor 7 on D','D'], ['a minor','Am'],
 ['C9 alt','C9alt'], ['Cm7 alt','Cm7alt'], ['C7b9 alt','C7b9alt'],
 ['C7 (alt)','C7alt'], ['C7(alt)','C7alt'], ['Calt7','C7alt'], ['C7alt9',''],
 ['B♭7','Bb7'], ['F♯m','F#m'], ['E♭maj7/G','Ebmaj7/G'],
 ['CΔ7','CΔ7'], ['F#quartal','F#quartal'], ['C7omit3','C7omit3'], ['Amajor','Amaj'], ['Aminor','Amin'], ['Cmajor7','Cmaj7'],
 ...['D7no3','C69omit3','Cmaj7omit5','Cmaj7no5','C69no3no5'].map(x=>[x,x]),
 ...['hello world','@@@ not a chord @@@','Zbq9','banana','H7',
   'do','Do','go','Go','be','Be','add','Add','bad','Dad','Cab','face','Bed']
   .flatMap(x=>[[x,''],[`${x} it`,''],[`play ${x}`,'']]),
]);
inputs.push(...edges.keys());
const diffs = []; const unexpected = []; let same = 0;
let noteGroupInterpretations = 0;
const pcs = notes => notes.map(Note.chroma).sort((a,b)=>a-b).join(',');
// 0046: bare Ah/Eh are English interjections, even though the resolver accepts them.
const english = /^(?:do|go|be|add|bad|dad|cab|face|bed|ah|eh)$/i;
const safe = (f,x)=>{ try { return f(x) } catch(e) { return {THROW:String(e.message)} } };
for (const x of new Set(inputs)) {
  const o = safe(parse.old,x), n = safe(parse.new,x);
  const symbol = expected.get(x);
  // Existing hand notation (including slash-bass notes) intentionally extracts
  // notesGroups instead of a whole chord symbol. Its full metadata must remain
  // identical to baseline; it is not a failure of fallback chord recognition.
  if (symbol && n.notesGroups) noteGroupInterpretations++;
  if (symbol && !n.notesGroups) {
    const wanted = english.test(symbol) ? '' : symbol.replace(/alt7/i,'7alt');
    if (!wanted ? n.chordName !== '' : (!ok(n.chordName) || pcs(resolveChord(n.chordName).notes) !== pcs(resolveChord(wanted).notes))) {
      unexpected.push({x, reason:'resolver symbol lost or changed', symbol, parsed:n});
    }
  }
  if (edges.has(x) && n.chordName !== edges.get(x)) unexpected.push({x, reason:'edge expectation', expected:edges.get(x), parsed:n});
  const normalized = x.replace(/♭/g,'b').replace(/♯/g,'#');
  // Catch regressions in case/Unicode inputs whose baseline already returned
  // the complete canonical token. Rejected lowercase unknown aliases remain
  // outside the explicitly uppercase-only fallback.
  const canonical = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  if (!symbol && !edges.has(x) && o.chordName === canonical && ok(canonical)
    && (!ok(n.chordName) || pcs(resolveChord(n.chordName).notes) !== pcs(resolveChord(canonical).notes))) {
    unexpected.push({x, reason:'previously complete symbol changed', old:o, parsed:n});
  }
  const modifiers = value => Object.fromEntries(Object.entries(value).filter(([key])=>key!=='chordName'));
  if (JSON.stringify(modifiers(safe(parse.old,normalized))) !== JSON.stringify(modifiers(n))) unexpected.push({x, reason:'modifier changed', old:o, parsed:n});
  if (JSON.stringify(o)===JSON.stringify(n)) { same++; continue; }
  const keys = [...new Set([...Object.keys(o),...Object.keys(n)])].filter(k=>JSON.stringify(o[k])!==JSON.stringify(n[k]));
  // 0046: classify only the approved chordName changes; modifier checks above
  // still require the extracted hand-note groups to match the baseline.
  let expectedChange;
  if (keys.length === 1 && keys[0] === 'chordName') {
    if (/^(?:Ah|Eh)$/.test(o.chordName) && n.chordName === '') expectedChange = 'interjection';
    else if (symbol && x === `${symbol} in the left hand` && /\/[A-G][#b]?$/.test(symbol)
      && n.chordName === symbol.replace(/\/[A-G][#b]?$/, '') && n.notesGroups) expectedChange = 'trailingSlashHand';
  }
  diffs.push({x, keys, ...(expectedChange ? {expectedChange} : {}), old:Object.fromEntries(keys.map(k=>[k,o[k]])), new:Object.fromEntries(keys.map(k=>[k,n[k]]))});
}
const summary = {base,baseHead,noteGroupInterpretations,symbols:syms.length,slash:slash.length,inputs:new Set(inputs).size,same,differences:diffs.length,expectedChanges:{interjection:diffs.filter(d=>d.expectedChange==='interjection').length,trailingSlashHand:diffs.filter(d=>d.expectedChange==='trailingSlashHand').length},unexpected:unexpected.length};
const report = path.join(out,'diffs.json');
fs.writeFileSync(report, JSON.stringify({summary,diffs,unexpected},null,2));
console.log(JSON.stringify({...summary,report},null,2));
if (unexpected.length) process.exitCode=1;
