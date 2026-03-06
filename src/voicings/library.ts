import type { VoicingEntry } from "./types";

/**
 * Jazz Piano Voicing Library
 *
 * All intervals are semitones relative to the chord root.
 * Derived from Mark Levine's "The Jazz Piano Book".
 *
 * Interval reference:
 *   m2=1  M2=2  m3=3  M3=4  P4=5  TT=6  P5=7
 *   m6=8  M6=9  m7=10 M7=11 P8=12 m9=13 M9=14
 *   m10=15 M10=16 P11=17 #11=18 P12=19 m13=20 M13=21
 */

// ============================================================
// CATEGORY A: SHELL VOICINGS (BEBOP)
// Bud Powell, Thelonious Monk
// The foundation: Root + one guide tone (3rd or 7th)
// ============================================================

const shells: VoicingEntry[] = [
  {
    id: "shell-maj7-r7",
    name: "Shell Maj7 (Root + 7)",
    quality: "maj7",
    intervals: [0, 11], // Root, M7
    tags: { era: "Bebop", style: "Shell", artist: "Bud Powell", source: "Levine Ch. 2" },
    range: { min: 36, max: 60 }, // C2–C4
  },
  {
    id: "shell-maj7-r3",
    name: "Shell Maj7 (Root + 3)",
    quality: "maj7",
    intervals: [0, 4], // Root, M3
    tags: { era: "Bebop", style: "Shell", artist: "Bud Powell", source: "Levine Ch. 2" },
    range: { min: 36, max: 60 },
  },
  {
    id: "shell-maj7-tenth",
    name: "Shell Maj7 (Tenth)",
    quality: "maj7",
    intervals: [0, 16], // Root, M3 up an octave
    tags: { era: "Bebop", style: "Shell", artist: "Bud Powell", source: "Levine Ch. 2" },
    range: { min: 36, max: 55 },
  },
  {
    id: "shell-min7-r7",
    name: "Shell m7 (Root + b7)",
    quality: "min7",
    intervals: [0, 10], // Root, m7
    tags: { era: "Bebop", style: "Shell", artist: "Bud Powell", source: "Levine Ch. 2" },
    range: { min: 36, max: 60 },
  },
  {
    id: "shell-min7-r3",
    name: "Shell m7 (Root + b3)",
    quality: "min7",
    intervals: [0, 3], // Root, m3
    tags: { era: "Bebop", style: "Shell", artist: "Bud Powell", source: "Levine Ch. 2" },
    range: { min: 36, max: 60 },
  },
  {
    id: "shell-min7-tenth",
    name: "Shell m7 (Tenth)",
    quality: "min7",
    intervals: [0, 15], // Root, m3 up an octave
    tags: { era: "Bebop", style: "Shell", artist: "Bud Powell", source: "Levine Ch. 2" },
    range: { min: 36, max: 55 },
  },
  {
    id: "shell-dom7-r7",
    name: "Shell Dom7 (Root + b7)",
    quality: "dom7",
    intervals: [0, 10], // Root, m7
    tags: { era: "Bebop", style: "Shell", artist: "Bud Powell", source: "Levine Ch. 2" },
    range: { min: 36, max: 60 },
  },
  {
    id: "shell-dom7-r3",
    name: "Shell Dom7 (Root + 3)",
    quality: "dom7",
    intervals: [0, 4], // Root, M3
    tags: { era: "Bebop", style: "Shell", artist: "Bud Powell", source: "Levine Ch. 2" },
    range: { min: 36, max: 60 },
  },
  {
    id: "shell-dom7-tenth",
    name: "Shell Dom7 (Tenth)",
    quality: "dom7",
    intervals: [0, 16], // Root, M3 up an octave
    tags: { era: "Bebop", style: "Shell", artist: "Bud Powell", source: "Levine Ch. 2" },
    range: { min: 36, max: 55 },
  },
];

// ============================================================
// CATEGORY B: ROOTLESS VOICINGS (POST-BOP)
// Bill Evans, Wynton Kelly
// Omit root (bass player handles it). 4-note shapes.
// Type A: starts on 3rd. Type B: starts on 7th.
// ============================================================

const rootless: VoicingEntry[] = [
  // --- Major 7th ---
  {
    id: "rootless-maj7-a",
    name: "Rootless Maj7 Type A (3-5-7-9)",
    quality: "maj7",
    intervals: [4, 7, 11, 14], // M3, P5, M7, M9
    tags: { era: "Post-Bop", style: "Rootless Type A", artist: "Bill Evans", source: "Levine Ch. 3" },
    range: { min: 50, max: 67 }, // D3–G4
  },
  {
    id: "rootless-maj7-b",
    name: "Rootless Maj7 Type B (7-9-3-5)",
    quality: "maj7",
    intervals: [11, 14, 16, 19], // M7, M9, M3+8va, P5+8va
    tags: { era: "Post-Bop", style: "Rootless Type B", artist: "Bill Evans", source: "Levine Ch. 3" },
    range: { min: 50, max: 67 },
  },

  // --- Minor 7th ---
  {
    id: "rootless-min7-a",
    name: "Rootless m7 Type A (b3-5-b7-9)",
    quality: "min7",
    intervals: [3, 7, 10, 14], // m3, P5, m7, M9
    tags: { era: "Post-Bop", style: "Rootless Type A", artist: "Bill Evans", source: "Levine Ch. 3" },
    range: { min: 50, max: 67 },
  },
  {
    id: "rootless-min7-b",
    name: "Rootless m7 Type B (b7-9-b3-5)",
    quality: "min7",
    intervals: [10, 14, 15, 19], // m7, M9, m3+8va, P5+8va
    tags: { era: "Post-Bop", style: "Rootless Type B", artist: "Bill Evans", source: "Levine Ch. 3" },
    range: { min: 50, max: 67 },
  },

  // --- Dominant 7th ---
  {
    id: "rootless-dom7-a",
    name: "Rootless Dom7 Type A (3-13-b7-9)",
    quality: "dom7",
    intervals: [4, 9, 10, 14], // M3, M6(13), m7, M9
    tags: { era: "Post-Bop", style: "Rootless Type A", artist: "Bill Evans", source: "Levine Ch. 3" },
    range: { min: 50, max: 67 },
  },
  {
    id: "rootless-dom7-b",
    name: "Rootless Dom7 Type B (b7-9-3-13)",
    quality: "dom7",
    intervals: [10, 14, 16, 21], // m7, M9, M3+8va, M13+8va
    tags: { era: "Post-Bop", style: "Rootless Type B", artist: "Bill Evans", source: "Levine Ch. 3" },
    range: { min: 50, max: 67 },
  },

  // --- Altered Dominant ---
  {
    id: "rootless-alt-a",
    name: "Rootless Alt Type A (3-b7-#9-b13)",
    quality: "alt",
    intervals: [4, 10, 15, 20], // M3, m7, #9(m10), b13(m6+8va)
    tags: { era: "Post-Bop", style: "Rootless Type A", artist: "Bill Evans", source: "Levine Ch. 4" },
    range: { min: 50, max: 67 },
  },
  {
    id: "rootless-alt-b",
    name: "Rootless Alt Type B (b7-#9-3-b13)",
    quality: "alt",
    intervals: [10, 15, 16, 20], // m7, #9, M3+8va, b13
    tags: { era: "Post-Bop", style: "Rootless Type B", artist: "Bill Evans", source: "Levine Ch. 4" },
    range: { min: 50, max: 67 },
  },

  // --- Half-Diminished (m7b5) ---
  {
    id: "rootless-m7b5-a",
    name: "Rootless m7b5 Type A (b3-b5-b7-9)",
    quality: "m7b5",
    intervals: [3, 6, 10, 14], // m3, dim5, m7, M9
    tags: { era: "Post-Bop", style: "Rootless Type A", artist: "Bill Evans", source: "Levine Ch. 3" },
    range: { min: 50, max: 67 },
  },
  {
    id: "rootless-m7b5-b",
    name: "Rootless m7b5 Type B (b7-9-b3-b5)",
    quality: "m7b5",
    intervals: [10, 14, 15, 18], // m7, M9, m3+8va, dim5+8va
    tags: { era: "Post-Bop", style: "Rootless Type B", artist: "Bill Evans", source: "Levine Ch. 3" },
    range: { min: 50, max: 67 },
  },
];

// ============================================================
// CATEGORY C: QUARTAL VOICINGS (MODAL)
// McCoy Tyner, Chick Corea, Kenny Barron
// Built on stacked perfect fourths (5 semitones)
// ============================================================

const quartal: VoicingEntry[] = [
  {
    id: "quartal-3note",
    name: "Quartal Stack (3 notes)",
    quality: "sus4",
    intervals: [0, 5, 10], // Root, P4, m7
    tags: { era: "Modal", style: "Quartal", artist: "McCoy Tyner", source: "Levine Ch. 11" },
    range: { min: 48, max: 72 },
  },
  {
    id: "quartal-4note",
    name: "Quartal Stack (4 notes)",
    quality: "min7",
    intervals: [0, 5, 10, 15], // Root, P4, m7, m3+8va
    tags: { era: "Modal", style: "Quartal", artist: "McCoy Tyner", source: "Levine Ch. 11" },
    range: { min: 48, max: 72 },
  },
  {
    id: "modal-so-what",
    name: "So What Chord (3 P4ths + M3)",
    quality: "min7",
    intervals: [0, 5, 10, 15, 19], // Root, P4, m7, m3+8va, P5+8va
    tags: { era: "Modal", style: "Quartal", artist: "McCoy Tyner", source: "Levine Ch. 11" },
    range: { min: 48, max: 72 },
  },
  {
    id: "phrygian-stack",
    name: "Phrygian Stack (5 notes)",
    quality: "sus4",
    intervals: [0, 5, 10, 15, 20], // Root, P4, m7, m3+8va, m6+8va
    tags: { era: "Modal", style: "Quartal", artist: "Kenny Barron", source: "Levine Ch. 11" },
    range: { min: 48, max: 72 },
  },
];

// ============================================================
// CATEGORY D: UPPER STRUCTURE TRIADS (MODERN)
// Herbie Hancock, Wayne Shorter
// LH: tritone shell (3rd + b7). RH: major triad built on a
// specific scale degree, producing complex altered dominants.
// ============================================================

const upperStructures: VoicingEntry[] = [
  {
    id: "us-II",
    name: "Upper Structure II (Lydian Dominant)",
    quality: "dom7",
    intervals: [4, 10, 14, 18, 21], // LH: M3, m7 | RH: M9, #11, M13
    tags: { era: "Modern", style: "Upper Structure", artist: "Herbie Hancock", source: "Levine Ch. 14" },
    range: { min: 48, max: 72 },
  },
  {
    id: "us-bVI",
    name: "Upper Structure bVI (Altered)",
    quality: "alt",
    intervals: [4, 10, 20, 24, 27], // LH: M3, m7 | RH: b13, Root+8va, #9+8va (Ab, C, Eb over C7)
    tags: { era: "Modern", style: "Upper Structure", artist: "Herbie Hancock", source: "Levine Ch. 14" },
    range: { min: 48, max: 72 },
  },
  {
    id: "us-bV",
    name: "Upper Structure bV (Altered #2)",
    quality: "alt",
    intervals: [4, 10, 18, 22, 25], // LH: M3, m7 | RH: #11, b7+8va, b9+8va (Gb, Bb, Db over C7)
    tags: { era: "Modern", style: "Upper Structure", artist: "Herbie Hancock", source: "Levine Ch. 14" },
    range: { min: 48, max: 72 },
  },
  {
    id: "us-VI",
    name: "Upper Structure VI (Diminished Sound)",
    quality: "dom7",
    intervals: [4, 10, 21, 25, 28], // LH: M3, m7 | RH: M13, b9+8va, M3+2oct (A, C#, E over C7)
    tags: { era: "Modern", style: "Upper Structure", artist: "Herbie Hancock", source: "Levine Ch. 14" },
    range: { min: 48, max: 72 },
  },
];

// ============================================================
// CATEGORY E: DROP 2 VOICINGS (HARD BOP / BLOCK CHORDS)
// George Shearing, Barry Harris, Red Garland
// 4-way close voicing with 2nd-from-top dropped an octave
// ============================================================

const drop2: VoicingEntry[] = [
  {
    id: "drop2-maj6",
    name: "Drop 2 Maj6 (5th in bass)",
    quality: "maj6",
    intervals: [-5, 0, 4, 9], // P5 below, Root, M3, M6
    tags: { era: "Hard Bop", style: "Drop 2", artist: "Barry Harris", source: "Levine Ch. 10" },
    range: { min: 48, max: 72 },
  },
  {
    id: "drop2-maj6-inv2",
    name: "Drop 2 Maj6 (6th in bass)",
    quality: "maj6",
    intervals: [-3, 4, 7, 12], // M6 below, M3, P5, Root+8va
    tags: { era: "Hard Bop", style: "Drop 2", artist: "Barry Harris", source: "Levine Ch. 10" },
    range: { min: 48, max: 72 },
  },
  {
    id: "drop2-min7",
    name: "Drop 2 m7 (5th in bass)",
    quality: "min7",
    intervals: [-5, 0, 3, 10], // P5 below, Root, m3, m7
    tags: { era: "Hard Bop", style: "Drop 2", artist: "Bill Evans", source: "Levine Ch. 10" },
    range: { min: 48, max: 72 },
  },
  {
    id: "drop2-dom7",
    name: "Drop 2 Dom7 (5th in bass)",
    quality: "dom7",
    intervals: [-5, 0, 4, 10], // P5 below, Root, M3, m7
    tags: { era: "Hard Bop", style: "Drop 2", source: "Levine Ch. 10" },
    range: { min: 48, max: 72 },
  },
  {
    id: "drop2-m7b5",
    name: "Drop 2 m7b5 (b5 in bass)",
    quality: "m7b5",
    intervals: [-6, 0, 3, 10], // dim5 below, Root, m3, m7
    tags: { era: "Hard Bop", style: "Drop 2", source: "Levine Ch. 10" },
    range: { min: 48, max: 72 },
  },
];

// ============================================================
// FULL LIBRARY
// ============================================================

export const VOICING_LIBRARY: VoicingEntry[] = [
  ...shells,
  ...rootless,
  ...quartal,
  ...upperStructures,
  ...drop2,
];
