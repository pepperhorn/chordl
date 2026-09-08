# Experience levels for piano voicings, and one control for both frames

**Date:** 2026-09-08
**Status:** draft — awaiting review
**Context:** follows `2026-09-07-experience-levels-and-frame-options-design.md` (merged as #52, built as #54), which shipped the ladder for guitar only. Depends on nothing in `2026-09-07-power-chords-and-ambiguity-grading-design.md` (#50, approved and unbuilt), but shares vocabulary with it — see *The ambiguity layer*.

## Problem

**The ladder stops at the guitar.** #54 shipped `ExperienceLevel`, `levelForFacts`, `levelForTop3` and `selectForExperience` in `chordl-guitar`, and `GuitarChordPanel` filters on them. Switch the display to Keyboard and the concept vanishes: `generateVariants` orders variants by *source* — inversions, then library, then algorithmic — which is a statement about where a voicing came from, not about whether the player can play it. A learner who has told us they are a beginner is still offered `rootless-alt-b` as variant D.

**The level control is in the wrong place, and unwired.** `GuitarChordPanel` renders its own three-pill toggle, so the setting lives inside the guitar frame and dies when the display switches. `GuitarChordPanel` already accepts `level` and `onLevelChange` props for a host to drive it; `dev/App.tsx` passes neither, unlike `instrument` and `position`, which it owns and persists. So the level is not stored on a board card, and cannot be, and a control that means the same thing in both frames exists in only one of them.

**Four library entries are drawn as something other than what they are.** Not a consequence of this work — found while measuring for it, and it corrupts any span-based rule, so it is recorded here and fixed separately.

`realizeVoicingFull` maps each entry's `intervals` to MIDI, then keeps only `Note.pitchClass(...)`. Every octave is discarded. `PianoChord` re-derives octaves from the ordered pitch classes with `ascendingOctaves` (`diatonic-step.ts`), which bumps an octave whenever a note's *letter* fails to advance. Declared span and drawn span therefore agree only by coincidence. And because `spellForKey` spells per key, the letter-walk — and so the drawn shape — depends on the **root**: the same entry is drawn correctly at one root and wrongly at another. Measured across all 72 entries × 12 roots, **64 of 864 pairs are misdrawn, spanning 9 entries**:

| entry | declared | drawn | roots | what happens |
|---|---|---|---|---|
| `shell-maj7-tenth` | `[0,16]` | `[0,4]` | all 12 | a tenth, drawn as a major third |
| `shell-dom7-tenth` | `[0,16]` | `[0,4]` | all 12 | a tenth, drawn as a major third |
| `shell-min7-tenth` | `[0,15]` | `[0,3]` | all 12 | a tenth, drawn as a minor third |
| `rootless-alt-b` | `[0,5,6,10]` | `[0,5,18,22]` | 7 | a close grip, drawn across two octaves |
| `rootless-min7-b` | `[0,4,5,9]` | `[0,4,17,21]` | 5 | ditto |
| `rootless-m7b5-b` | `[0,4,5,8]` | `[0,4,17,20]` | 5 | ditto |
| `spread-madd9` | `[0,7,14,15]` | `[0,7,14,27]` | 5 | ditto |
| `rootless-dom7-a` | `[0,5,6,10]` | `[0,5,18,22]` | 3 | ditto |
| `4close-dom7` | `[0,5,6,10]` | `[0,5,18,22]` | 3 | ditto |

The three tenth shells are named for the interval that defines them and render as plain thirds. The rootless grips go the other way — close four-note voicings drawn across two octaves, which no hand plays.

An earlier draft of this spec said four entries. That count was taken at root C with sharp spelling and missed the root-dependence entirely; it is corrected here, and the fix (#57) covers all nine.

Six of the nine are also **unreachable** in the running app: `findVoicing` and `generateVariants` keep only the first entry per (quality, style), so the tenth shells lose to `shell-maj7-r7`, and `inferStyle` never returns "Rootless Type B" because the substring `rootless` matches Type A first. That reachability bug is real, separate, and not fixed by #57.

## Decisions

### The rule

A voicing is **beginner** when all of:

- its quality is in the core set — major, minor, diminished and augmented triads, `maj7`, `dom7`, `sus2`, `sus4`, `5`;
- it is that chord in root position **or any inversion**;
- it has at most 4 notes;
- its span is at most 11 semitones (a major 7th).

It is **emerging** when every pitch class is either one of the chord's own defining tones — at any octave, so a doubling is free — or a natural 9th. Note count and span are unbounded at this rung.

"Defining tones" means the root, third, fifth and seventh, and nothing else. The implementation makes this precise: a voicing is established when its pitch-class set contains 1, 5 or 9, or contains two members of any one of the tertian families (`[3,4]`, `[6,7,8]`, `[10,11]`). So a 6th, an 11th and a diminished seventh all read as tensions rather than as chord tones, and `C6`, `Cdim7`, `Cadd11` and `C7sus4` are established. That was considered and kept: a sixth and an eleventh are colours beyond the basic triad-and-seventh vocabulary, and admitting them would have meant deciding, from semitones alone, whether a 9 is a chord's own sixth or a thirteenth over a seventh — a distinction `levelForVoicing` has no way to make, since it never sees the chord's identity.

Otherwise it is **established**.

Two consequences worth stating, because both look like bugs and are not:

**Most qualities have no beginner voicing at all, and that is the answer, not a gap.** `m7b5`, `dim7`, `6/9`, `m6/9`, `alt`, `maj7b5` and the four `add` qualities are not chords a beginner plays. Generating 3-note shells to populate them was considered and dropped: it would have put a `[4,10,13]` altered-dominant shell in front of someone who cannot yet play a first-inversion triad. `selectVoicingsForExperience` widens a rung and says so, which is the honest answer to "show me the beginner voicing of C7alt".

**The quality allowlist makes this rule a hybrid, unlike guitar's.** `levelForFacts` is purely physical — a barre is hard to hold regardless of what chord it spells. Piano cannot be, because physical ease and musical demand come apart: a rootless Type A voicing is four close notes any hand can play and is not a beginner's chord. The allowlist is where that judgement lives, and it is the reason `levelForVoicing` needs the quality, not just the notes.

### Note count 4, not 3

The rule began at 3 notes. Inversions of `maj7` and `dom7` are 4 — `E-G-B-C` is a first-inversion Cmaj7 — and a beginner plays a root-position Cmaj7 with four fingers on their first day. Every inversion of Cmaj7 and C7 spans between 8 and 11, so the span bound already excludes anything a hand cannot reach, and the count was doing no work the span was not already doing better. Raising it moved beginner-eligible library entries from 9 to 28 before the allowlist is applied.

The cap stays at 4 rather than being dropped entirely: a 5-note voicing inside a major 7th is a cluster, which is not beginner material even though the span admits it.

### Span comes from `intervals` where they exist, and from the stack where they do not

The two paths carry different information and must be measured differently:

- **Library variants** carry `VoicingEntry.intervals` — real semitone offsets. Rank on `max - min`. This is the author's intent and the true playing difficulty.
- **Inversion and algorithmic variants** have no intervals; the ordered pitch classes *are* the voicing. Rank on the span the `ascendingOctaves` walk produces, which is a pure function of that order — the agent trace confirmed no renderer state is needed, and that `chordOctave`, padding, `startingNote` and the octave-shift modifiers all shift the whole stack uniformly and so cannot change a span.

For 63 of 72 library entries the two numbers are identical at every root, so this distinction is invisible. For the 9 above it is the difference between calling a tenth stretch "beginner" and calling it what it is. Ranking on what is drawn would invert the tenth shells specifically — they are the *narrowest* things in the library on screen.

Once the rendering bug is fixed the two numbers converge for all 72 and this decision costs nothing. It is written down so that the fix does not look like it invalidates the rule.

### The ladder is duplicated, and pinned by a test

`ExperienceLevel` and `EXPERIENCE_LADDER` cannot be shared through a common package:

- `chordl-guitar` depends on `chords-db` and `svguitar` and **nothing in this workspace**. #50 records that it must keep publishing standalone; giving it its first workspace dependency to import a string union would break that for no benefit.
- `chordl-core` already depends on `chordl-voicings`, so `chordl-voicings` importing from `chordl-core` is a cycle.

So `chordl-voicings` declares its own `ExperienceLevel` and `EXPERIENCE_LADDER`, identical to `chordl-guitar`'s, and a test in `chordl-react` — the only package that depends on both — asserts the two unions and ladders agree and fails if they drift.

This is the house pattern, not a new one: `scripts/build-top3.mjs` carries an inline copy of the top-3 ranking rule because plain ESM cannot import the TypeScript module, and `test/top3Generated.test.ts` pins the two together, the same treatment `DIAGRAM_FRETS` already gets. Duplication pinned by a test is what this codebase does when a boundary forbids sharing.

### One control, in the annotations row

A single `ExperienceLevel` lives in `dev/App.tsx` and drives both frames.

It renders as a radio group at the **left of `interactive-controls-line-annotations`**, before Note names / Degrees / Fingering, defaulting to `emerging` (the middle rung). Unlike its row-mates it never greys out — it means something in both display modes, which is the point of moving it there.

`GuitarChordPanel` loses its internal pill toggle and is driven by the `level` / `onLevelChange` props it already declares. The level joins `guitarInstrument` and `guitarPosition` in the board-card payload.

Two behaviour changes fall out, both intended:

- The guitar frame's default moves from `established` (which matches everything) to `emerging`, so it now hides established shapes by default where it previously hid none.
- A host embedding `GuitarChordPanel` bare gets no level UI until it passes the prop. Acceptable: `chordl-board`'s cards pass `showControls={false}` and never ran the filter anyway.

### The ambiguity layer, unrendered

An augmented triad is symmetric — C-E-G♯ is equally E-G♯-C and A♭-C-E — and diminished chords likewise. Both are in the beginner set, so a learner meets genuine spelling ambiguity early, and #50 already has the vocabulary for it: `inherent`, meaning complete but not uniquely nameable, as against `reduced`, meaning a named tone is missing.

`spellingsFor(pitchClasses)` — a pitch-class set to ranked chord names — is added to `chordl-voicings`, exported and tested, and **rendered nowhere**. `chordl-listen`'s `matchChord` is the nearest existing thing but is chroma-similarity over 13 templates for audio detection; its `CHORD_TEMPLATES` table is reusable as data, the matcher is not.

Shipping it unrendered is deliberate. How often it fires across the corpus is not yet measured, and that measurement should decide the presentation rather than a guess about it. #50's implementation is the natural consumer.

### One library entry

The `5` quality has no beginner voicing and cannot have a 3-note one. Its two pitch classes sit 5 and 7 semitones apart, so any three octave-transposed picks span two consecutive gaps summing to exactly 12 — the existing `power-5` (`[0,7,12]`) misses the bound by one semitone structurally, not by choice.

A 2-note `[0,7]` — root and fifth, the `C-G` shell — satisfies the rule (at most 4 notes, span 7). It takes style `Shell`, which already means "root plus one tone" and which the `5` quality already uses. No new `VoicingStyle` is needed.

## Coverage

- 72 library entries. Beginner-eligible by note count and span alone: 28 (was 9 at a 3-note cap). The quality allowlist reduces this further; the exact figure is an implementation measurement, not a design input.
- Triads never touch `VOICING_LIBRARY` — `generateVariants` produces them through its inversion path from `resolvedNotes`. Root position spans 7, first inversion 8, second 9: all beginner.
- `maj7`, `dom7`, `sus4` and `sus2` already have beginner entries (2, 2, 1 and 1 respectively). `min7` has 2 as a side effect of the same shells, which is harmless.
- Declared and drawn span agree for 63 of 72 entries at every root; 64 of 864 (entry, root) pairs disagree, spanning 9 entries.

## Constraints

- **Additive.** `generateVariants`, `voicingPitchClasses`, `realizeVoicingFull` and `VoicingEntry` keep their signatures. `VoicingVariant` gains an optional `level`.
- `chordl-guitar` gains no dependency. `chordl-voicings` gains no dependency.
- `selectForExperience`'s contract is reused verbatim on the piano side: cumulative matching (a level matches every rung at or below it), drop the refinement before widening the level, widen one rung at a time, and report having widened. A learner filter that silently ignores itself is worse than one that says it could not be honoured.
- `GuitarChordPanel`'s `level` / `onLevelChange` props keep their current meaning and defaults, so the panel stays usable standalone.
- The four mis-drawn entries are **not** fixed here. Ranking on `intervals` makes this design correct in their presence, and the fix is its own change.

## Testing

1. **The ladders agree** — `chordl-react` asserts `chordl-voicings`' `ExperienceLevel` and `EXPERIENCE_LADDER` are identical to `chordl-guitar`'s. This is the test that makes duplication safe.
2. **The rule, per rung** — a root-position and every inversion of each core quality ranks beginner; a 5-note close cluster does not; a spread voicing does not.
3. **Span source** — a library entry ranks on its `intervals`, an inversion variant on its stacked pitch classes. Assert `shell-maj7-tenth` ranks by its declared 16 and **not** by its drawn 4; this test fails if someone later "simplifies" the two paths into one.
4. **Emerging reads doublings correctly** — `spread-madd9`'s interval 15 is its own b3 an octave up and stays emerging; a genuine `#9` over a dominant does not.
5. **Relaxation** — a beginner request for `C7alt` widens a rung and reports it. Pin the order the way #53's Task 3 does, on a case where the two orderings actually diverge, so a reversed implementation fails.
6. **The power shell** — `5` has a beginner voicing; assert the span, not just its presence.
7. **The control drives both frames** — one level change reaches the guitar panel and the voicing toggle; the control does not disable itself in either display mode.
8. **`spellingsFor`** — an augmented triad returns its three names, a diminished seventh its four, an unambiguous major triad exactly one.

## Open items

- [ ] Implementation plan and build
- [ ] Reachability: six of the nine mis-drawn entries cannot be selected in the app at all (first-per-style dedup, and `inferStyle` never returning "Rootless Type B"). Its own change.
- [x] Octave fidelity for the 9 mis-drawn entries — landed as #57; see *Problem*. Once landed, declared and drawn span converge and decision *Span comes from `intervals`* becomes a statement about two equal numbers.
- [ ] Rendering for `spellingsFor` — decide on measured firing rates, with #50's `reason` grading as the natural consumer.
- [ ] Whether `min7` belongs in the core set. It has beginner shells today by accident of sharing the maj7/dom7 shell shapes; nobody has decided whether a beginner is offered a minor 7th.
