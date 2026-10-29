# Guitar generator comparison v2

Baseline: `d307e3b378c6864cd61fc39f6571cf0ee1a81586`; after: working source. All 3157 baseline shapes/fingerings match the independent oracle inputs. Both versions regenerated; after explicitly uses **teaching level 3**. Default callers remain at level 2 and never omit roots.

| Group / verdict | Rows | Changed | Unchanged |
|---|---:|---:|---:|
| plain / accept | 104 | 32 | 72 |
| plain / accept-with-note | 234 | 121 | 113 |
| plain / replace | 350 | 296 | 54 |
| plain / no-good-shape | 12 | 12 | 0 |
| slash / accept | 667 | 81 | 586 |
| slash / accept-with-note | 967 | 524 | 443 |
| slash / replace | 818 | 778 | 40 |
| slash / no-good-shape | 5 | 5 | 0 |

- Changed: **1849/3157**.
- Replace changed: **1074/1168**.
- Accept changed (regression watch list, not proven regressions): **113/771**.
- Previously missing recovered: **37/38**. New missing: **3**.
- Still need review: **1801/3157**; **1371** after grouping by review key (2488 distinct review keys).
- Slash bass on E/A: **2359/2457 (96.0%)**.
- Selected lo ≥10 despite a candidate lo ≤7: **55** (Cmaj9(#11,#5), Dm9(#5), Dm9(#11), Ebmaj9(#5), Ebmaj13(#5), Ebmaj13(#11), G#7(b9,b5), G#7(b9,#5), G#maj7(b9), Ab7(b9,b5), Ab7(b9,#5), Abmaj7(b9), A7(#9,b5), Bb7(b9,b5), Bmaj9(#11,#5), Eb6/D, G#6/D, Ab6/D, Am7(b5)/D, Cm6/D, Cm(maj7)/D, C#6/D, E6/Eb, E9/Eb, Gbm7(b5)/Eb, Gm7(b5)/Eb, Am6/Eb, Bbm6/Eb, Bb9/Eb, Dbm6/Eb, Dmaj7/Eb, Dm(maj7)/Eb, Abadd9/G, Am(maj7)/G, Ebm7(b5)/G, F#m6/G, Am7/G#, Am7(b5)/G#, Am6/G#, Bbsus4/G#, C6/G#, Cm6/G#, F7/G#, Fmaj7/G#, F#m7(b5)/G#, Am7/Ab, Am7(b5)/Ab, Am6/Ab, Bbsus4/Ab, C6/Ab, Cm6/Ab, F7/Ab, Fmaj7/Ab, Gbm7(b5)/Ab, A9/Bb).

## Measured signals

| Signal | Before | After |
|---|---:|---:|
| highPosition | 219 | 280 |
| above12 | 44 | 19 |
| openUnderHighHand | 95 | 42 |
| lowInterval | 1016 | 234 |
| bassNotLow | 331 | 114 |
| fingerSpacing | 644 | 110 |

## Reason codes

| Signal | Count |
|---|---:|
| above-12 | 19 |
| b9-clash | 637 |
| barre-5+ | 256 |
| bass-not-low | 114 |
| db-position-rejected | 1 |
| doubled-tension | 6 |
| finger-spacing | 110 |
| high-position | 280 |
| low-interval | 234 |
| omits:1 | 126 |
| omits:11 | 27 |
| omits:5 | 427 |
| omits:9 | 163 |
| open-under-high-hand | 42 |
| rootless | 126 |
| span-4 | 59 |
| three-strings | 92 |
| unison | 83 |

## Confidence

| Signal | Count |
|---|---:|
| 0.40–0.59 | 27 |
| 0.60–0.79 | 522 |
| 0.80–1.00 | 2605 |

Confidence is a deterministic attention heuristic, not a probability of musical correctness. Search without measurable warnings starts at 0.88; each warning reduces it. Every reason still requires review. Enharmonic twins share reviewKey without an extra warning that would inflate the queue. No template layer is implemented here.

## Limits and evidence

Changed does not mean improved or teacher-approved. Original verdicts apply to the **old** shapes. No replacement suggestion is treated as ground truth; in particular the plain review's top-tone preference is not a hard constraint. Every returned shape passes pitch/required-tone validation. `rows.json` contains exact before/after positions, review metadata and the complete accept-change watch list; `missing.json` records outcomes for all 38 formerly missing symbols. `contact-sheet.html` shows every changed shape and all 38 recovery attempts. Existing card/manifest code is unchanged: consumers must use position.review and explicitly request level 3 for rootless output.

The prioritised review's aspirational zero-open/high-position checks are **not fully met**: 42 selected shapes retain open strings with lo ≥5, and 55 retain lo ≥10 with a lower candidate. Costs preserve valid alternatives rather than imposing a blanket hard cutoff; these shapes retain review reasons. The reason-code union includes every omission, all minor-ninth colours, and finger-spacing warnings, so it is intentionally more conservative than the review's ~1,105 estimate.

At the unchanged default level 2, **17** previously generated rows now have no valid shape after the stricter ninth rule (C#maj9(#11,#5), Dbmaj9(#11,#5), F#13(#11,#5), F#maj9(#11,#5), Gb13(#11,#5), Gbmaj9(#11,#5), G#7(#11,b9,#5), G#13(b9,#5), Ab7(#11,b9,#5), Ab13(b9,#5), A9(#11,#5), Amaj9(#11,#5), B9(#11,#5), Bmaj9(#11,#5), Bb9/C#, Bb9/Db, C9/Eb). Of these, 14 remain available at explicit level 3; 3 are unavailable even at level 3 under the root, hand and open-clash constraints (Bb9/C#, Bb9/Db, C9/Eb).
