#!/usr/bin/env python3
"""Run after compare-voicings.mts. Requires the original local review corpus.

Only adapts I/O and cohort bookkeeping: the old recovered-slash loop assumed
all recoveries were rootless, and could not represent an unavailable shape.
No pitch, hand, register, comparison, search or verdict rule is weakened.
Original files remain untouched; every adapted script is retained with hashes.
"""
from pathlib import Path
import argparse, ast, hashlib, json, subprocess

parser = argparse.ArgumentParser(description="Replay the original Opus checkers without changing their musical judgments.")
parser.add_argument("--review-dir", type=Path, required=True)
parser.add_argument("--comparison", type=Path, required=True)
args = parser.parse_args()
src=args.review_dir.resolve()
comparison=args.comparison.resolve()
out=comparison / "opus-v2"
out.mkdir(exist_ok=True)
manifest = {}
for name in ['review-slash.mjs','review_plain.py','verify_independent.py','build_report.py','astra-lib.mjs']:
 original=(src/name).read_text()
 s=original
 s=s.replace("const OUT='/home/shaun/chordcards/out/opus-review-20261029';",f"const OUT='{out}';")
 s=s.replace("IN = OUT.parent / 'generator-fix-20261029'","IN = OUT.parent")
 s=s.replace("OUT.parent / 'guitar-review-20261029'","OUT.parent.parent / 'guitar-review-20261029'")
 s=s.replace("r.group==='slash'&&r.changed","r.group==='slash'")
 s=s.replace("r['group'] == 'plain' and r['changed']","r['group'] == 'plain'")
 if name=='review-slash.mjs':
  s=s.replace(" const row=defs.get(r.slug);", """ if (!r.after) {
  out.push({group:'slash',slug:r.slug,symbol:r.symbol,upper_type:defs.get(r.slug).upperType,
    verdictOld:r.verdict,verdictNew:'no-good-shape',unavailable:true,comparison:'worse',comparisonStrict:'worse',
    oldFrets:r.oldFrets,newFrets:null,oldFingers:r.before.fingers,newFingers:null,rootless:false,newNotes:[],newOmitted:[],
    reasons:[{code:'no-safe-shape',severity:'reject',detail:'No rooted candidate satisfies the unchanged reach limit and the requested low-open-clash constraint.'}],proposal:null});
  continue;
 }
 const row=defs.get(r.slug);""")
  start=s.index(' const row=extra[m.symbol];const d=definition(row);',s.index('// Recovered slash'))
  end=s.index('\n}',start)
  s=s[:start]+''' const row=extra[m.symbol]; const d=definition(row); CUR_TYPE=row.upperType;
 const frets=m.after;
 if (!frets) {
  out.push({group:'slash',slug:row.slug,symbol:row.symbol,upper_type:'9',recovered:false,unavailable:true,
   verdictOld:'missing',verdictNew:'no-good-shape',comparison:'missing',newFrets:null,rootless:false,newNotes:[],newOmitted:[],reasons:[],proposal:null});
  continue;
 }
 const n=checkJ(frets,d,null), v=verdictFor(n,d,row,frets);
 out.push({group:'slash',slug:row.slug,symbol:row.symbol,upper_type:'9',recovered:true,verdictOld:'missing',
  verdictNew:v.verdict,comparison:'recovered',newFrets:frets,rootless:!!m.rootless,newNotes:n.voices.map(x=>x.note),newOmitted:n.omitted,
  reasons:v.reasons.filter(x=>x.severity!=='info'), proposal:v.proposal, generatorReasons:m.review?.reasons??[]});''' +s[end:]
 if name=='verify_independent.py':
  s=s.replace("    if x.get('recovered'):","    if x.get('unavailable'):\n        if (missing[sym]['after'] if sym in missing else rows[x['slug']]['after']) is not None: flag('unavailable-has-shape', sym, x['newFrets'])\n        continue\n    if x.get('recovered'):")
 if name=='build_report.py':
  # Keep the reporting tables/CSV; the image selection assumes every recovered row has frets.
  s=s[:s.index('# ---------- review sheet ----------')]
 # Paths, full-cohort coverage and unavailable/recovered row plumbing only.
 # In particular check(), checkJ(), compare(), audit_x(), contract_r1(),
 # search() and verdictFor()/verdict() retain their original bodies.
 s=s.replace("const IN='/home/shaun/chordcards/out/generator-fix-20261029';", f"const IN='{comparison}';")
 s=s.replace("const PRIOR='/home/shaun/chordcards/out/guitar-review-20261029/slash';", f"const PRIOR='{src.parent / 'guitar-review-20261029/slash'}';")
 s=s.replace("IN = OUT.parent", f"IN = Path({str(comparison)!r})")
 s=s.replace("OUT.parent.parent / 'guitar-review-20261029'", f"Path({str(src.parent / 'guitar-review-20261029')!r})")
 if name in ('review_plain.py', 'verify_independent.py'):
  functions = lambda code: {n.name: ast.dump(n, include_attributes=False)
                            for n in ast.parse(code).body if isinstance(n, ast.FunctionDef)}
  assert functions(original) == functions(s), f'Musical functions changed: {name}'
 if name == 'astra-lib.mjs':
  assert original == s, 'Astra checker must remain byte-for-byte unchanged'
 if name == 'review-slash.mjs':
  functions = lambda code: code[code.index('// Name what'):code.index('const out=[];')]
  assert functions(original) == functions(s), 'Slash judgment/search/verdict functions changed'
 (out/name).write_text(s)
 manifest[name] = {"originalSha256": hashlib.sha256(original.encode()).hexdigest(), "adaptedSha256": hashlib.sha256(s.encode()).hexdigest()}

(out / 'adaptations.json').write_text(json.dumps(manifest, indent=2) + '\n')
for command in [['node', 'review-slash.mjs'], ['python3', 'review_plain.py'],
                ['python3', '-I', 'verify_independent.py'], ['python3', 'build_report.py']]:
    subprocess.run(command, cwd=out, check=True)

load = lambda path: json.loads(path.read_text())
rows = load(comparison / 'rows.json')
missing = load(comparison / 'missing.json')
raw = load(out / 'plain-results.json') + load(out / 'slash-results.json')
by = {r['symbol']: r for r in raw}
original = load(src / 'verdicts.json')
original_changed = [r for r in original if r['verdictOld'] != 'missing']
watch = [by[r['symbol']] for r in original_changed if r['verdictOld'] == 'accept']
v2_changed = [by[r['symbol']] for r in rows if r['changed']]
fixed_cohort = [by[r['symbol']] for r in original_changed]
all_cohort = [by[r['symbol']] for r in rows]

# Independently derive the requested low-open-clash metric from absolute
# fret arrays. Neither the generator nor the review's signal flags are reused.
def open_clashes(frets):
    if frets is None:
        return set()
    tuning = [40, 45, 50, 55, 59, 64]
    pairs = set()
    for i, f in enumerate(frets):
        for j in range(i + 1, 6):
            g = frets[j]
            if f < 0 or g < 0 or (f != 0 and g != 0):
                continue
            low, high = sorted([tuning[i] + f, tuning[j] + g])
            if low < 52 and high - low in (1, 13):
                pairs.add((i, j, low, high))
    return pairs

new_clashes = [r['symbol'] for r in rows if open_clashes(r['newFrets']) - open_clashes(r['oldFrets'])]
new_clashes += [r['symbol'] for r in missing if open_clashes(r['after'])]
missing_tones = [r['symbol'] for r in raw if any(x['code'] in
                 ('missing-required-tone', 'missing_defining_tone', 'rootless_slash_upper') for x in r['reasons'])]
counts = lambda rs: {k: sum(r['comparison'] == k for r in rs) for k in ('better', 'same', 'worse')}
worst = ['G#9/E', 'Db9/F', 'E9/A', 'A13(b9)', 'G#7(b9,b5)', 'Aaug/G#', 'Cm11(b5)', 'G7(b9,b5)', 'Em7/C', 'G9/A']
fixtures = load(Path(__file__).resolve().parents[1] / 'test/fixtures/opus-regressions.json')
fixture_status = [{ 'symbol': f['symbol'], 'comparison': by[f['symbol']]['comparison'],
                   'newFrets': by[f['symbol']]['newFrets'] } for f in fixtures]
old_proposals = [by[r['symbol']] for r in original_changed if r.get('proposal') and r['proposal']['revertsToOldShape']]
verification = load(out / 'verification.json')
summary = dict(version=2, baseline=load(comparison / 'provenance.json')['baselineHead'],
               missingDefiningTones=len(missing_tones), missingDefiningToneSymbols=missing_tones,
               newLowOpenStringClashes=len(new_clashes), newLowOpenStringClashSymbols=new_clashes,
               previouslyAcceptedWorse=sum(r['comparison'] == 'worse' for r in watch), previouslyAcceptedWatch=len(watch),
               previouslyAcceptedWorseV1=57, oldShapeProposalsV1=counts(old_proposals), fixedV1Cohort=counts(fixed_cohort), v2ChangedCohort=counts(v2_changed),
               all3157=counts(all_cohort), allAcceptedWorse=sum(r['verdictOld'] == 'accept' and r['comparison'] == 'worse' for r in all_cohort),
               recovered=sum(bool(r['after']) for r in missing), recoveriesTotal=len(missing),
               newlyUnavailable=[r['symbol'] for r in rows if not r['after']],
               unrecovered=[r['symbol'] for r in missing if not r['after']],
               regressionFixtures=fixture_status, independentVerification=verification['result'])
(comparison / 'opus-gate.json').write_text(json.dumps(summary, indent=2) + '\n')
lines = ['# Opus gate — generator v2', '',
         'Baseline: `d307e3b`; original Opus comparison: 957 better / 612 same / 246 worse on 1,815 changed rows.', '',
         '| Gate | v1 | v2 |', '|---|---:|---:|',
         f'| Missing defining tones | 94 | {len(missing_tones)} |',
         f'| New low open-string clashes | 46 | {len(new_clashes)} |',
         f'| Previously accepted, now worse (same 195-row watch list) | 57 | {summary["previouslyAcceptedWorse"]} |', '',
         '| Comparison cohort | Rows | Better | Same | Worse |', '|---|---:|---:|---:|---:|']
for label, cohort in [('Original 1,815 changed rows (fixed denominator)', fixed_cohort),
                      ('v2 changed rows', v2_changed), ('All reviewed rows', all_cohort)]:
    c = counts(cohort)
    lines.append(f'| {label} | {len(cohort)} | {c["better"]} | {c["same"]} | {c["worse"]} |')
lines += ['', f'For the 117 original proposals reverting to the old shape: {counts(old_proposals)}. Remaining regressions are reported rather than filtered.', '', '## Ten worst regressions', '', '| Symbol | v2 vs old, unchanged Opus comparator | v2 absolute frets |', '|---|---|---|']
for sym in worst:
    r = by[sym]
    lines.append(f'| {sym} | {r["comparison"]} | `{r["newFrets"]}` |')
lines += ['', 'All 15 committed regression fixtures are checked against the original Opus comparator; their exact approved alternatives are in `test/fixtures/opus-regressions.json`.', '',
          '## Coverage and constraints', '',
          f'{summary["recovered"]}/38 recoveries remain available. Ab9/Eb is rooted (`x66576`); G#9/B stays unavailable because the only rooted option exceeds the unchanged low-position reach limit.', '',
          'Newly unavailable reviewed symbols: ' + ', '.join(summary['newlyUnavailable']) + '.', '',
          'These are counted as worse, never silently dropped. Their former grips contain a prohibited open-string minor ninth or need a reach/hand relaxation to retain the upper root. The hard constraints take precedence over coverage.', '',
          'A13(b9) uses x05676. The original grip and original Opus proposal both contain open A2–Bb3, now prohibited by the requested hard rule; unchanged Opus comparison rates x05676 as equal to the old grip.', '',
          '## Reproduction and independence', '',
          'The original checkers are copied into `opus-v2/` with I/O adaptations only: full-cohort evaluation, correct rooted recovery bookkeeping, and explicit unavailable rows. Their musical check, hand, search, score and comparison functions are unchanged. `opus-v2/adaptations.json` records source and adapted hashes. The independent verifier runs with `python3 -I`; result: **' + verification['result'] + '** over ' + str(verification['rowsChecked']) + ' rows. Original inputs and v1 output remain untouched (`*-v1.*`).', '',
          'This is heuristic verification, not a guitar playing/listening test. Residual regressions are retained in `opus-v2/regressions.md` and `verdicts.json`, including any legacy checker limitation on non-index mini-barres. No chordcards source, live data or uploads are involved.', '']
(comparison / 'opus-gate.md').write_text('\n'.join(lines))
if (missing_tones or new_clashes or verification['result'] != 'pass' or
    summary['previouslyAcceptedWorse'] >= 57 or any(r['comparison'] == 'worse' for r in fixture_status)):
    raise SystemExit('Opus gate failed; inspect opus-gate.json and opus-v2/verification.json')
print(json.dumps(summary, indent=2))
