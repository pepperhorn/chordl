/**
 * How hard a shape is to play, as three rungs a learner moves through.
 *
 * Derived from the facts, never stored: a level that can be hand-edited drifts
 * from the shape it describes. `ShapeClass` in voicingSelect.ts filters on the
 * same facts; this ranks on them. They are deliberately separate — a filter
 * answers "show me the open ones", a rank answers "can I play this yet".
 */
import type { PositionFacts } from "./voicingFacts.js";
import type { ShapeClass } from "./voicingSelect.js";
import { matchesShapeClass } from "./voicingSelect.js";

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

export interface ExperienceQuery {
  level: ExperienceLevel;
  /** Optional refinement within the level. Default "any". */
  shapeClass?: ShapeClass;
}

export interface ExperienceSelection {
  /** Indices into the input array, in input order. Never empty when input is non-empty. */
  indices: number[];
  /** The level actually served — differs from the request when it widened. */
  level: ExperienceLevel;
  /** True when the shape-class refinement had to be dropped to find anything. */
  droppedShapeClass: boolean;
  /** The level originally asked for, when it had to widen. Absent otherwise. */
  widenedFrom?: ExperienceLevel;
}

/**
 * Filter by level, refine by shape class, and relax rather than show nothing.
 *
 * Emptiness is the common case, not the edge: 220 of 529 chords have no open
 * shape at all and 88 have only barre shapes, so a beginner filter finds
 * nothing for nearly half the corpus. Returning an empty frame there would
 * punish exactly the learner the filter is for.
 *
 * Relaxation order is deliberate. The refinement goes first because the level
 * is what the user asked for and the shape class only narrows it; widening the
 * level changes the answer to the question they asked.
 */
export function selectForExperience(
  facts: PositionFacts[],
  query: ExperienceQuery,
): ExperienceSelection {
  if (facts.length === 0) {
    return { indices: [], level: query.level, droppedShapeClass: false };
  }
  const cls = query.shapeClass ?? "any";
  const at = (level: ExperienceLevel, withClass: boolean) =>
    facts
      .map((f, i) => i)
      .filter(
        (i) =>
          levelForFacts(facts[i]) === level &&
          (!withClass || matchesShapeClass(facts[i], cls)),
      );

  // 1. level + refinement
  const exact = at(query.level, true);
  if (exact.length > 0) {
    return { indices: exact, level: query.level, droppedShapeClass: false };
  }
  // 2. drop the refinement, same level
  const noClass = at(query.level, false);
  if (noClass.length > 0) {
    return { indices: noClass, level: query.level, droppedShapeClass: cls !== "any" };
  }
  // 3. widen the level, one rung at a time, refinement already gone
  const start = EXPERIENCE_LADDER.indexOf(query.level);
  for (let i = start + 1; i < EXPERIENCE_LADDER.length; i++) {
    const wider = at(EXPERIENCE_LADDER[i], false);
    if (wider.length > 0) {
      return {
        indices: wider,
        level: EXPERIENCE_LADDER[i],
        droppedShapeClass: cls !== "any",
        widenedFrom: query.level,
      };
    }
  }
  // 4. everything is easier than the request — take it all rather than nothing.
  return {
    indices: facts.map((_, i) => i),
    level: query.level,
    droppedShapeClass: cls !== "any",
    widenedFrom: query.level,
  };
}
