/**
 * Chord title text: the abbreviated quality the card sets beside the root, and
 * the spelled-out name under it. Moved verbatim from chordcards' src/cli.ts so
 * the printed card and the web page title a chord the same way.
 */


// NOTE: every quality this deck can print must resolve here AND have a
// matching entry in ./faces.ts's INTERVALS/SUFFIX tables — this file
// only formats the label, faces.ts is what actually renders the shape.
// A quality listed here but missing there parses and resolves fine, then
// throws at render time; keep the two tables in sync by hand.
//
// A Map, not an object literal, for the same reason INTERVALS is one: the key
// is whatever text followed the chord's root, so an object literal answers
// `QUALITY_LABELS["toString"]` with a FUNCTION off Object.prototype, and
// `qualityLabelFor` would hand that function to chordcards' src/card.ts escapeXml
// instead of a label. A Map inherits nothing, so an unrecognised quality
// always falls through to the `?? q` below and prints itself.
//
// The headline is the common abbreviated spelling, one abbreviation per word:
// "maj"/"min" beside "maj7"/"min7"/"min6". The spelled-out name is set under
// the title from `fullChordName`.
const QUALITY_LABELS = new Map<string, string>([
  ["", "maj"], ["m", "min"], ["min", "min"], ["maj", "maj"],
  ["maj7", "maj7"], ["m7", "min7"], ["min7", "min7"], ["7", "7"],
  ["6", "6"], ["m6", "min6"], ["min6", "min6"],
  ["dim", "dim"], ["aug", "aug"], ["sus2", "sus2"], ["sus4", "sus4"], ["add9", "add9"],
]);

export function rootOf(chord: string): string {
  const m = chord.trim().match(/^([A-G])([#b]?)/);
  return m ? m[1] + (m[2] ?? "") : "C";
}

export function qualityLabelFor(chord: string): string {
  const m = chord.trim().match(/^[A-G][#b]?(.*)$/);
  const q = (m?.[1] ?? "").trim();
  return QUALITY_LABELS.get(q) ?? q;
}

// The spelled-out quality set small under the title. A Map for the same
// prototype-safety reason as QUALITY_LABELS: an unknown quality prints itself.
const QUALITY_NAMES = new Map<string, string>([
  ["", "major"], ["maj", "major"], ["m", "minor"], ["min", "minor"],
  ["6", "major sixth"], ["m6", "minor sixth"], ["min6", "minor sixth"],
  ["7", "dominant seventh"], ["maj7", "major seventh"],
  ["m7", "minor seventh"], ["min7", "minor seventh"],
  ["aug", "augmented"], ["dim", "diminished"],
  ["sus4", "suspended fourth"], ["sus2", "suspended second"], ["add9", "added ninth"],
]);

const ACCIDENTAL_NAMES = new Map<string, string>([["#", " sharp"], ["b", " flat"]]);

/** "F#m7" -> "f sharp minor seventh": the chord's name, accidentals spelled out, all lower case. */
export function fullChordName(chord: string): string {
  const m = chord.trim().match(/^([A-G])([#b]?)(.*)$/);
  const letter = m?.[1] ?? "C";
  const accidental = ACCIDENTAL_NAMES.get(m?.[2] ?? "") ?? "";
  const q = (m?.[3] ?? "").trim();
  return `${letter.toLowerCase()}${accidental} ${QUALITY_NAMES.get(q) ?? q}`;
}
