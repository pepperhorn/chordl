/**
 * The chord catalogue from "Common Chord Spellings" (PepperHorn.org, PH 1.0),
 * as listed in chordcards' docs/superpowers/specs/2026-10-22-full-chord-catalogue-design.md.
 *
 * Test-side stand-in for the generator's unit tests and review sheet:
 * `@pepperhorn/chordl-cards` owns the machine-readable catalogue (`CHORD_TYPES`,
 * `slashChordsForBass`), and the coverage survey against it lives there
 * (chordl-cards/test/catalogue.sweep.test.ts), since this package cannot
 * depend on chordl-cards. Degrees are spelled the way the sheet spells
 * them for C, then transposed by letter so every root keeps its spelling
 * (G#aug is G# B# D##, not G# C E).
 */

export interface SheetType {
  symbol: string;
  degrees: string[];
}

export const SHEET_ROOTS = [
  "C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "Bb", "B",
];

const T = (symbol: string, d: string): SheetType => ({ symbol, degrees: d.split(" ") });

export const SHEET_TYPES: SheetType[] = [
  T("", "1 3 5"),
  T("aug", "1 3 #5"),
  T("°", "1 b3 b5 bb7"),
  T("6", "1 3 5 6"),
  T("ø7", "1 b3 b5 b7"),
  T("7", "1 3 5 b7"),
  T("7(omit3)", "1 5 b7"),
  T("7(b5)", "1 3 b5 b7"),
  T("7(#5)", "1 3 #5 b7"),
  T("add9", "1 3 5 9"),
  T("6/9", "1 3 5 6 9"),
  T("9", "1 3 5 b7 9"),
  T("9(b5)", "1 3 b5 b7 9"),
  T("9(#5)", "1 3 #5 b7 9"),
  T("7(b9)", "1 3 5 b7 b9"),
  T("7(b9,b5)", "1 3 b5 b7 b9"),
  T("7(b9,#5)", "1 3 #5 b7 b9"),
  T("7(#9)", "1 3 5 b7 #9"),
  T("7(#9,b5)", "1 3 b5 b7 #9"),
  T("7(#9,#5)", "1 3 #5 b7 #9"),
  T("9(#11)", "1 3 5 b7 9 #11"),
  T("9(#11,#5)", "1 3 #5 b7 9 #11"),
  T("7(#11,b9)", "1 3 5 b7 b9 #11"),
  T("7(#11,b9,#5)", "1 3 #5 b7 b9 #11"),
  T("7(#11,#9)", "1 3 5 b7 #9 #11"),
  T("7(#11,#9,#5)", "1 3 #5 b7 #9 #11"),
  T("13", "1 3 5 b7 9 13"),
  T("13(b5)", "1 3 b5 b7 9 13"),
  T("13(#5)", "1 3 #5 b7 9 13"),
  T("13(b9)", "1 3 5 b7 b9 13"),
  T("13(b9,b5)", "1 3 b5 b7 b9 13"),
  T("13(b9,#5)", "1 3 #5 b7 b9 13"),
  T("13(#9)", "1 3 5 b7 #9 13"),
  T("13(#9,b5)", "1 3 b5 b7 #9 13"),
  T("13(#9,#5)", "1 3 #5 b7 #9 13"),
  T("13(#11)", "1 3 5 b7 9 #11 13"),
  T("13(#11,#5)", "1 3 #5 b7 9 #11 13"),
  T("13(#11,b9)", "1 3 5 b7 b9 #11 13"),
  T("13(#11,#9)", "1 3 5 b7 #9 #11 13"),
  T("maj7", "1 3 5 7"),
  T("maj7(b5)", "1 3 b5 7"),
  T("maj7(#5)", "1 3 #5 7"),
  T("maj9", "1 3 5 7 9"),
  T("maj9(b5)", "1 3 b5 7 9"),
  T("maj9(#5)", "1 3 #5 7 9"),
  T("maj7(b9)", "1 3 5 7 b9"),
  T("maj7(#9)", "1 3 5 7 #9"),
  T("maj9(#11)", "1 3 5 7 9 #11"),
  T("maj9(#11,#5)", "1 3 #5 7 9 #11"),
  T("maj13", "1 3 5 7 9 13"),
  T("maj13(#5)", "1 3 #5 7 9 13"),
  T("maj13(#11)", "1 3 5 7 9 #11 13"),
  T("maj13(#11,#5)", "1 3 #5 7 9 #11 13"),
  T("sus2", "1 9 5"),
  T("sus4", "1 11 5"),
  T("5", "1 5"),
  T("7sus", "1 11 5 b7"),
  T("9sus", "1 11 5 b7 9"),
  T("13sus", "1 11 5 b7 9 13"),
  T("m", "1 b3 5"),
  T("m+", "1 b3 #5"),
  T("m6", "1 b3 5 6"),
  T("m7", "1 b3 5 b7"),
  T("m7b5", "1 b3 b5 b7"),
  T("m7(#5)", "1 b3 #5 b7"),
  T("m(add9)", "1 b3 5 9"),
  T("m6/9", "1 b3 5 6 9"),
  T("m9", "1 b3 5 b7 9"),
  T("m9(b5)", "1 b3 b5 b7 9"),
  T("m9(#5)", "1 b3 #5 b7 9"),
  T("m7(b9)", "1 b3 5 b7 b9"),
  T("m7(add11)", "1 b3 5 b7 11"),
  T("m11", "1 b3 5 b7 9 11"),
  T("m11(b5)", "1 b3 b5 b7 9 11"),
  T("m9(#11)", "1 b3 5 b7 9 #11"),
  T("m13", "1 b3 5 b7 9 11 13"),
  T("m13(b5)", "1 b3 b5 b7 9 11 13"),
  T("m13(#5)", "1 b3 #5 b7 9 11 13"),
  T("m(maj7)", "1 b3 5 7"),
  T("m(maj7b5)", "1 b3 b5 7"),
  T("m(maj7#5)", "1 b3 #5 7"),
  T("m(maj9)", "1 b3 5 7 9"),
  T("m(maj9b5)", "1 b3 b5 7 9"),
  T("m(maj9#5)", "1 b3 #5 7 9"),
  T("m7sus", "1 b3 11 5 b7"),
  T("dim", "1 b3 b5"),
];

/** Slash-chord upper qualities (15), from the same spec. */
export const SLASH_UPPER_TYPES: SheetType[] = [
  T("", "1 3 5"),
  T("m", "1 b3 5"),
  T("6", "1 3 5 6"),
  T("7", "1 3 5 b7"),
  T("maj7", "1 3 5 7"),
  T("m7", "1 b3 5 b7"),
  T("m7b5", "1 b3 b5 b7"),
  T("add9", "1 3 5 9"),
  T("m6", "1 b3 5 6"),
  T("aug", "1 3 #5"),
  T("dim", "1 b3 b5"),
  T("sus4", "1 11 5"),
  T("dim7", "1 b3 b5 bb7"),
  T("mMaj7", "1 b3 5 7"),
  T("9", "1 3 5 b7 9"),
];

/** Upper root above the bass, as an interval spelled from the bass. */
export const SLASH_UPPER_INTERVALS = [
  "b9", "9", "b3", "3", "11", "#11", "b5", "5", "b13", "13", "b7", "7",
];

// ── spelling ────────────────────────────────────────────────────────────────

const LETTERS = "CDEFGAB";
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

/** Degree number → zero-based letter step, and its major-scale semitones. */
function degreeStep(degree: string): { step: number; semis: number } {
  const m = degree.match(/^(bb|b|#|##)?(\d+)$/);
  if (!m) throw new Error(`bad degree ${degree}`);
  const acc = m[1] === "bb" ? -2 : m[1] === "b" ? -1 : m[1] === "#" ? 1 : m[1] === "##" ? 2 : 0;
  const n = Number(m[2]);
  const step = (n - 1) % 7;
  return { step, semis: NATURAL[step] + acc };
}

function parseNote(note: string): { letter: number; pc: number } {
  const letter = LETTERS.indexOf(note[0]);
  let acc = 0;
  for (const ch of note.slice(1)) acc += ch === "#" ? 1 : ch === "b" ? -1 : 0;
  return { letter, pc: (((NATURAL[letter] + acc) % 12) + 12) % 12 };
}

/** Spell `degree` above `root` by letter: spell("Gb", "b9") === "Abb". */
export function spell(root: string, degree: string): string {
  const r = parseNote(root);
  const { step, semis } = degreeStep(degree);
  const letter = (r.letter + step) % 7;
  const target = (r.pc + semis) % 12;
  let acc = target - NATURAL[letter];
  while (acc > 6) acc -= 12;
  while (acc < -6) acc += 12;
  return LETTERS[letter] + (acc > 0 ? "#".repeat(acc) : "b".repeat(-acc));
}

const ROOT_PCS = new Map(SHEET_ROOTS.map((r) => [parseNote(r).pc, r]));

/** Respell a note into the 15-root set (A𝄫 over G♭ → G). */
export function toSheetRoot(note: string): string {
  if (SHEET_ROOTS.includes(note)) return note;
  return ROOT_PCS.get(parseNote(note).pc)!;
}

export interface CatalogueChord {
  name: string;
  root: string;
  pitchClasses: string[];
  bass?: string;
}

export function sheetChords(): CatalogueChord[] {
  return SHEET_ROOTS.flatMap((root) =>
    SHEET_TYPES.map((t) => ({
      name: `${root}${t.symbol}`,
      root,
      pitchClasses: t.degrees.map((d) => spell(root, d)),
    })),
  );
}

export function slashChords(): CatalogueChord[] {
  return SHEET_ROOTS.flatMap((bass) =>
    SLASH_UPPER_INTERVALS.flatMap((iv) => {
      const upper = toSheetRoot(spell(bass, iv));
      return SLASH_UPPER_TYPES.map((t) => ({
        name: `${upper}${t.symbol}/${bass}`,
        root: upper,
        pitchClasses: t.degrees.map((d) => spell(upper, d)),
        bass,
      }));
    }),
  );
}
