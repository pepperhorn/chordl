# Guitar generator comparison

Baseline: `d307e3b378c6864cd61fc39f6571cf0ee1a81586`; after: generator implementation `5a36593` (source hashes recorded in local `provenance.json`). All 3157 baseline shapes/fingerings match the independent oracle inputs. Both versions regenerated; after explicitly uses **teaching level 3**. Default callers remain at level 2 and never omit roots.

| Group / verdict | Rows | Changed | Unchanged |
|---|---:|---:|---:|
| plain / accept | 104 | 40 | 64 |
| plain / accept-with-note | 234 | 113 | 121 |
| plain / replace | 350 | 228 | 122 |
| plain / no-good-shape | 12 | 12 | 0 |
| slash / accept | 667 | 155 | 512 |
| slash / accept-with-note | 967 | 548 | 419 |
| slash / replace | 818 | 714 | 104 |
| slash / no-good-shape | 5 | 5 | 0 |

- Changed: **1815/3157**.
- Replace changed: **942/1168**.
- Accept changed (regression watch list, not proven regressions): **195/771**.
- Previously missing recovered: **38/38**. New missing: **0**.
- Still need review: **1932/3157**; **1484** after grouping by review key (2490 distinct review keys).
- Slash bass on E/A: **2428/2457 (98.8%)**.
- Selected lo ≥10 despite a candidate lo ≤7: **3** (Ebmaj13(#11), Am7(b5)/D, Gm7(b5)/Eb).

## Measured signals

| Signal | Before | After |
|---|---:|---:|
| highPosition | 219 | 89 |
| above12 | 44 | 4 |
| openUnderHighHand | 95 | 11 |
| lowInterval | 921 | 333 |
| bassNotLow | 331 | 38 |
| fingerSpacing | 644 | 167 |

## Reason codes

| Signal | Count |
|---|---:|
| above-12 | 4 |
| b9-clash | 569 |
| barre-5+ | 199 |
| bass-not-low | 38 |
| db-position-rejected | 1 |
| doubled-tension | 4 |
| finger-spacing | 167 |
| high-position | 89 |
| low-interval | 333 |
| omits:1 | 221 |
| omits:11 | 34 |
| omits:5 | 779 |
| omits:9 | 156 |
| omits:b3 | 4 |
| open-under-high-hand | 11 |
| rootless | 221 |
| span-4 | 27 |
| three-strings | 106 |
| unison | 67 |

## Confidence

| Signal | Count |
|---|---:|
| 0.40–0.59 | 47 |
| 0.60–0.79 | 675 |
| 0.80–1.00 | 2435 |

Confidence is a deterministic attention heuristic, not a probability of musical correctness. Search without measurable warnings starts at 0.88; each warning reduces it. Every reason still requires review. Enharmonic twins share reviewKey without an extra warning that would inflate the queue. No template layer is implemented here.

## Limits and evidence

Changed does not mean improved or teacher-approved. Original verdicts apply to the **old** shapes. No replacement suggestion is treated as ground truth; in particular the plain review's top-tone preference is not a hard constraint. Every returned shape passes pitch/required-tone validation. `rows.json` contains exact before/after positions, review metadata and the complete accept-change watch list; `missing.json` records all 38 recoveries. `contact-sheet.html` shows every changed shape and the recovered 38. Existing card/manifest code is unchanged: consumers must use position.review and explicitly request level 3 for rootless output.

The prioritised review's aspirational zero-open/high-position checks are **not fully met**: 11 selected shapes retain open strings with lo ≥5, and 3 retain lo ≥10 with a lower candidate. Costs preserve valid alternatives rather than imposing a blanket hard cutoff; these shapes retain review reasons. The reason-code union includes every omission, all minor-ninth colours, and finger-spacing warnings, so it is intentionally more conservative than the review's ~1,105 estimate.

At the unchanged default level 2, **9** previously generated rows now have no valid shape after the stricter ninth rule (C#maj9(#11,#5), Dbmaj9(#11,#5), F#maj9(#11,#5), Gbmaj9(#11,#5), Gmaj9(#11,#5), A9(#11,#5), Amaj9(#11,#5), B9(#11,#5), Bmaj9(#11,#5)). These become available at explicit level 3; consumers must pass the teaching level.

## Validation

`pnpm --filter @pepperhorn/chordl-guitar test:run`: 18 files, 311 tests passed.
`pnpm --filter @pepperhorn/chordl-guitar build`: passed.
The regression tests were committed before implementation; the red ninth-retention assertion and missing review API are recorded in the local TDD log.
All equivalent degree/role/bass policies choose the same shape across the complete reviewed cohort.

Local artifacts: `/home/shaun/chordcards/out/generator-fix-20261029/` contains
`report.md`, `summary.json`, `provenance.json`, `rows.json`, `missing.json`,
`contact-sheet.html` (all changed shapes + all 38 recoveries),
`contact-sheet-sample.html` and `contact-sheet-sample.png` (24 examples),
and validation logs. Nothing was uploaded.
