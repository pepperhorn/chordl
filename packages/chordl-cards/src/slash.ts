/**
 * Slash chords: an upper chord over a bass note. For every bass root, upper
 * roots at each SLASH_INTERVALS step above it, spelled by interval; a spelling
 * outside the 15 roots (Abb over Gb) is respelled to its enharmonic inside them
 * (G). 15 basses x 12 intervals x 15 upper types = 2,700 entries.
 *
 * #4 and b5 are one pitch class. Where the 15 roots spell it only one way
 * (over Db: G and Abb -> G) the two are one chord, and one record is kept: the
 * one whose upper root needed no respelling (both did -> #4). The other's
 * spelling is listed in its `aliases` ("Abb/Db"). 2,520 distinct chords.
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
  /** The #4/b5 twin's spelling, when it collapsed onto this chord ("Abb/Db"). */
  aliases: string[];
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
  const roots = new Map<SlashInterval, { spelled: string; upper: Root }>();
  for (const interval of SLASH_INTERVALS) {
    const spelled = spellInterval(bass, interval);
    roots.set(interval, { spelled, upper: respellIntoRoots(spelled) });
  }
  // #4 and b5 collapse when they land on one root: keep the unrespelled one.
  const sharp4 = roots.get("#4")!;
  const flat5 = roots.get("b5")!;
  let dropped: SlashInterval | undefined;
  if (sharp4.upper === flat5.upper) {
    dropped = sharp4.spelled !== sharp4.upper && flat5.spelled === flat5.upper ? "#4" : "b5";
  }
  const twinOf = (kept: SlashInterval) =>
    dropped && kept !== dropped && (kept === "#4" || kept === "b5") ? roots.get(dropped)!.spelled : undefined;

  const out: SlashChord[] = [];
  for (const interval of SLASH_INTERVALS) {
    if (interval === dropped) continue;
    const { spelled: spelledRoot, upper: upperRoot } = roots.get(interval)!;
    const twin = twinOf(interval);
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
        aliases: twin ? [`${twin}${type.symbol}/${bass}`] : [],
      });
    }
  }
  return out;
}
