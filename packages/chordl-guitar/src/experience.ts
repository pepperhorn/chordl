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
