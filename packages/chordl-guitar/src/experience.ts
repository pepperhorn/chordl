/**
 * How hard a shape is to play, as three rungs a learner moves through.
 *
 * Derived from the facts, never stored: a level that can be hand-edited drifts
 * from the shape it describes. `ShapeClass` in voicingSelect.ts filters on the
 * same facts; this ranks on them. They are deliberately separate — a filter
 * answers "show me the open ones", a rank answers "can I play this yet".
 */
import type { ChordsDbPosition } from "./instruments.js";
import type { PositionFacts } from "./voicingFacts.js";
import { positionFacts } from "./voicingFacts.js";
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
 *
 * Accepts either of two representations of the same shape, and returns the
 * same level for both:
 *
 *   - absolute frets measured from the nut, with `position` pinned at 1 —
 *     what the generated table stores (`Top3GeneratedEntry.frets`);
 *   - window-relative frets paired with the diagram's real `position` —
 *     what `staticPresets.top3Window()` produces for rendering.
 *
 * They agree because the function only ever compares
 * `position - 1 + max(fretted)` to the nut: sliding a window down by
 * `position - 1` and adding it back is the same transform run forward and
 * back, so the recovered highest fret — and therefore the level — is
 * identical either way. A caller holding a rendered preset (windowed frets
 * plus its real position) can pass those straight in rather than
 * reconstructing absolute frets by hand, which is exactly the arithmetic that
 * has produced off-diagram bugs elsewhere in this codebase.
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
  /**
   * Optional refinement within the level. Default "any".
   *
   * Published API, kept for when the level control gains a paired shape-class
   * control — deliberately not wired into any UI yet (the only level control
   * shipped so far is `dev/App.tsx`'s radio group; `GuitarChordPanel` draws
   * no control of its own). Under cumulative level matching it now genuinely
   * refines at the `emerging` and `established` rungs (it can drop shapes
   * those levels would otherwise include), so do not delete this as dead —
   * only its UI is deferred, not the mechanism.
   */
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
 * Level matching is CUMULATIVE, not exclusive: `query.level` answers "can I
 * play this yet", so a level matches every shape ranked at or below it on
 * `EXPERIENCE_LADDER` — `established` matches everything, `emerging` matches
 * beginner + emerging, `beginner` matches only beginner (there is nothing
 * below it to include). An established player can certainly play an open C;
 * excluding the open shape from an "established" query was the bug, not a
 * feature.
 *
 * Emptiness is still possible at the bottom rung: 220 of 529 chords have no
 * open shape at all and 88 have only barre shapes, so a beginner filter finds
 * nothing for nearly half the corpus. Returning an empty frame there would
 * punish exactly the learner the filter is for, so relaxation still widens
 * one rung at a time rather than giving up.
 *
 * Relaxation order is deliberate. The refinement goes first because the level
 * is what the user asked for and the shape class only narrows it; widening the
 * level changes the answer to the question they asked.
 *
 * @param levels - Optional, parallel to `facts`. When an entry is present it
 *   is used verbatim instead of `levelForFacts(facts[i])`. This is for
 *   shapes whose facts cannot support the six-string derivation — top-3
 *   presets never carry barres, so `levelForFacts` can never call one
 *   "established" even when its authoritative, stored level (`levelForTop3`)
 *   says otherwise. Shape-class matching still reads `facts[i]` either way:
 *   only the level lookup is overridable. Missing entries (a shorter array,
 *   or `undefined` at an index) fall back to the derived level. Prefer
 *   `selectForResult` when a `GuitarChordResult` (or equivalent
 *   positions+levels pair) is in hand — it threads this argument for you so a
 *   caller cannot forget it and silently reintroduce derived-only ranking.
 */
export function selectForExperience(
  facts: PositionFacts[],
  query: ExperienceQuery,
  levels?: ExperienceLevel[],
): ExperienceSelection {
  if (facts.length === 0) {
    return { indices: [], level: query.level, droppedShapeClass: false };
  }
  const cls = query.shapeClass ?? "any";
  const levelOf = (i: number): ExperienceLevel => levels?.[i] ?? levelForFacts(facts[i]);
  const rank = (level: ExperienceLevel) => EXPERIENCE_LADDER.indexOf(level);
  // Cumulative: everything ranked at or below `level` counts as a match.
  const at = (level: ExperienceLevel, withClass: boolean) =>
    facts
      .map((f, i) => i)
      .filter(
        (i) =>
          rank(levelOf(i)) <= rank(level) &&
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
  // 3. widen the level, one rung at a time, refinement already gone. This
  // loop always returns before exhausting the ladder: matching is cumulative
  // (step 2 above), so `at("established", false)` — the last rung — matches
  // every index whenever `facts` is non-empty, which the guard at the top of
  // this function guarantees. A fourth "take everything" fallback after this
  // loop used to exist for the case where even that failed; it was dead code
  // that could never run, and it lied about `level` when it did (claiming to
  // serve `query.level` while actually serving every shape). Deleted rather
  // than kept honest, because there is nothing truthful left for it to say —
  // the loop already covers the one case it was for.
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
  throw new Error(
    "selectForExperience: unreachable — cumulative matching guarantees the " +
      "widening loop returns by \"established\" whenever facts is non-empty",
  );
}

/**
 * `selectForExperience`, but for a `GuitarChordResult` (or any duck-typed
 * `{ positions, levels }` pair) instead of a bare facts array.
 *
 * `selectForExperience`'s third argument is what stops top-3 shapes being
 * mis-ranked: the six-string derivation (`levelForFacts`) is structurally
 * unable to call a top-3 shape "established" because top-3 positions never
 * carry barres, so a caller that forgets to pass `levels` silently gets a
 * shape re-ranked one or more rungs too easy. Threading it by hand is exactly
 * the kind of thing a future caller forgets, so this wrapper does it for you:
 * it derives `facts` from `result.positions` and always passes
 * `result.levels` through, leaving nowhere for the argument to get dropped.
 *
 * Prefer this whenever a full result (not just bare facts) is in hand. The
 * bare-facts form of `selectForExperience` stays published for callers that
 * only ever have `PositionFacts[]` — most tests, and anything working one
 * level below a `GuitarChordResult`.
 */
export function selectForResult(
  result: { positions: ChordsDbPosition[]; levels: ExperienceLevel[] },
  openMidi: number[],
  rootPc: number | null,
  query: ExperienceQuery,
): ExperienceSelection {
  const facts = result.positions.map((pos) => positionFacts(pos, openMidi, rootPc));
  return selectForExperience(facts, query, result.levels);
}
