/**
 * Chord slugs: root-(accidental)-modifiers, lower case, hyphenated; "#" ->
 * "sharp", "b" -> "flat". Parenthesised alterations are segments in written
 * order (C7(b9/b5) -> c-7-flat9-flat5); a slash bass is "-over-<bass>"
 * (Bb/C -> b-flat-over-c). These are the URLs on chords.creativeranges.org and
 * the crf-admin `chords.slug` values.
 */
import { chordTypeById, parseChordSymbol, type ChordType } from "./catalogue";

/** "C#" -> "c-sharp", "Bb" -> "b-flat", "E" -> "e". */
export function rootSlug(root: string): string {
  const m = /^([A-G])(#|b)?$/.exec(root);
  if (!m) throw new Error(`unknown root "${root}"`);
  return m[1].toLowerCase() + (m[2] === "#" ? "-sharp" : m[2] === "b" ? "-flat" : "");
}

export interface SlugInput {
  root: string;
  /** A ChordType or its id. */
  type: ChordType | string;
  bass?: string;
}

/** The slug for a chord symbol ("Abm7b5", "B♭/C") or a { root, type, bass? }. */
export function slugFor(chord: string | SlugInput): string {
  let input: SlugInput;
  if (typeof chord === "string") {
    const parsed = parseChordSymbol(chord);
    if (!parsed) throw new Error(`unknown chord "${chord}"`);
    input = parsed;
  } else {
    input = chord;
  }
  const type = typeof input.type === "string" ? chordTypeById(input.type) : input.type;
  if (!type) throw new Error(`unknown chord type "${String(input.type)}"`);
  return [
    rootSlug(input.root),
    ...type.slugModifiers,
    ...(input.bass ? ["over", rootSlug(input.bass)] : []),
  ].join("-");
}
