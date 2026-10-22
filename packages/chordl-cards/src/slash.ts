/**
 * Slash chords: an upper chord over a bass note. For every bass root, upper
 * roots at each SLASH_INTERVALS step above it, spelled by interval; a spelling
 * outside the 15 roots (Abb over Gb) is respelled to its enharmonic inside them
 * (G). 15 basses x 12 intervals x 15 upper types = 2,700 entries.
 *
 * #4 and b5 are one pitch class. Where the 15 roots spell it only one way
 * (over Db: G and Abb -> G), both land on the same chord; the later (b5) entry
 * carries `duplicateOf: "#4"` so a consumer can skip it.
 */
import { ROOTS, chordTypeById, noteParts, spellInterval, type Root } from "./catalogue";
import { rootSlug } from "./slug";

export const SLASH_INTERVALS = [
  "b2", "2", "b3", "3", "4", "#4", "b5", "5", "b6", "6", "b7", "7",
] as const;
export type SlashInterval = (typeof SLASH_INTERVALS)[number];

/** Upper qualities, as catalogue type ids: maj, min, 6, 7, maj7, min7, min7b5,
 * add9, min6, aug, dim, sus4, dim7, mMaj7, 9. */
export const SLASH_UPPER_TYPES = [
  "maj", "m", "6", "7", "maj7", "m7", "m7-flat5", "add9", "m6", "aug", "dim",
  "sus4", "dim7", "m-maj7", "9",
] as const;

export interface SlashChord {
  /** "Db/C", "Fadd9/C": upper root + the type's canonical symbol + "/" + bass. */
  symbol: string;
  upperRoot: Root;
  /** Catalogue type id of the upper chord. */
  upperType: string;
  bass: Root;
  /** The upper root's distance above the bass. */
  interval: SlashInterval;
  /** The upper root as the interval spells it, before any respelling. */
  spelledRoot: string;
  /** True when spelledRoot is outside the 15 roots and was respelled. */
  respelled: boolean;
  /** Slug segments after the upper root: the type's modifiers, "over", the bass. */
  slugModifiers: string[];
  slug: string;
  /** Set on the b5 entry when it is the same chord as the #4 entry. */
  duplicateOf?: SlashInterval;
}

const ROOT_SET = new Set<string>(ROOTS);

/** An in-set enharmonic: the one root with that pitch class, or, of two, the
 * one whose accidental points the same way ("B##" -> "C#", "Ebb" -> "D"). */
export function respellIntoRoots(name: string): Root {
  if (ROOT_SET.has(name)) return name as Root;
  const n = noteParts(name);
  if (!n) throw new Error(`not a note name: "${name}"`);
  const same = ROOTS.filter((r) => noteParts(r)!.pc === n.pc);
  if (same.length === 1) return same[0];
  const sign = Math.sign(n.accidental);
  return same.find((r) => Math.sign(noteParts(r)!.accidental) === sign) ?? same[0];
}

export function slashChordsForBass(bassRoot: string): SlashChord[] {
  if (!ROOT_SET.has(bassRoot)) throw new Error(`bass "${bassRoot}" is not one of the 15 roots`);
  const bass = bassRoot as Root;
  const out: SlashChord[] = [];
  const byInterval = new Map<string, Root>();
  for (const interval of SLASH_INTERVALS) {
    const spelledRoot = spellInterval(bass, interval);
    const upperRoot = respellIntoRoots(spelledRoot);
    byInterval.set(interval, upperRoot);
    const duplicateOf =
      interval === "b5" && byInterval.get("#4") === upperRoot ? ("#4" as const) : undefined;
    for (const id of SLASH_UPPER_TYPES) {
      const type = chordTypeById(id)!;
      const slugModifiers = [...type.slugModifiers, "over", rootSlug(bass)];
      out.push({
        symbol: `${upperRoot}${type.symbol}/${bass}`,
        upperRoot,
        upperType: id,
        bass,
        interval,
        spelledRoot,
        respelled: spelledRoot !== upperRoot,
        slugModifiers,
        slug: [rootSlug(upperRoot), ...slugModifiers].join("-"),
        ...(duplicateOf ? { duplicateOf } : {}),
      });
    }
  }
  return out;
}
