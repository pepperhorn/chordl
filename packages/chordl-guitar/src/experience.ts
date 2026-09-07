/**
 * How hard a shape is to play, as three rungs a learner moves through.
 *
 * Derived from the facts, never stored: a level that can be hand-edited drifts
 * from the shape it describes. `ShapeClass` in voicingSelect.ts filters on the
 * same facts; this ranks on them. They are deliberately separate — a filter
 * answers "show me the open ones", a rank answers "can I play this yet".
 */
import type { PositionFacts } from "./voicingFacts.js";

export type ExperienceLevel = "beginner" | "emerging" | "established";

/** Easiest first, so `indexOf` gives the rung number and +1 widens. */
export const EXPERIENCE_LADDER: ExperienceLevel[] = [
  "beginner",
  "emerging",
  "established",
];

/**
 * An open shape is barre-free and at the nut — nothing to hold down across
 * strings and no hand position to find. Barre-free but moved up the neck is
 * the next step. A barre is the rung most beginners stall on, so it anchors
 * the top.
 */
export function levelForFacts(facts: PositionFacts): ExperienceLevel {
  if (facts.isOpenShape) return "beginner";
  if (!facts.hasBarre) return "emerging";
  return "established";
}

/**
 * Rank a three-string shape. `PositionFacts` cannot: it assumes six strings
 * and real barres, and a top-3 shape has neither.
 *
 * The axes are the ones the generator already ranks candidates by — stretch,
 * finger count, open strings, distance from the nut. A shape a learner can
 * play without moving out of first position is the dividing line, because
 * finding a hand position is the skill that separates the first two rungs.
 */
export function levelForTop3(frets: number[], position: number): ExperienceLevel {
  const fretted = frets.filter((f) => f > 0);
  const opens = frets.filter((f) => f === 0).length;
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  const highest = position - 1 + (fretted.length ? Math.max(...fretted) : 0);

  // Away from the nut is established regardless of how few fingers it takes:
  // the hand has to be placed before it can be shaped.
  if (position > 1 || highest > 4) return "established";
  // At the nut: open strings or at most two fingers, with no stretch.
  if (span <= 1 && (opens > 0 || fretted.length <= 2)) return "beginner";
  return "emerging";
}
