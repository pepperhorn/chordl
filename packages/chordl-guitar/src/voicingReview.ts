/** Deterministic musical/hand signals shared by ranking and review metadata. */
import type { ChordsDbPosition } from "./instruments.js";
import { INSTRUMENTS } from "./instruments.js";
import type { ChordToneAnalysis } from "./voicingGenerator.js";
export type TeachingLevel = 0 | 1 | 2 | 3;
export type ReasonCode =
  | `omits:${string}` | "rootless" | "bass-not-low" | "high-position" | "above-12"
  | "open-under-high-hand" | "low-interval" | "b9-clash" | "unison" | "doubled-tension"
  | "barre-5+" | "span-4" | "three-strings" | "finger-spacing" | "db-position-rejected";
export interface GuitarReview {
  confidence: number;
  origin: "chords-db" | `template:${string}` | "search";
  level: TeachingLevel;
  reasons: ReasonCode[];
  /** Same chord constraints, level and physical grip = one review, regardless of spelling. */
  reviewKey: string;
  needsReview: boolean;
}
export interface ReviewOptions {
  level?: TeachingLevel;
  origin?: GuitarReview["origin"];
  dbPositionRejected?: boolean;
}
export function voicingSignals(abs: number[], fingers: number[], analysis: ChordToneAnalysis) {
  const fretted = abs.filter(f => f > 0);
  const lo = fretted.length ? Math.min(...fretted) : 0;
  const hi = fretted.length ? Math.max(...fretted) : 0;
  const midi = abs.flatMap((f, i) => f < 0 ? [] : [INSTRUMENTS.guitar.openMidi[i] + f]).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const m of midi)
    counts.set(m % 12, (counts.get(m % 12) ?? 0) + 1);
  let lowIntervals = 0, lowThirds = 0, minorNinths = 0, lowMinorNinths = 0, unisons = 0;
  for (let i = 0; i < midi.length; i++)
    for (let j = i + 1; j < midi.length; j++) {
      const gap = midi[j] - midi[i];
      if (gap > 0 && gap <= 2 && midi[i] < 52)
        lowIntervals++;
      if (gap >= 3 && gap <= 4 && midi[i] < 45)
        lowThirds++;
      if (gap === 13) {
        minorNinths++;
        if (midi[i] < 48)
          lowMinorNinths++;
      }
      if (gap === 0)
        unisons++;
    }
  // Conservative reach warning: adjacent fingers far apart laterally, or a
  // fret reach beyond the finger-number gap (one extra fret above position 5).
  let fingerSpacing = 0;
  const used = [...new Set(fingers.filter(f => f > 0))].sort();
  for (const a of used)
    for (const b of used.filter(b => b > a)) {
      const sa = fingers.flatMap((f, i) => f === a ? [i] : []);
      const sb = fingers.flatMap((f, i) => f === b ? [i] : []);
      const delta = abs[sb[0]] - abs[sa[0]];
      const lateral = Math.min(...sa.flatMap(i => sb.map(j => Math.abs(i - j))));
      if (delta > b - a + (lo >= 7 || (lo >= 5 && a === 1) ? 1 : 0) || (b - a === 1 && delta === 0 && lateral >= 4))
        fingerSpacing++;
    }
  const barreStrings = used.reduce((n, f) => {
    const strings = fingers.flatMap((v, i) => v === f ? [i] : []);
    return Math.max(n, strings.length > 1 ? strings[strings.length - 1] - strings[0] + 1 : 0);
  }, 0);
  const doubledTensions = analysis.tones.filter(t => /9|11|13/.test(t.degree)).reduce((n, t) => n + Math.max(0, (counts.get(t.pc) ?? 0) - 1), 0);
  return { lo, hi, midi, counts, first: abs.findIndex(f => f >= 0), lowIntervals, lowThirds, minorNinths, lowMinorNinths, unisons, fingerSpacing, barreStrings, doubledTensions };
}
export function reviewGuitarPosition(pos: ChordsDbPosition, analysis: ChordToneAnalysis, options: ReviewOptions = {}): GuitarReview {
  const level = options.level ?? 2;
  const origin = options.origin ?? "search";
  const abs = pos.frets.map(f => f <= 0 ? f : f + pos.baseFret - 1);
  const s = voicingSignals(abs, pos.fingers, analysis);
  const omitted = analysis.tones.filter(t => t.role !== "excluded" && !s.counts.has(t.pc)).map(t => t.degree);
  const reasons: ReasonCode[] = omitted.map(d => `omits:${d}` as ReasonCode);
  if (omitted.includes("1"))
    reasons.push("rootless");
  if (s.first >= 2)
    reasons.push("bass-not-low");
  if (s.lo >= 8)
    reasons.push("high-position");
  if (s.hi > 12)
    reasons.push("above-12");
  if (s.lo >= 5 && abs.includes(0))
    reasons.push("open-under-high-hand");
  if (s.lowIntervals || s.lowThirds || s.lowMinorNinths)
    reasons.push("low-interval");
  if (s.minorNinths)
    reasons.push("b9-clash");
  if (s.unisons)
    reasons.push("unison");
  if (s.doubledTensions)
    reasons.push("doubled-tension");
  if (s.barreStrings >= 5)
    reasons.push("barre-5+");
  if (s.hi - s.lo >= 4)
    reasons.push("span-4");
  if (s.midi.length === 3)
    reasons.push("three-strings");
  if (s.fingerSpacing)
    reasons.push("finger-spacing");
  if (options.dbPositionRejected)
    reasons.push("db-position-rejected");
  // Heuristic attention score, not a probability or a teacher's approval.
  const penalty = reasons.reduce((n, r) => n + (
    r === "low-interval" || r === "finger-spacing" ? 0.16 : r === "rootless" ? 0.1 : 0.04
  ), 0);
  const confidence = Math.max(0, Math.round(((origin === "search" ? 0.88 : 0.98) - penalty) * 100) / 100);
  const tones = analysis.tones.map(t => `${t.pc}:${t.degree.startsWith("bass ") ? "bass" : t.degree}:${t.role}`).sort().join(";");
  const root = analysis.tones.find(t => t.degree === "1")!.pc;
  const reviewKey = `guitar:v1:${level}:${root}:${analysis.bassPc}:${tones}:${abs.join(",")}:${pos.fingers.join(",")}:${pos.barres.map(b => b + pos.baseFret - 1).join(",")}`;
  return { confidence, origin, level, reasons, reviewKey, needsReview: reasons.length > 0 || confidence < .8 };
}
