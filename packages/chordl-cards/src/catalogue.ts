/**
 * The chord catalogue: every chord type on PepperHorn's "Common Chord Spellings"
 * sheet (85 types), plus the library's diminished triad, which the sheet omits.
 * This is the single source of truth that chordcards, the chords site, the
 * derive-slug flow and the Directus import read. See
 * chordcards/docs/superpowers/specs/2026-10-22-full-chord-catalogue-design.md.
 *
 * `cSpelling` is the sheet's own spelling of the C chord (catalogue/
 * sheet-transcription.json), apart from the two bars in SHEET_ERRATA. Its
 * intervals are chosen so `spellChord("C", type)` reproduces it exactly. That is
 * why the diminished seventh is 1 b3 b5 6: the sheet writes C° as C Eb Gb A,
 * not C Eb Gb Bbb.
 */

/** The 15 library roots. No D# or A#. */
export const ROOTS = [
  "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "Bb", "B",
] as const;
export type Root = (typeof ROOTS)[number];

export type CatalogueFace = "keyboard" | "guitar" | "keyboard-hands" | "guitar-top3";

export interface ChordType {
  /** Stable id: the slug modifiers joined with "-", or "maj" for the major triad. */
  id: string;
  /** Canonical ASCII symbol after the root: "", "m7(b5)", "7(b9,#5)". */
  symbol: string;
  /** For the web: ♭ ♯ ° ø +. */
  displaySymbol: string;
  /** Other symbols for the same chord: the sheet's "or" forms, the sheet's own
   * print form, Directus chord_name forms ("m7b5", "mMaj7", "7#5"). */
  aliases: string[];
  /** From the root, in the sheet's low-to-high order: ["1", "3", "#5", "b7", "b9"]. */
  intervals: string[];
  /** The C chord, as the sheet spells it. */
  cSpelling: string[];
  /** Abbreviated quality for the card title, ASCII (Poppins has no ♭/♯). */
  label: string;
  /** Lower-case words: "dominant seventh flat nine sharp five". */
  fullName: string;
  /** Slug segments after the root: ["7", "flat9", "sharp5"]. */
  slugModifiers: string[];
  /** The quality suffix chordl-cards' faces and Directus already use for this
   * chord ("m7b5", "mMaj7"), where one exists. */
  quality?: string;
  /** Which bar of the sheet, and the symbol as printed there. */
  sheet?: { bar: number; symbol: string };
  faces: Record<CatalogueFace, boolean>;
  /** Ids of the types with the same intervals under another convention
   * (ø7 <-> m7(b5)), for "also known as" on a page. */
  alsoKnownAs: string[];
  /** A note for learners where the spelling is a deliberate simplification. */
  teachingNote?: string;
}

/** Bars where the engraving is taken to be wrong; the catalogue corrects them. */
export const SHEET_ERRATA: ReadonlyArray<{
  bar: number; printed: string[]; corrected: string[]; why: string;
}> = [
  {
    bar: 55, printed: ["C", "D", "F"], corrected: ["C", "F", "G"],
    why: "C(sus4) is engraved C D F (no G); a suspended fourth is C F G.",
  },
  {
    bar: 62, printed: ["C", "Eb", "A"], corrected: ["C", "Eb", "G", "A"],
    why: "Cm6 is engraved without its 5th, though C6 keeps it; the library's m6 is 1 b3 5 6.",
  },
];

// The library's own quality suffixes, by which chordl-cards' faces render.
// keyboard-hands: hands.ts QUALITIES. guitar-top3: faces.ts SUFFIX.
const HANDS_QUALITIES = new Set([
  "", "m", "dim", "aug", "sus2", "sus4", "6", "m6", "7", "maj7", "m7",
  "m7b5", "dim7", "mMaj7", "7#5", "maj7#5",
]);
const TOP3_QUALITIES = new Set(["", "m", "7", "m7", "maj7"]);

// [bar, symbol, sheet print (ASCII, stacked alterations joined with "/"),
//  extra aliases, intervals, label, full name, slug modifiers, library quality]
type Row = [
  number | null, string, string | null, string[], string, string, string, string, string?,
];

const ROWS: Row[] = [
  [1, "", "", ["maj", "M", "major"], "1 3 5", "maj", "major", "", ""],
  [2, "aug", "+", ["+"], "1 3 #5", "aug", "augmented", "aug", "aug"],
  [3, "dim7", "°", ["°", "o", "°7", "o7"], "1 b3 b5 6", "dim7", "diminished seventh", "dim7", "dim7"],
  [4, "6", "6", ["maj6"], "1 3 5 6", "6", "major sixth", "6", "6"],
  [5, "h7", "ø7", ["ø", "h", "ø7"], "1 b3 b5 b7", "half-dim7", "half-diminished seventh", "half-dim7"],
  [6, "7", "7", ["dom7"], "1 3 5 b7", "7", "dominant seventh", "7", "7"],
  [7, "7(omit3)", "7(omit3)", ["7omit3", "7(no3)", "7no3"], "1 5 b7", "7omit3", "dominant seventh omit three", "7 omit3"],
  [8, "7(b5)", "7(b5)", ["7b5"], "1 3 b5 b7", "7b5", "dominant seventh flat five", "7 flat5"],
  [9, "7(#5)", "7(#5)", ["7#5", "7+", "aug7", "+7"], "1 3 #5 b7", "7#5", "dominant seventh sharp five", "7 sharp5", "7#5"],
  [10, "add9", "(add9)", ["(add9)"], "1 3 5 9", "add9", "added ninth", "add9", "add9"],
  [11, "6/9", "6/9", ["69", "6add9", "6(add9)"], "1 3 5 6 9", "6/9", "six nine", "6 9"],
  [12, "9", "9", ["dom9"], "1 3 5 b7 9", "9", "dominant ninth", "9"],
  [13, "9(b5)", "9(b5)", ["9b5"], "1 3 b5 b7 9", "9b5", "dominant ninth flat five", "9 flat5"],
  [14, "9(#5)", "9(#5)", ["9#5"], "1 3 #5 b7 9", "9#5", "dominant ninth sharp five", "9 sharp5"],
  [15, "7(b9)", "7(b9)", ["7b9"], "1 3 5 b7 b9", "7b9", "dominant seventh flat nine", "7 flat9"],
  [16, "7(b9,b5)", "7(b9/b5)", ["7b9b5"], "1 3 b5 b7 b9", "7b9b5", "dominant seventh flat nine flat five", "7 flat9 flat5"],
  [17, "7(b9,#5)", "7(b9/#5)", ["7b9#5"], "1 3 #5 b7 b9", "7b9#5", "dominant seventh flat nine sharp five", "7 flat9 sharp5"],
  [18, "7(#9)", "7(#9)", ["7#9"], "1 3 5 b7 #9", "7#9", "dominant seventh sharp nine", "7 sharp9"],
  [19, "7(#9,b5)", "7(#9/b5)", ["7#9b5"], "1 3 b5 b7 #9", "7#9b5", "dominant seventh sharp nine flat five", "7 sharp9 flat5"],
  [20, "7(#9,#5)", "7(#9/#5)", ["7#9#5"], "1 3 #5 b7 #9", "7#9#5", "dominant seventh sharp nine sharp five", "7 sharp9 sharp5"],
  [21, "9(#11)", "9(#11)", ["9#11"], "1 3 5 b7 9 #11", "9#11", "dominant ninth sharp eleven", "9 sharp11"],
  [22, "9(#11,#5)", "9(#11/#5)", ["9#11#5"], "1 3 #5 b7 9 #11", "9#11#5", "dominant ninth sharp eleven sharp five", "9 sharp11 sharp5"],
  [23, "7(#11,b9)", "7(#11/b9)", ["7#11b9"], "1 3 5 b7 b9 #11", "7#11b9", "dominant seventh sharp eleven flat nine", "7 sharp11 flat9"],
  [24, "7(#11,b9,#5)", "7(#11/b9/#5)", ["7#11b9#5"], "1 3 #5 b7 b9 #11", "7#11b9#5", "dominant seventh sharp eleven flat nine sharp five", "7 sharp11 flat9 sharp5"],
  [25, "7(#11,#9)", "7(#11/#9)", ["7#11#9"], "1 3 5 b7 #9 #11", "7#11#9", "dominant seventh sharp eleven sharp nine", "7 sharp11 sharp9"],
  [26, "7(#11,#9,#5)", "7(#11/#9/#5)", ["7#11#9#5"], "1 3 #5 b7 #9 #11", "7#11#9#5", "dominant seventh sharp eleven sharp nine sharp five", "7 sharp11 sharp9 sharp5"],
  [27, "13", "13", ["dom13"], "1 3 5 b7 9 13", "13", "dominant thirteenth", "13"],
  [28, "13(b5)", "13(b5)", ["13b5"], "1 3 b5 b7 9 13", "13b5", "dominant thirteenth flat five", "13 flat5"],
  [29, "13(#5)", "13(#5)", ["13#5"], "1 3 #5 b7 9 13", "13#5", "dominant thirteenth sharp five", "13 sharp5"],
  [30, "13(b9)", "13(b9)", ["13b9"], "1 3 5 b7 b9 13", "13b9", "dominant thirteenth flat nine", "13 flat9"],
  [31, "13(b9,b5)", "13(b9/b5)", ["13b9b5"], "1 3 b5 b7 b9 13", "13b9b5", "dominant thirteenth flat nine flat five", "13 flat9 flat5"],
  [32, "13(b9,#5)", "13(b9/#5)", ["13b9#5"], "1 3 #5 b7 b9 13", "13b9#5", "dominant thirteenth flat nine sharp five", "13 flat9 sharp5"],
  [33, "13(#9)", "13(#9)", ["13#9"], "1 3 5 b7 #9 13", "13#9", "dominant thirteenth sharp nine", "13 sharp9"],
  [34, "13(#9,b5)", "13(#9/b5)", ["13#9b5"], "1 3 b5 b7 #9 13", "13#9b5", "dominant thirteenth sharp nine flat five", "13 sharp9 flat5"],
  [35, "13(#9,#5)", "13(#9/#5)", ["13#9#5"], "1 3 #5 b7 #9 13", "13#9#5", "dominant thirteenth sharp nine sharp five", "13 sharp9 sharp5"],
  [36, "13(#11)", "13(#11)", ["13#11"], "1 3 5 b7 9 #11 13", "13#11", "dominant thirteenth sharp eleven", "13 sharp11"],
  [37, "13(#11,#5)", "13(#11/#5)", ["13#11#5"], "1 3 #5 b7 9 #11 13", "13#11#5", "dominant thirteenth sharp eleven sharp five", "13 sharp11 sharp5"],
  [38, "13(#11,b9)", "13(#11/b9)", ["13#11b9"], "1 3 5 b7 b9 #11 13", "13#11b9", "dominant thirteenth sharp eleven flat nine", "13 sharp11 flat9"],
  [39, "13(#11,#9)", "13(#11/#9)", ["13#11#9"], "1 3 5 b7 #9 #11 13", "13#11#9", "dominant thirteenth sharp eleven sharp nine", "13 sharp11 sharp9"],
  [40, "maj7", "maj7", ["M7", "Δ7", "Δ", "ma7"], "1 3 5 7", "maj7", "major seventh", "maj7", "maj7"],
  [41, "maj7(b5)", "maj7(b5)", ["maj7b5"], "1 3 b5 7", "maj7b5", "major seventh flat five", "maj7 flat5"],
  [42, "maj7(#5)", "maj7(#5)", ["maj7#5", "+maj7", "augmaj7"], "1 3 #5 7", "maj7#5", "major seventh sharp five", "maj7 sharp5", "maj7#5"],
  [43, "maj9", "maj9", ["M9", "Δ9"], "1 3 5 7 9", "maj9", "major ninth", "maj9"],
  [44, "maj9(b5)", "maj9(b5)", ["maj9b5"], "1 3 b5 7 9", "maj9b5", "major ninth flat five", "maj9 flat5"],
  [45, "maj9(#5)", "maj9(#5)", ["maj9#5"], "1 3 #5 7 9", "maj9#5", "major ninth sharp five", "maj9 sharp5"],
  [46, "maj7(b9)", "maj7(b9)", ["maj7b9"], "1 3 5 7 b9", "maj7b9", "major seventh flat nine", "maj7 flat9"],
  [47, "maj7(#9)", "maj7(#9)", ["maj7#9"], "1 3 5 7 #9", "maj7#9", "major seventh sharp nine", "maj7 sharp9"],
  [48, "maj9(#11)", "maj9(#11)", ["maj9#11"], "1 3 5 7 9 #11", "maj9#11", "major ninth sharp eleven", "maj9 sharp11"],
  [49, "maj9(#11,#5)", "maj9(#11/#5)", ["maj9#11#5"], "1 3 #5 7 9 #11", "maj9#11#5", "major ninth sharp eleven sharp five", "maj9 sharp11 sharp5"],
  [50, "maj13", "maj13", ["M13", "Δ13"], "1 3 5 7 9 11 13", "maj13", "major thirteenth", "maj13"],
  [51, "maj13(#5)", "maj13(#5)", ["maj13#5"], "1 3 #5 7 9 11 13", "maj13#5", "major thirteenth sharp five", "maj13 sharp5"],
  [52, "maj13(#11)", "maj13(#11)", ["maj13#11"], "1 3 5 7 9 #11 13", "maj13#11", "major thirteenth sharp eleven", "maj13 sharp11"],
  [53, "maj13(#11,#5)", "maj13(#11/#5)", ["maj13#11#5"], "1 3 #5 7 9 #11 13", "maj13#11#5", "major thirteenth sharp eleven sharp five", "maj13 sharp11 sharp5"],
  [54, "sus2", "(sus2)", ["(sus2)", "add2", "(add2)"], "1 2 5", "sus2", "suspended second", "sus2", "sus2"],
  [55, "sus4", "(sus4)", ["(sus4)", "sus", "(sus)"], "1 4 5", "sus4", "suspended fourth", "sus4", "sus4"],
  [56, "5", "5", ["(omit3)", "omit3", "(no3)", "no3"], "1 5", "5", "power chord", "5"],
  [57, "7sus4", "7(sus)", ["7(sus)", "7sus", "7(sus4)"], "1 4 5 b7", "7sus4", "dominant seventh suspended fourth", "7 sus4"],
  [58, "9sus4", "9(sus)", ["9(sus)", "9sus", "9(sus4)"], "1 4 5 b7 9", "9sus4", "dominant ninth suspended fourth", "9 sus4"],
  [59, "13sus4", "13(sus)", ["13(sus)", "13sus", "13(sus4)"], "1 4 5 b7 9 13", "13sus4", "dominant thirteenth suspended fourth", "13 sus4"],
  [60, "m", "m", ["min", "minor", "-"], "1 b3 5", "min", "minor", "m", "m"],
  [61, "m(#5)", "m+", ["m+", "m#5", "min#5"], "1 b3 #5", "min#5", "minor sharp five", "m sharp5"],
  [62, "m6", "m6", ["min6", "-6"], "1 b3 5 6", "min6", "minor sixth", "m6", "m6"],
  [63, "m7", "m7", ["min7", "-7"], "1 b3 5 b7", "min7", "minor seventh", "m7", "m7"],
  [64, "m7(b5)", "m7(b5)", ["m7b5", "min7b5", "-7b5"], "1 b3 b5 b7", "m7b5", "minor seventh flat five", "m7 flat5", "m7b5"],
  [65, "m7(#5)", "m7(#5)", ["m7#5", "min7#5"], "1 b3 #5 b7", "min7#5", "minor seventh sharp five", "m7 sharp5"],
  [66, "m(add9)", "m(add9)", ["madd9", "minadd9"], "1 b3 5 9", "minAdd9", "minor added ninth", "m add9"],
  [67, "m6/9", "m6/9", ["m69", "m6add9", "min6/9"], "1 b3 5 6 9", "min6/9", "minor six nine", "m6 9"],
  [68, "m9", "m9", ["min9", "-9"], "1 b3 5 b7 9", "min9", "minor ninth", "m9"],
  [69, "m9(b5)", "m9(b5)", ["m9b5"], "1 b3 b5 b7 9", "min9b5", "minor ninth flat five", "m9 flat5"],
  [70, "m9(#5)", "m9(#5)", ["m9#5"], "1 b3 #5 b7 9", "min9#5", "minor ninth sharp five", "m9 sharp5"],
  [71, "m7(b9)", "m7(b9)", ["m7b9"], "1 b3 5 b7 b9", "min7b9", "minor seventh flat nine", "m7 flat9"],
  [72, "m7(add11)", "m7(add11)", ["m7add11"], "1 b3 5 b7 11", "min7add11", "minor seventh added eleventh", "m7 add11"],
  [73, "m11", "m11", ["min11", "-11"], "1 b3 5 b7 9 11", "min11", "minor eleventh", "m11"],
  [74, "m11(b5)", "m11(b5)", ["m11b5"], "1 b3 b5 b7 9 11", "min11b5", "minor eleventh flat five", "m11 flat5"],
  [75, "m9(#11)", "m9(#11)", ["m9#11"], "1 b3 5 b7 9 #11", "min9#11", "minor ninth sharp eleven", "m9 sharp11"],
  [76, "m13", "m13", ["min13", "-13"], "1 b3 5 b7 9 11 13", "min13", "minor thirteenth", "m13"],
  [77, "m13(b5)", "m13(b5)", ["m13b5"], "1 b3 b5 b7 9 11 13", "min13b5", "minor thirteenth flat five", "m13 flat5"],
  [78, "m13(#5)", "m13(#5)", ["m13#5"], "1 b3 #5 b7 9 11 13", "min13#5", "minor thirteenth sharp five", "m13 sharp5"],
  [79, "m(maj7)", "m(maj7)", ["mMaj7", "mmaj7", "mM7", "minMaj7", "m(M7)"], "1 b3 5 7", "minMaj7", "minor major seventh", "m maj7", "mMaj7"],
  [80, "m(maj7b5)", "m(maj7b5)", ["mMaj7b5", "m(maj7,b5)"], "1 b3 b5 7", "minMaj7b5", "minor major seventh flat five", "m maj7 flat5"],
  [81, "m(maj7#5)", "m(maj7#5)", ["mMaj7#5", "m(maj7,#5)"], "1 b3 #5 7", "minMaj7#5", "minor major seventh sharp five", "m maj7 sharp5"],
  [82, "m(maj9)", "m(maj9)", ["mMaj9", "mmaj9", "minMaj9"], "1 b3 5 7 9", "minMaj9", "minor major ninth", "m maj9"],
  [83, "m(maj9b5)", "m(maj9b5)", ["mMaj9b5", "m(maj9,b5)"], "1 b3 b5 7 9", "minMaj9b5", "minor major ninth flat five", "m maj9 flat5"],
  [84, "m(maj9#5)", "m(maj9#5)", ["mMaj9#5", "m(maj9,#5)"], "1 b3 #5 7 9", "minMaj9#5", "minor major ninth sharp five", "m maj9 sharp5"],
  // As engraved: the minor third stays beside the 4th, and there is no 5th.
  [85, "m7sus4", "m7(sus)", ["m7(sus)", "m7sus", "m7(sus4)", "min7sus4"], "1 b3 4 b7", "min7sus4", "minor seventh suspended fourth", "m7 sus4"],
  // Not on the sheet: the library's diminished triad.
  [null, "dim", null, ["(dim)", "mb5", "m(b5)"], "1 b3 b5", "dim", "diminished", "dim", "dim"],
];

const TEACHING_NOTES = new Map([
  ["dim7",
    "The top note is the diminished seventh. Written strictly it is a double flat " +
    "(on C, B𝄫, B double-flat). That is the same key as the major sixth, so we " +
    "write the simpler name (on C, A)."],
]);

const DISPLAY_OVERRIDES = new Map([
  ["aug", "+"], ["dim7", "°7"], ["h7", "ø7"], ["m(#5)", "m+"],
]);

/** ♭/♯ for the web; "b" only where it is an accidental (before a digit). */
function displayOf(symbol: string): string {
  return DISPLAY_OVERRIDES.get(symbol)
    ?? symbol.replace(/b(?=\d)/g, "♭").replace(/#/g, "♯");
}

const ACCIDENTAL_SEMITONES = new Map([["bb", -2], ["b", -1], ["", 0], ["#", 1], ["##", 2]]);
/** Semitones above the root of each natural degree (major/perfect). */
const DEGREE_SEMITONES = new Map([
  [1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 9], [7, 11],
  [9, 14], [11, 17], [13, 21],
]);

function parseInterval(iv: string): { degree: number; semitones: number } {
  const m = /^(bb|b|##|#)?(\d+)$/.exec(iv);
  const degree = m ? Number(m[2]) : NaN;
  const base = DEGREE_SEMITONES.get(degree);
  if (!m || base === undefined) throw new Error(`bad interval "${iv}"`);
  return { degree, semitones: base + ACCIDENTAL_SEMITONES.get(m[1] ?? "")! };
}

function build(row: Row): ChordType {
  const [bar, symbol, sheetPrint, extra, intervals, label, fullName, slug, quality] = row;
  const slugModifiers = slug ? slug.split(" ") : [];
  const ivs = intervals.split(" ");
  ivs.forEach(parseInterval);
  const aliases = [...new Set([...extra, ...(sheetPrint !== null ? [sheetPrint] : [])])]
    .filter((a) => a !== symbol);
  const faces = {
    keyboard: true,
    guitar: true,
    "keyboard-hands": quality !== undefined && HANDS_QUALITIES.has(quality),
    "guitar-top3": quality !== undefined && TOP3_QUALITIES.has(quality),
  };
  const type: ChordType = {
    id: slugModifiers.length ? slugModifiers.join("-") : "maj",
    symbol,
    displaySymbol: displayOf(symbol),
    aliases,
    intervals: ivs,
    cSpelling: [],
    label,
    fullName,
    slugModifiers,
    ...(quality !== undefined ? { quality } : {}),
    ...(bar !== null ? { sheet: { bar, symbol: `C${sheetPrint}` } } : {}),
    faces,
    alsoKnownAs: [],
    ...(TEACHING_NOTES.has(symbol) ? { teachingNote: TEACHING_NOTES.get(symbol)! } : {}),
  };
  type.cSpelling = spellIntervals("C", ivs);
  return type;
}

// ── Spelling ────────────────────────────────────────────────────────────────

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const ACCIDENTAL_FOR = new Map([[-2, "bb"], [-1, "b"], [0, ""], [1, "#"], [2, "##"]]);

/** Letter index and pitch class of a note name ("Eb", "F##"); undefined if not one. */
export function noteParts(name: string): { letter: number; pc: number; accidental: number } | undefined {
  const m = /^([A-G])(bb|b|##|#)?$/.exec(name);
  if (!m) return undefined;
  const letter = LETTERS.indexOf(m[1]);
  const accidental = ACCIDENTAL_SEMITONES.get(m[2] ?? "")!;
  return { letter, pc: (LETTER_PC[letter] + accidental + 12) % 12, accidental };
}

/** One interval above a root, letters stepwise, accidental from the interval. */
export function spellInterval(root: string, interval: string): string {
  const r = noteParts(root);
  if (!r) throw new Error(`unknown root "${root}"`);
  const { degree, semitones } = parseInterval(interval);
  const letter = (r.letter + degree - 1) % 7;
  const target = (r.pc + semitones) % 12;
  let diff = (target - LETTER_PC[letter] + 12) % 12;
  if (diff > 6) diff -= 12;
  const acc = ACCIDENTAL_FOR.get(diff);
  if (acc === undefined) {
    throw new Error(`"${interval}" above "${root}" needs more than a double accidental`);
  }
  return LETTERS[letter] + acc;
}

function spellIntervals(root: string, intervals: readonly string[]): string[] {
  return intervals.map((iv) => spellInterval(root, iv));
}

// ── The table ───────────────────────────────────────────────────────────────

export const CHORD_TYPES: readonly ChordType[] = ROWS.map(build);

const BY_ID = new Map(CHORD_TYPES.map((t) => [t.id, t]));

// Twins: the same intervals as another type (ø7 and m7(b5)).
const intervalKey = (t: ChordType) => t.intervals.map((iv) => parseInterval(iv).semitones).join(",");
for (const t of CHORD_TYPES) {
  t.alsoKnownAs.push(
    ...CHORD_TYPES.filter((o) => o !== t && intervalKey(o) === intervalKey(t)).map((o) => o.id),
  );
}

export function chordTypeById(id: string): ChordType | undefined {
  return BY_ID.get(id);
}

/**
 * The strict spelling of a chord on any root: letters stepwise, accidentals
 * from the intervals, double accidentals where the theory demands (G#aug =
 * G# B# D##). Kept for analysis and for teaching notes; what is printed or
 * shown is `spellChord`.
 */
export function spellChordStrict(root: string, type: ChordType | string): string[] {
  const t = typeof type === "string" ? chordTypeById(type) : type;
  if (!t) throw new Error(`unknown chord type "${String(type)}"`);
  if (!noteParts(root)) throw new Error(`unknown root "${root}"`);
  return spellIntervals(root, t.intervals);
}

/**
 * The enharmonic of a double-accidental note with at most one accidental:
 * the natural where there is one (G## -> A, Bbb -> A), else the single
 * accidental in the same direction (Cbb -> Bb, E## -> F#). Any other name is
 * returned as it is.
 */
export function simplifyDoubleAccidental(name: string): string {
  const n = noteParts(name);
  if (!n || Math.abs(n.accidental) < 2) return name;
  const natural = LETTER_PC.indexOf(n.pc);
  if (natural >= 0) return LETTERS[natural];
  const sign = Math.sign(n.accidental);
  const letter = LETTER_PC.indexOf((n.pc - sign + 12) % 12);
  return LETTERS[letter] + (sign > 0 ? "#" : "b");
}

/**
 * A chord's printed spelling on any root: the strict spelling with double
 * accidentals simplified (user decision, 2026-10-22: "most pop and rock
 * musicians do not understand double flat"). Single accidentals stay as the
 * theory spells them: C# is C# E# G#, Abm is Ab Cb Eb. `teachingNoteFor` says
 * what was simplified.
 */
export function spellChord(root: string, type: ChordType | string): string[] {
  return spellChordStrict(root, type).map(simplifyDoubleAccidental);
}

/**
 * The name to show for one note of a catalogue voicing. Catalogue data is strict
 * (`C:dim7` holds Bbb), so this takes a chord id and a strict pitch class and
 * applies the same house spelling as `spellChord`. A dim7's top note is shown as
 * root + major 6th, which simplifying alone gets wrong on roots whose strict note
 * has no double accidental (D:dim7 holds Cb, shown B). Pitch classes only: a name
 * with an octave could cross it (Cb4 sounds as B3).
 */
export function displayNoteName(chordId: string, pitchClass: string): string {
  const [root, quality = ""] = chordId.split(":");
  const r = noteParts(root);
  const n = noteParts(pitchClass);
  if (!r || !n) throw new Error(`unknown note in "${chordId}", "${pitchClass}"`);
  const isDim7 = quality.split("/")[0] === "dim7";
  if (isDim7 && n.pc === (r.pc + 9) % 12) return simplifyDoubleAccidental(spellInterval(root, "6"));
  return simplifyDoubleAccidental(pitchClass);
}

const DEGREE_WORDS = new Map([
  [2, "second"], [3, "third"], [4, "fourth"], [5, "fifth"], [6, "sixth"], [7, "seventh"],
  [9, "ninth"], [11, "eleventh"], [13, "thirteenth"],
]);
const accidentalGlyph = (n: string) => n.replace(/##$/, "𝄪").replace(/bb$/, "𝄫");
const accidentalWords = (n: string) =>
  `${n[0]} ${n.endsWith("##") ? "double-sharp" : "double-flat"}`;

/**
 * Why a chord's printed spelling differs from its strict one, or undefined when
 * it does not: "C#aug: the top note is strictly G𝄪 (G double-sharp); it sounds
 * as A, so we write A." A slash chord's upper chord is explained (its bass is a
 * root, never a double accidental).
 */
export function teachingNoteFor(symbol: string): string | undefined {
  const p = parseChordSymbol(symbol);
  if (!p) return undefined;
  const strict = spellChordStrict(p.root, p.type);
  const sentences: string[] = [];
  strict.forEach((note, i) => {
    const printed = simplifyDoubleAccidental(note);
    if (printed === note) return;
    const where = i === strict.length - 1
      ? "the top note"
      : `the ${DEGREE_WORDS.get(Number(/\d+/.exec(p.type.intervals[i])![0])) ?? "note"}`;
    sentences.push(
      `${where} is strictly ${accidentalGlyph(note)} (${accidentalWords(note)}); ` +
        `it sounds as ${printed}, so we write ${printed}.`,
    );
  });
  if (!sentences.length) return undefined;
  return `${symbol}: ${sentences.join(" Also, ")}`;
}

/**
 * Root-position note names for a chord symbol, from the catalogue: the one
 * spelling authority for the cards, the player and the site. Printed spelling
 * by default (double accidentals simplified); `{ strict: true }` keeps them. A
 * slash chord puts its bass first: "D7/C" -> ["C", "D", "F#", "A", "C"].
 * Throws, naming the chord, on anything the catalogue does not hold.
 */
export function chordSpelling(symbol: string, options: { strict?: boolean } = {}): string[] {
  const s = spelledChord(symbol, options);
  return s.bass ? [s.bass, ...s.pitchClasses] : s.pitchClasses;
}

/** A chord symbol spelled: { root, pitchClasses (the upper chord, root first), bass? }.
 * The printed spelling by default; `{ strict: true }` keeps double accidentals,
 * which is what chordl-guitar's `guitarPositionFor` wants (its letters decide
 * degrees). */
export function spelledChord(
  symbol: string,
  { strict = false }: { strict?: boolean } = {},
): { root: string; pitchClasses: string[]; bass?: string } {
  const p = parseChordSymbol(symbol);
  if (!p) throw new Error(`unsupported chord "${symbol}": not in the chord catalogue`);
  const pitchClasses = (strict ? spellChordStrict : spellChord)(p.root, p.type);
  return p.bass ? { root: p.root, pitchClasses, bass: p.bass } : { root: p.root, pitchClasses };
}

// ── Parsing ─────────────────────────────────────────────────────────────────

/** Spaces out, ♭/♯ to b/#, "/" inside parentheses to ",". */
function normaliseQuality(q: string): string {
  let depth = 0;
  let out = "";
  for (const ch of q.replace(/\s+/g, "").replace(/♭/g, "b").replace(/♯/g, "#")) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    out += ch === "/" && depth > 0 ? "," : ch;
  }
  return out;
}

const BY_SYMBOL = new Map<string, ChordType>();
for (const t of CHORD_TYPES) {
  for (const s of [t.symbol, t.displaySymbol, ...t.aliases]) {
    const key = normaliseQuality(s);
    const owner = BY_SYMBOL.get(key);
    if (owner && owner !== t) throw new Error(`symbol "${s}" is on ${owner.id} and ${t.id}`);
    BY_SYMBOL.set(key, t);
  }
}

export interface ParsedChord {
  root: string;
  type: ChordType;
  bass?: string;
}

const ROOT = /^([A-G])(♯|♭|#|b)?/;
const BASS = /\/\s*([A-G](?:♯|♭|#|b)?)\s*$/;
const ascii = (s: string) => s.replace(/♭/g, "b").replace(/♯/g, "#");

/**
 * "C7(♭9/♯5)", "Abm7b5", "C dim", "CmMaj7", "B♭/C" -> { root, type, bass? }.
 * Accepts canonical symbols, display symbols, the sheet's print forms and the
 * aliases. "°" is the sheet's: the diminished seventh. Undefined if unknown.
 */
export function parseChordSymbol(symbol: string): ParsedChord | undefined {
  let s = symbol.trim();
  let bass: string | undefined;
  const b = BASS.exec(s);
  if (b && depthAt(s, b.index) === 0) {
    bass = ascii(b[1]);
    s = s.slice(0, b.index);
  }
  const r = ROOT.exec(s);
  if (!r) return undefined;
  // Longest root first; fall back to the bare letter ("Cb5" is not on offer,
  // but a quality beginning with "b" would be).
  const candidates = r[2] ? [r[1] + ascii(r[2]), r[1]] : [r[1]];
  for (const root of candidates) {
    const rest = s.slice(root.length === 1 ? 1 : r[0].length);
    const type = BY_SYMBOL.get(normaliseQuality(rest));
    if (type) return bass ? { root, type, bass } : { root, type };
  }
  return undefined;
}

function depthAt(s: string, index: number): number {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (s[i] === "(") depth++;
    if (s[i] === ")") depth--;
  }
  return depth;
}
