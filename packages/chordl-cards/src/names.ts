/**
 * Chord title text: the abbreviated quality the card sets beside the root, and
 * the spelled-out name under it. Both come from the chord catalogue
 * (./catalogue.ts), the single source the cards, the player and the site share.
 *
 * An unrecognised quality prints itself, rather than throwing: this module only
 * formats; ./faces.ts is what refuses to render a chord it cannot draw. The
 * catalogue's lookups are Maps, so a quality such as "toString" can never pick
 * up a function off Object.prototype.
 */
import { parseChordSymbol } from "./catalogue";

export function rootOf(chord: string): string {
  const m = chord.trim().match(/^([A-G])([#b]?)/);
  return m ? m[1] + (m[2] ?? "") : "C";
}

function rest(chord: string): string {
  const m = chord.trim().match(/^[A-G][#b]?(.*)$/);
  return (m?.[1] ?? "").trim();
}

/**
 * "Bm" -> "min", "C7(b9/#5)" -> "7b9#5". A slash chord's title is printed as
 * written after the root ("C/E" -> "/E", "D7/C" -> "7/C"), as cards always have.
 */
export function qualityLabelFor(chord: string): string {
  const p = parseChordSymbol(chord);
  if (!p || p.bass) return rest(chord);
  return p.type.label;
}

const ACCIDENTAL_NAMES = new Map<string, string>([["#", " sharp"], ["b", " flat"]]);

function rootWords(root: string): string {
  return root[0].toLowerCase() + (ACCIDENTAL_NAMES.get(root.slice(1)) ?? "");
}

/** "F#m7" -> "f sharp minor seventh": the chord's name, accidentals spelled out, all lower case. */
export function fullChordName(chord: string): string {
  const p = parseChordSymbol(chord);
  if (!p) {
    const m = chord.trim().match(/^([A-G][#b]?)/);
    return `${rootWords(m?.[1] ?? "C")} ${rest(chord)}`;
  }
  const name = `${rootWords(p.root)} ${p.type.fullName}`;
  return p.bass ? `${name} over ${rootWords(p.bass)}` : name;
}
