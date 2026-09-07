import { describe, it, expect } from "vitest";
import { GUITAR_TOP3_PRESETS, lookupTop3Chord } from "../src/staticPresets";
import type { StaticPreset } from "../src/staticPresets";
import { INSTRUMENTS } from "../src/instruments";
import type { ChordsDbPosition } from "../src/instruments";
import { positionToMidi } from "../src/pitch";

const PC: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

/**
 * Chord tones as semitones above the root, written out here rather than imported
 * from the generator. The point of this file is to disagree with the generator
 * when the generator is wrong, and a table that shares its source cannot.
 *
 * Slash suffixes name a bass note that three treble strings cannot sound, so the
 * triad above the slash is the whole of what a top-3 shape can carry.
 */
const INTERVALS: Record<string, number[]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  "7sus4": [0, 5, 7, 10],
  6: [0, 4, 7, 9],
  69: [0, 2, 4, 7, 9],
  7: [0, 4, 7, 10],
  // chords-db's "7sg" is a dominant 7th under another name.
  "7sg": [0, 4, 7, 10],
  "7b5": [0, 4, 6, 10],
  aug7: [0, 4, 8, 10],
  9: [0, 2, 4, 7, 10],
  "9b5": [0, 2, 4, 6, 10],
  aug9: [0, 2, 4, 8, 10],
  "7b9": [0, 1, 4, 7, 10],
  "7#9": [0, 3, 4, 7, 10],
  11: [0, 2, 4, 5, 7, 10],
  "9#11": [0, 2, 4, 6, 7, 10],
  13: [0, 2, 4, 5, 7, 9, 10],
  maj7: [0, 4, 7, 11],
  "maj7b5": [0, 4, 6, 11],
  "maj7#5": [0, 4, 8, 11],
  maj9: [0, 2, 4, 7, 11],
  maj11: [0, 2, 4, 5, 7, 11],
  maj13: [0, 2, 4, 5, 7, 9, 11],
  m6: [0, 3, 7, 9],
  m69: [0, 2, 3, 7, 9],
  m7: [0, 3, 7, 10],
  "m7b5": [0, 3, 6, 10],
  m9: [0, 2, 3, 7, 10],
  m11: [0, 2, 3, 5, 7, 10],
  mmaj7: [0, 3, 7, 11],
  "mmaj7b5": [0, 3, 6, 11],
  mmaj9: [0, 2, 3, 7, 11],
  mmaj11: [0, 2, 3, 5, 7, 11],
  add9: [0, 2, 4, 7],
  madd9: [0, 2, 3, 7],
};

function intervalsFor(suffix: string): number[] {
  if (INTERVALS[suffix]) return INTERVALS[suffix];
  if (suffix.startsWith("m/")) return INTERVALS.minor;
  if (suffix.startsWith("/")) return INTERVALS.major;
  throw new Error(`no chord tones written for suffix "${suffix}"`);
}

const chordTones = (key: string, suffix: string): Set<number> => {
  const root = PC[key];
  if (root === undefined) throw new Error(`unknown root "${key}"`);
  return new Set(intervalsFor(suffix).map((i) => (root + i) % 12));
};

/** The whole note set, which is what decides whether two labels are one chord. */
const toneSetKey = (key: string, suffix: string) =>
  [...chordTones(key, suffix)].sort((a, b) => a - b).join(",");

const OPEN_MIDI = INSTRUMENTS["guitar-top3"].openMidi;

/**
 * A preset back as a chords-db position, so pitches come from the package's own
 * `positionToMidi` rather than a second copy of the fret→pitch rule.
 *
 * Presets are svguitar shapes: string 1 is the highest pitch, so svguitar 3/2/1
 * are chords-db indices 3/4/5. Frets are absolute from the nut, which is what
 * baseFret 1 means.
 */
function toPosition(preset: StaticPreset): ChordsDbPosition {
  const frets = [-1, -1, -1, -1, -1, -1];
  for (const f of preset.chord.fingers) {
    const stringNo = Number(f[0]);
    const fret = f[1];
    frets[6 - stringNo] = fret === "x" ? -1 : Number(fret);
  }
  return { frets, fingers: [0, 0, 0, 0, 0, 0], baseFret: 1, barres: [] };
}

const sounding = (preset: StaticPreset) => toPosition(preset).frets.slice(3);
const label = (p: StaticPreset) => `${p.key}${p.suffix}`;

describe("GUITAR_TOP3_PRESETS coverage", () => {
  it("covers all 12 roots for every quality the design commits to", () => {
    const roots = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    const have = new Set(GUITAR_TOP3_PRESETS.map(label));
    for (const suffix of [
      "major", "minor", "7", "m7", "maj7", "6", "9", "sus2", "sus4", "dim", "aug",
    ]) {
      for (const root of roots) {
        expect(have.has(root + suffix), `missing ${root}${suffix}`).toBe(true);
      }
    }
  });

  it("has one entry per (key, suffix)", () => {
    const seen = new Set(GUITAR_TOP3_PRESETS.map(label));
    expect(seen.size).toBe(GUITAR_TOP3_PRESETS.length);
  });
});

/**
 * Whole-table checks, reported as a list of offenders rather than as 500-odd
 * separate cases: the useful output is "which chords are wrong", and a failing
 * assertion that names them all at once beats hunting through a run log.
 */
describe("every preset sounds its chord", () => {
  it("spells only its own chord tones, by the package's own pitch math", () => {
    const wrong = GUITAR_TOP3_PRESETS.flatMap((p) => {
      const allowed = chordTones(p.key, p.suffix);
      const stray = positionToMidi(toPosition(p), OPEN_MIDI)
        .map((m) => m % 12)
        .filter((pc) => !allowed.has(pc));
      return stray.length ? [`${label(p)} sounds ${stray.join("/")}`] : [];
    });
    expect(wrong).toEqual([]);
  });
});

describe("every preset is playable on the top three strings", () => {
  it("sounds exactly G, B and E — three strings, none muted", () => {
    const wrong = GUITAR_TOP3_PRESETS.flatMap((p) => {
      const top = sounding(p);
      const midi = positionToMidi(toPosition(p), OPEN_MIDI);
      return top.some((f) => f < 0) || midi.length !== 3
        ? [`${label(p)} [${top.join(", ")}]`]
        : [];
    });
    expect(wrong).toEqual([]);
  });

  it("keeps every shape inside a two-fret reach", () => {
    const wrong = GUITAR_TOP3_PRESETS.flatMap((p) => {
      const fretted = sounding(p).filter((f) => f > 0);
      const span = fretted.length < 2 ? 0 : Math.max(...fretted) - Math.min(...fretted);
      return span > 2 ? [`${label(p)} spans ${span}`] : [];
    });
    expect(wrong).toEqual([]);
  });

  it("mutes strings 4-6", () => {
    const wrong = GUITAR_TOP3_PRESETS.flatMap((p) =>
      [4, 5, 6].some((s) => p.chord.fingers.find((x) => Number(x[0]) === s)?.[1] !== "x")
        ? [label(p)]
        : [],
    );
    expect(wrong).toEqual([]);
  });
});

/**
 * The root is what stops a shape naming somebody else's chord: a dominant 7th
 * without its root is a diminished triad on the 3rd, an m7 without its root is
 * the major triad on the b3rd, a maj7 without its root is the minor triad on the
 * 3rd. Shapes that drop it are marked `approximate`; nothing else may.
 */
describe("the root is present", () => {
  it("in every entry not marked approximate", () => {
    const missing = GUITAR_TOP3_PRESETS.filter((p) => {
      if (p.approximate) return false;
      const pcs = positionToMidi(toPosition(p), OPEN_MIDI).map((m) => m % 12);
      return !pcs.includes(PC[p.key]);
    });
    expect(missing.map(label)).toEqual([]);
  });
});

/**
 * Fault 3 of the design: `Am7`, `Fmaj7` and `Dm7` each rendered a diagram that
 * already belonged to another chord, and the per-preset checks above cannot see
 * it because they never compare presets to each other.
 *
 * Two entries may legitimately print one diagram only when they are the same
 * notes — an augmented triad names three roots, `Csus2` and `Gsus4` are both
 * C-D-G, and `C/G` is a C major triad because G-B-E cannot sound a bass note.
 * That is what the tone set decides, and it is the only exemption.
 */
describe("no two chords share a diagram", () => {
  it("unless they are the same notes", () => {
    const byShape = new Map<string, StaticPreset[]>();
    for (const p of GUITAR_TOP3_PRESETS) {
      const k = sounding(p).join(",");
      byShape.set(k, [...(byShape.get(k) ?? []), p]);
    }

    const collisions: string[] = [];
    for (const [shape, group] of byShape) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const a = group[i];
          const b = group[j];
          if (toneSetKey(a.key, a.suffix) === toneSetKey(b.key, b.suffix)) continue;
          if (a.approximate || b.approximate) continue;
          collisions.push(`[${shape}] ${label(a)} / ${label(b)}`);
        }
      }
    }
    expect(collisions).toEqual([]);
  });

  it("and specifically not the three collisions the old table shipped", () => {
    // Am7 sounded C major, Fmaj7 sounded A minor, Dm7 sounded F major.
    for (const [a, b] of [
      [["A", "m7"], ["C", "major"]],
      [["F", "maj7"], ["A", "minor"]],
      [["D", "m7"], ["F", "major"]],
    ] as const) {
      const left = lookupTop3Chord(a[0], a[1]);
      const right = lookupTop3Chord(b[0], b[1]);
      expect(left, `${a.join("")} must exist`).not.toBeNull();
      expect(right, `${b.join("")} must exist`).not.toBeNull();
      expect(JSON.stringify(left), `${a.join("")} still renders as ${b.join("")}`)
        .not.toBe(JSON.stringify(right));
    }
  });
});

/**
 * The fifteen hand-authored shapes that kept the root and named no other chord
 * are the first-position shapes a learner already knows. Pinned one by one so a
 * generator change cannot quietly restyle one of them.
 */
describe("the qualifying legacy presets are unchanged", () => {
  const PINNED: Array<[string, string, [number, number, number]]> = [
    ["C", "major", [0, 1, 0]],
    ["G", "major", [0, 0, 3]],
    ["D", "major", [2, 3, 2]],
    ["A", "major", [2, 2, 0]],
    ["E", "minor", [0, 0, 0]],
    ["A", "minor", [2, 1, 0]],
    ["D", "minor", [2, 3, 1]],
    ["E", "major", [1, 0, 0]],
    ["C", "7", [3, 1, 0]],
    ["G", "7", [0, 0, 1]],
    ["B", "minor", [4, 3, 2]],
    ["F", "major", [2, 1, 1]],
    ["E", "7", [1, 3, 0]],
    ["E", "m7", [0, 3, 0]],
    ["G", "minor", [3, 3, 3]],
  ];

  for (const [key, suffix, frets] of PINNED) {
    it(`${key}${suffix} is still [${frets.join(", ")}] on G, B, E`, () => {
      const preset = GUITAR_TOP3_PRESETS.find((p) => p.key === key && p.suffix === suffix);
      expect(preset, `${key}${suffix} must exist`).toBeDefined();
      expect(sounding(preset!)).toEqual(frets);
      expect(preset!.source).toBe("legacy");
    });
  }
});

/**
 * The other five dropped the root, so each of them printed some other chord's
 * diagram. They had to change, and asserting it here is what stops the fix
 * regressing the next time the generator is touched.
 */
describe("the root-dropped legacy presets have changed", () => {
  const REPLACED: Array<[string, string, [number, number, number]]> = [
    ["D", "7", [2, 1, 2]],
    ["A", "7", [0, 2, 0]],
    ["A", "m7", [0, 1, 0]],
    ["D", "m7", [2, 1, 1]],
    ["F", "maj7", [2, 1, 0]],
  ];

  for (const [key, suffix, old] of REPLACED) {
    it(`${key}${suffix} no longer uses the rootless [${old.join(", ")}]`, () => {
      const preset = GUITAR_TOP3_PRESETS.find((p) => p.key === key && p.suffix === suffix);
      expect(preset, `${key}${suffix} must exist`).toBeDefined();
      expect(sounding(preset!)).not.toEqual(old);
      expect(preset!.source).not.toBe("legacy");
      const pcs = positionToMidi(toPosition(preset!), OPEN_MIDI).map((m) => m % 12);
      expect(pcs, `${key}${suffix} must now sound its root`).toContain(PC[key]);
    });
  }
});

describe("the shapes the design calls out by name", () => {
  const EXPECTED: Array<[string, string, [number, number, number]]> = [
    ["B", "major", [4, 4, 2]],
    ["B", "7", [4, 4, 5]],
    ["F#", "minor", [2, 2, 2]],
    ["C", "sus4", [0, 1, 1]],
    ["A", "sus2", [2, 0, 0]],
    ["C", "aug", [1, 1, 0]],
  ];
  for (const [key, suffix, frets] of EXPECTED) {
    it(`${key}${suffix} is [${frets.join(", ")}]`, () => {
      const preset = GUITAR_TOP3_PRESETS.find((p) => p.key === key && p.suffix === suffix);
      expect(preset, `${key}${suffix} must exist`).toBeDefined();
      expect(sounding(preset!)).toEqual(frets);
    });
  }
});

describe("lookupTop3Chord", () => {
  it("returns a shape for a known chord", () => {
    expect(lookupTop3Chord("B", "minor")).not.toBeNull();
  });

  it("now answers the roots the hand-authored table had nothing for", () => {
    for (const key of ["C#", "Eb", "F#", "Ab", "Bb"]) {
      expect(lookupTop3Chord(key, "major"), key).not.toBeNull();
    }
  });

  it("returns null for a chord three strings cannot hold", () => {
    // An altered dominant needs its 3rd, its b7 and the alteration it is named
    // for — four notes. Guessing would print a plain dominant under an alt label.
    expect(lookupTop3Chord("C", "alt")).toBeNull();
  });

  it("returns null for a suffix that is not a chord", () => {
    expect(lookupTop3Chord("C", "not-a-chord")).toBeNull();
  });
});
