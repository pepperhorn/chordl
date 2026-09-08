import { Note } from "tonal";

/**
 * Chord shapes as semitone offsets from their own root.
 *
 * Copied from `chordl-listen`'s `CHORD_TEMPLATES` rather than imported:
 * that package is audio detection and matches a chroma vector by similarity,
 * while this matches an exact set, and `chordl-voicings` must not depend on
 * it. The table is the shared thing, not the matcher.
 */
const TEMPLATES: { offsets: number[]; suffix: string }[] = [
  { offsets: [0, 4, 7], suffix: "" },
  { offsets: [0, 3, 7], suffix: "m" },
  { offsets: [0, 3, 6], suffix: "dim" },
  { offsets: [0, 4, 8], suffix: "aug" },
  { offsets: [0, 5, 7], suffix: "sus4" },
  { offsets: [0, 2, 7], suffix: "sus2" },
  { offsets: [0, 4, 7, 10], suffix: "7" },
  { offsets: [0, 4, 7, 11], suffix: "maj7" },
  { offsets: [0, 3, 7, 10], suffix: "m7" },
  { offsets: [0, 3, 6, 10], suffix: "m7b5" },
  { offsets: [0, 3, 6, 9], suffix: "dim7" },
  { offsets: [0, 4, 7, 9], suffix: "6" },
  { offsets: [0, 3, 7, 9], suffix: "m6" },
];

const PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/**
 * Every chord name a set of pitch classes spells.
 *
 * Returns more than one name whenever the set is genuinely ambiguous — an
 * augmented triad is symmetric, so C-E-G# is equally E-G#-C and Ab-C-E, and a
 * diminished seventh has four equally correct names. That is #50's `inherent`
 * grading seen from the naming side: not a defect to warn about, but a fact
 * about the notes that no voicing can resolve.
 *
 * At most one template can match a given root: every shape in `TEMPLATES` is
 * a distinct sorted offset list, so for a fixed root the `every` comparison
 * below can hold for only one of them. Ambiguity here comes entirely from
 * trying every note as a candidate root, never from one root matching twice —
 * which is also why a 4-note symmetric set (dim7) comes out to exactly 4
 * names, one per root, and not 4 roots times some larger multiple.
 *
 * `Note.chroma` returns `NaN`, not `null` or `undefined`, for a name it
 * cannot parse, so the filter below checks `Number.isInteger` rather than
 * `!= null` — the latter would let a `NaN` "pitch class" through and corrupt
 * the sort and the offset arithmetic that follows.
 *
 * Rendered nowhere yet, on purpose. How often this fires across the corpus
 * has not been measured, and that measurement should choose the presentation.
 */
export function spellingsFor(pitchClasses: string[]): string[] {
  const pcs = [
    ...new Set(
      pitchClasses.map((n) => Note.chroma(n)).filter((c): c is number => Number.isInteger(c)),
    ),
  ].sort((a, b) => a - b);
  if (pcs.length === 0) return [];

  const names: string[] = [];
  for (const root of pcs) {
    const offsets = pcs.map((pc) => (((pc - root) % 12) + 12) % 12).sort((a, b) => a - b);
    for (const t of TEMPLATES) {
      if (t.offsets.length !== offsets.length) continue;
      if (t.offsets.every((o, i) => o === offsets[i])) {
        names.push(`${PITCH_CLASSES[root]}${t.suffix}`);
      }
    }
  }
  return names;
}
