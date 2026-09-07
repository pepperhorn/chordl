import type { Chord } from "svguitar";
import { INSTRUMENTS } from "./instruments.js";
import { rootPitchClass } from "./pitch.js";
import { toDbSuffix } from "./chordNames.js";
import { TOP3_GENERATED, TOP3_UNRESOLVED } from "./top3Generated.js";
import type { Top3GeneratedEntry, Top3Source } from "./top3Generated.js";
import type { ExperienceLevel } from "./experience.js";

export interface StaticPreset {
  key: string;
  suffix: string;
  chord: Chord;
  /**
   * Where the shape came from: a hand-authored beginner preset, a window taken
   * from a stored chords-db voicing, or one built from the chord's pitch classes.
   */
  source?: Top3Source;
  /** How hard the shape is to play. Derived; see src/experience.ts. */
  level: ExperienceLevel;
  /**
   * True when the shape is playable but not a faithful spelling — it drops the
   * root, or its three notes also name another chord. A caller may present these
   * differently; nothing here treats them as second class.
   */
  approximate?: boolean;
}

/** Strings 4-6 are always muted for top-3 voicings. */
const MUTED_LOW: Chord["fingers"] = [[4, "x"], [5, "x"], [6, "x"]];

/** How many frets a `guitar-top3` diagram draws. */
const DIAGRAM_FRETS = INSTRUMENTS["guitar-top3"].frets;

/**
 * Where a shape's diagram window starts, and its frets within that window.
 *
 * The generated table stores absolute frets, measured from the nut. Two thirds
 * of it sits past the drawn window, so a diagram has to say which window it is:
 *
 *   - within `DIAGRAM_FRETS` of the nut, the window is the nut. Frets stay as
 *     they are, and open strings are drawn as open strings.
 *   - anything higher slides. The window starts at the shape's lowest fretted
 *     fret and each fret becomes `f - position + 1`.
 *
 * -1 and 0 are sentinels and are never offset. A slid window never carries a 0:
 * the generator does not emit a shape that mixes an open string with a note past
 * the window, because no window could show both.
 */
export function top3Window(frets: readonly number[]): {
  position: number;
  frets: number[];
} {
  const fretted = frets.filter((f) => f > 0);
  const highest = fretted.length ? Math.max(...fretted) : 0;
  if (highest <= DIAGRAM_FRETS) return { position: 1, frets: [...frets] };
  const position = Math.min(...fretted);
  return { position, frets: frets.map((f) => (f > 0 ? f - position + 1 : f)) };
}

/**
 * One generated row → an svguitar shape, in the window it is drawn in.
 *
 * The table lists frets low → high as [G, B, E], which is chords-db's string
 * order. svguitar numbers strings from the highest pitch, so those same three
 * are svguitar 3, 2 and 1. This is the relabelling, and it is the only one:
 * `dbPositionToChord` remains the single function that inverts string order.
 */
function toPreset(entry: Top3GeneratedEntry): StaticPreset {
  const finger = (
    stringNo: number,
    fret: number,
    label: string,
  ): Chord["fingers"][number] => (label ? [stringNo, fret, label] : [stringNo, fret]);

  const window = top3Window(entry.frets);

  return {
    key: entry.key,
    suffix: entry.suffix,
    chord: {
      fingers: [
        finger(3, window.frets[0], entry.fingers[0]),
        finger(2, window.frets[1], entry.fingers[1]),
        finger(1, window.frets[2], entry.fingers[2]),
        ...MUTED_LOW,
      ],
      barres: [],
      position: window.position,
    },
    source: entry.source,
    level: entry.level,
    ...(entry.approximate ? { approximate: true as const } : {}),
  };
}

/**
 * Beginner voicings on the top three strings (G B E), for all 12 roots.
 *
 * Generated — see src/top3Generated.ts and scripts/build-top3.mjs for how each
 * shape was chosen, and docs/superpowers/specs/2026-09-07-guitar-top3-generated-voicings-design.md
 * for why. Every entry is checked against pitch-class arithmetic, and against
 * every other entry, by staticPresets.test.ts: a wrong shape is unrecoverable
 * once printed, and a shape that duplicates another chord's is a wrong shape.
 *
 * This replaces twenty hand-authored entries that covered 7 of 12 roots and, in
 * five cases, dropped the root — which made `Am7` print C major, `Fmaj7` print
 * A minor and `Dm7` print F major.
 */
export const GUITAR_TOP3_PRESETS: StaticPreset[] = TOP3_GENERATED.map(toPreset);

/**
 * Indexed by pitch class, not by spelling.
 *
 * The table stores roots as chords-db spells them — `C#` and `F#`, but `Eb`,
 * `Ab` and `Bb` — which is not what a user types, and matching the string meant
 * `Db`, `D#`, `G#` and `A#` reached nothing at all. A pitch class has no
 * spelling, so `rootPitchClass` — the package's one root parser, which already
 * knows every enharmonic down to `Cb` and `B#` — resolves both sides.
 */
const BY_PITCH_CLASS = new Map(
  GUITAR_TOP3_PRESETS.map((p) => [`${rootPitchClass(p.key)} ${p.suffix}`, p]),
);

/**
 * Find a preset by any spelling of its root and any alias of its quality.
 *
 * Suffixes go through the same `toDbSuffix` the six-string lookup uses, because
 * the table is keyed with chords-db's own suffix names — so `ø`, `M7`, `°7`,
 * `sus` and `6/9` resolve here exactly as they do there, rather than through a
 * second, smaller copy of that knowledge.
 */
export function findTop3Preset(key: string, suffix: string): StaticPreset | null {
  const pc = rootPitchClass(key);
  if (pc === null) return null;
  return BY_PITCH_CLASS.get(`${pc} ${toDbSuffix(suffix)}`) ?? null;
}

/**
 * Look up a top-3 shape. Returns null rather than guessing at an unknown chord.
 *
 * A null here is a fact, not a gap: the altered dominants in `TOP3_UNRESOLVED`
 * need four notes to exist, and three strings cannot carry them.
 */
export function lookupTop3Chord(key: string, suffix: string): Chord | null {
  return findTop3Preset(key, suffix)?.chord ?? null;
}

export { TOP3_UNRESOLVED };
