# Alternate Tunings

**Date:** 2026-08-09
**Status:** approved — design agreed, ready for implementation planning
**Context:** a sibling to `docs/superpowers/specs/2026-08-08-chordl-guitar-boundary-design.md`. Independent of the frames migration: neither blocks the other.

## Problem

`@tombatossals/chords-db` covers **standard tuning only**. Every stored shape assumes E A D G B E. So for drop D, DADGAD, open G, open D, or any of the roughly fifty tunings Joni Mitchell used, there is nothing to look up — `lookupGuitarChord` returns shapes that are silently wrong for the tuning, or nothing at all.

Alternate tunings are not a niche: open tunings are the foundation of slide playing, DADGAD underpins a large body of Celtic and fingerstyle repertoire, and a Joni Mitchell songbook is unplayable without them.

## What already works

The pitch model is **already tuning-agnostic**, and not by foresight — it fell out of deciding to pass `openMidi` explicitly rather than hardcoding standard tuning.

Everything downstream of `openMidi` derives from actual pitches rather than assuming a tuning:

- `positionToMidi` — takes `openMidi` as a parameter
- `positionFacts` — bass note, inversion, note count, doubling, pitch classes
- `duplicateVoicingMap` — compares sounding pitches
- `matchesShapeClass` — barres and `baseFret`, pure geometry
- `dbPositionToChord` — pure geometry, frets to svguitar
- `selectVoicings` — ranks on facts, so its diversity metric transfers unchanged

Hand any of these a different `openMidi` array and they work. **The facts and selection layer needs no change at all.**

## Decisions

1. **A named registry over an open primitive.** The engine accepts any `openMidi` array; a registry of well-known tunings sits on top as data. Nothing is limited to the registry.
2. **chords-db stays authoritative for standard tuning.** The generator serves only tunings chords-db cannot. Curated fingerings beat generated ones, and existing consumers see no change.

## The unifying model

**A tuning is a function returning an `openMidi` array.** That single idea absorbs four features that would otherwise be built separately:

| Feature | Expressed as |
|---|---|
| Alternate tuning | a named array — DADGAD is `[38, 45, 50, 55, 57, 62]` |
| Drop tuning | a transform — drop D is `openMidi[0] - 2` |
| Capo | a transform — `openMidi.map(m => m + fret)` |
| Joni's tunings | named arrays, several with a capo transform on top |

There is no separate capo feature to build. This also settles an earlier finding: chords-db treats `capo: true` as a *rendering hint* because its fret numbers already encode sounded pitch, whereas a real capo genuinely transposes. Both are true, and they are different things — the render hint stays where it is, and capo-as-transposition is a tuning transform.

## Generation

For tunings chords-db cannot serve, shapes are generated rather than stored.

**The approach:** for each `baseFret` window, collect per string the frets within the window whose pitch class is in the chord (plus muted, plus the open string). Take the cartesian product, pruning on span, and keep combinations that spell the whole chord. Deduplicate by sounding pitch set.

**This is tractable, and was verified before being specified.** A ~60-line spike over six tunings:

| Tuning | Unique D major voicings | ≤3 fretted fingers | Fully open |
|---|---|---|---|
| standard E A D G B E | 508 | 184 | 0 |
| drop D — D A D G B E | 688 | 292 | 0 |
| DADGAD — D A D G A D | 1,245 | 758 | 0 |
| open G — D G D G B D | 620 | 221 | 0 |
| open D — D A D F# A D | 2,247 | 1,485 | **21** |
| Joni "Hejira" C# G D F C# D | 562 | 185 | 0 |

**5,870 voicings in 45ms.** A denser chord constrains rather than explodes it: Dm7 in DADGAD gives 1,421.

Two results are worth more than the timings, because they are what makes the generator trustworthy:

- **Open D yields 21 fully-open D major shapes** — correct, because that tuning *is* a D chord.
- **DADGAD yields none** — correct, because its open G is not in D major.

The generator was not told either fact.

## Curation is the real problem

1,245 voicings for one chord is useless to a player. **Generation is easy; choosing is hard.**

The machinery mostly exists. `selectVoicings` already answers "give me *n* maximally contrasting shapes", and `PositionFacts` already carries span, barre and finger count. What is missing is playability scoring tuned for generated shapes, where the candidate pool is three orders of magnitude larger than chords-db's four-or-so positions and contains many geometrically valid but idiomatically strange fingerings.

This is the phase to expect to iterate on, and the one where a musician's judgement beats a metric.

## The API change this needs

The final review of sub-project 1 removed `openMidi` as a parameter from `canonicalPositionIndex` and `selectVoicings`, so they derive it from `opts.instrument`. That was correct — two independent sources for one fact could disagree silently, and did: an open C major scored against ukulele tuning returned "3-note first inversion, no error".

But it welds tuning to **instrument identity**, which alternate tunings must break.

**The resolution keeps exactly one source per call.** Selection options gain an optional `tuning`, resolved at a single point:

```
openMidi = opts.tuning ? resolveTuning(opts.tuning) : INSTRUMENTS[opts.instrument].openMidi
```

A caller supplies a tuning *or* accepts the instrument's default — never both, never a raw array alongside an instrument that contradicts it. The original defect was two co-equal parameters that could disagree; an override with a defined precedence is not that.

**A tuning belongs to a string count, not to an instrument.** DADGAD is a six-string tuning usable on any six-string. So `Tuning` is its own record, validated against the instrument's string count at resolution time, rather than a field multiplied across every instrument.

## Where the existing design pays off

The perfect-fourth condition added to power-chord generation will **correctly reject most open tunings**. Open G is D G D G B D, where G→D is a fifth, not a fourth. That is musically right: open tunings exist for open and slide voicings, not movable power-chord shapes. The generator fails safe instead of emitting a shape that looks plausible and sounds wrong.

No change is needed there — it is noted so nobody "fixes" it later.

## Phases

| | Phase | Depends on |
|---|---|---|
| **T1** | Tuning as a first-class concept — `Tuning` record, registry, transforms, resolution point | — |
| **T2** | Shape generator | T1 |
| **T3** | Playability scoring and curation for generated shapes | T2 |
| **T4** | Public API and release | T3 |

T1 is small and self-contained: the registry is data, the transforms are arithmetic, and the resolution change is one line plus its threading. T2 is the spike hardened, with tests asserting the two open-D/DADGAD sanity results above. T3 is where the effort actually goes.

**Independent of the frames migration.** Neither blocks the other, and they touch different parts of the package — the migration adds lookup and enumeration, this adds generation.

## Risks

| Risk | Mitigation |
|---|---|
| Generated shapes are geometrically valid but unplayable or unidiomatic | T3 exists for this; expect to tune it against a musician's judgement rather than declare it done on metrics |
| Reintroducing the two-source disagreement the 1b review caught | One resolution point with defined precedence; a caller supplies a tuning or an instrument default, never a raw array beside a contradicting instrument |
| Registry drifts from reality | The registry is data over an open primitive — a wrong entry is a data fix, not a code change, and callers are never limited to it |
| Tuning applied to the wrong string count | Validate a `Tuning`'s length against `INSTRUMENTS[instrument].strings` at resolution; reject rather than silently truncate |
| Joni tunings are documented inconsistently across sources | Treat any registry entry as a claim needing a citation; verify sounded pitches against a recording or a reputable transcription before shipping it |

## Open items

- [ ] T1 — implementation plan and build
- [ ] T2 — implementation plan and build
- [ ] T3 — the curation phase; scope after T2 shows real candidate pools
- [ ] T4 — public API and release
- [ ] Decide whether generated shapes are exposed as `ChordsDbPosition` (so all existing facts and selection apply unchanged) or as a distinct type — the former is strongly preferred and should be the default assumption unless something forces otherwise
- [ ] Source and verify the Joni Mitchell tuning list before adding it to the registry
