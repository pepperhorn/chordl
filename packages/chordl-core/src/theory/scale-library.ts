/** Host-supplied scale definitions; no catalogue or Directus dependency. */
import { Interval, Note } from "tonal";
import { spellWithPreference } from "../engine/note-spelling.js";

export type StepToken = "H" | "W" | "m3" | "M3";
export type ScaleDef = {
  slug: string;
  name: string;
  intervals: string[];
  steps: StepToken[];
  degreeLabels?: string[];
  modeParent?: string;
  modeDegree?: number;
  relativeExampleRoot?: string;
};

const ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"];
const STEPS: StepToken[] = ["H", "W", "m3", "M3"];
const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** Bridge formula-sheet tokens to the existing Tonal spelling/label helpers. */
function tonalInterval(token: string): string {
  const match = /^([b#]*)([1-7])$/.exec(token);
  if (!match) throw new Error(`Invalid scale interval: ${token}`);
  const degree = Number(match[2]);
  const alt = [...match[1]].reduce((sum, c) => sum + (c === "#" ? 1 : -1), 0);
  const perfect = [1, 4, 5].includes(degree);
  const quality = alt > 0 ? "A".repeat(alt)
    : alt === 0 ? (perfect ? "P" : "M")
    : !perfect && alt === -1 ? "m"
    : "d".repeat(-alt - (perfect ? 0 : 1));
  return `${degree}${quality}`;
}

function pitches(intervals: string[]): number[] {
  if (!intervals.length) throw new Error("A scale needs intervals");
  const result = intervals.map(i => Interval.semitones(tonalInterval(i)));
  if (result[0] !== 0 || result.some((n, i) => !Number.isFinite(n) || n < 0 || n >= 12 || (i > 0 && n <= result[i - 1]))) {
    throw new Error("Scale intervals must ascend from the tonic within one octave");
  }
  return result;
}

function checkRoot(root: string): number {
  if (!/^[A-G][b#]*$/.test(root) || Note.get(root).empty) throw new Error(`Invalid scale root: ${root}`);
  return Note.chroma(root);
}

export function spellScale(def: ScaleDef, root: string): string[] {
  checkRoot(root);
  pitches(def.intervals);
  return def.intervals.map(i => Note.transpose(root, tonalInterval(i)));
}

export function stepPatternOf(intervals: string[]): StepToken[] {
  const pcs = pitches(intervals);
  return pcs.map((pc, i) => {
    const gap = (pcs[i + 1] ?? 12) - pc;
    const step = STEPS[gap - 1];
    if (!step) throw new Error(`Unsupported scale step: ${gap} semitones`);
    return step;
  });
}

export function validateStepPattern(intervals: string[], steps: StepToken[]): boolean {
  try {
    const derived = stepPatternOf(intervals);
    return steps.length === derived.length && steps.every((s, i) => s === derived[i]);
  } catch {
    return false;
  }
}

export function degreeLabelsOf(intervals: string[]): string[] {
  return intervals.map(token => {
    tonalInterval(token); // Validate the formula token before reading its degree.
    // Preserve the written prefix: Tonal's diminished 7th is bb7, whereas a
    // diminished 5th is b5. A quality-only label helper loses that distinction.
    const prefix = token.slice(0, -1).replace(/b/g, "♭");
    return prefix + ROMANS[Number(token.slice(-1)) - 1];
  });
}

/** Major-key signature cost: Db=5 < C#=7; Eb=3 < D#=9, etc.
 * F#/Gb both cost six: the explicit Task 9 preference is F#.
 * With a definition, rank its actual spelled notes: avoid double accidentals,
 * then minimize accidental count, then avoid Cb/Fb/E#/B# roots. Remaining ties
 * keep the conventional one-argument spelling.
 */
export function preferredRoot(pc: number, def?: ScaleDef): string {
  if (!Number.isInteger(pc)) throw new Error("Pitch class must be an integer");
  const normalized = mod12(pc);
  const conventional = spellWithPreference(Note.pitchClass(Note.fromMidiSharps(60 + normalized)), "C", normalized !== 6);
  if (!def) return conventional;
  return rootCandidates(normalized).map(root => ({ root, cost: spellingCost(spellScale(def, root)) }))
    .sort((a, b) => a.cost.doubles - b.cost.doubles || a.cost.accidentals - b.cost.accidentals
      || Number(["Cb", "Fb", "E#", "B#"].includes(a.root)) - Number(["Cb", "Fb", "E#", "B#"].includes(b.root))
      || Number(b.root === conventional) - Number(a.root === conventional))[0].root;
}

function spellingCost(notes: string[]): { doubles: number; accidentals: number } {
  return notes.reduce((cost, note) => {
    const count = Math.abs(Note.get(note).alt!);
    return { doubles: cost.doubles + (count > 1 ? 1 : 0), accidentals: cost.accidentals + count };
  }, { doubles: 0, accidentals: 0 });
}

/** Candidate roots have at most one accidental; a double-accidental root
 * cannot give a scale free of double accidentals, since it is the first note.
 */
function rootCandidates(pc: number): string[] {
  return [..."CDEFGAB"].flatMap(letter => ["", "b", "#"].map(acc => letter + acc))
    .filter(root => Note.chroma(root) === mod12(pc));
}

function practicalParentRoot(pc: number, parent: ScaleDef): string {
  return rootCandidates(pc).map(root => ({ root, cost: spellingCost(spellScale(parent, root)) }))
    .sort((a, b) => a.cost.doubles - b.cost.doubles || a.cost.accidentals - b.cost.accidentals
      || Number(b.root.includes("b")) - Number(a.root.includes("b")))[0].root;
}

function modeDegree(mode: ScaleDef): number {
  const degree = mode.modeDegree;
  if (!Number.isInteger(degree) || degree! < 1 || degree! > 7) throw new Error(`Missing or invalid mode degree: ${mode.slug}`);
  return degree!;
}

export function modeSource(mode: ScaleDef, root: string, defs: ScaleDef[]): { parent: ScaleDef; parentRoot: string } {
  const degree = modeDegree(mode);
  const parent = defs.find(d => d.slug === mode.modeParent);
  if (!parent) throw new Error(`Missing mode parent: ${mode.modeParent}`);
  const offset = pitches(parent.intervals)[degree - 1];
  if (offset === undefined) throw new Error("Mode degree exceeds parent scale");
  const pc = checkRoot(root) - offset;
  // Preserve the mode root's letter at its parent degree. Only impractical
  // parent keys (>7 written accidentals or a double accidental) are respelled.
  const letterRoot = Note.transpose(root, `-${tonalInterval(parent.intervals[degree - 1])}`);
  const cost = spellingCost(spellScale(parent, letterRoot));
  const parentRoot = cost.doubles || cost.accidentals > 7 ? practicalParentRoot(pc, parent) : letterRoot;
  return { parent, parentRoot };
}

export function modeAt(parent: ScaleDef, parentRoot: string, degree: number, defs: ScaleDef[]): { mode: ScaleDef; root: string } {
  if (!Number.isInteger(degree) || degree < 1 || degree > 7) throw new Error("Mode degree must be 1–7");
  const mode = defs.find(d => d.modeParent === parent.slug && d.modeDegree === degree);
  if (!mode) throw new Error(`Missing mode ${degree} of ${parent.slug}`);
  const root = spellScale(parent, parentRoot)[degree - 1];
  if (!root) throw new Error("Mode degree exceeds parent scale");
  return { mode, root };
}

function checkRange(from: number, to: number): void {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
    throw new Error("Excerpt degrees must be positive integers with from <= to");
  }
}

/** Inclusive degree range; each extra octave extends the upper endpoint by
 * one scale length. Pitch-class strings intentionally carry no octave number.
 * Down reverses the same range; up-down visits the upper endpoint only once.
 */
export function scaleExcerpt(def: ScaleDef, root: string, from: number, to: number, octaves = 1, direction: "up" | "down" | "up-down" = "up"): string[] {
  checkRange(from, to);
  if (!Number.isInteger(octaves) || octaves < 1) throw new Error("Octaves must be a positive integer");
  if (!["up", "down", "up-down"].includes(direction)) throw new Error("Invalid excerpt direction");
  const notes = spellScale(def, root);
  const last = to + (octaves - 1) * notes.length;
  const up = Array.from({ length: last - from + 1 }, (_, i) => notes[(from + i - 1) % notes.length]);
  if (direction === "down") return up.reverse();
  return direction === "up-down" ? [...up, ...up.slice(0, -1).reverse()] : up;
}

export function excerptLabel(def: ScaleDef, root: string, from: number, to: number): string {
  checkRange(from, to);
  const title = `${root} ${def.name}`;
  return from === 1 && to === def.intervals.length ? title : `Notes ${from}–${to} of ${title}`;
}

// Symbol → CRF modifier slug (same convention as chords.slug):
// major → (no modifier); m → m; dim → dim; aug → aug;
// maj7 → maj7; 7 → 7; m7 → m7; m7b5 → m7-flat5;
// dim7 → dim7; mMaj7 → m-maj7; maj7#5 → maj7-sharp5.
// Natural ninths replace 7 with 9; (b9)/(#9) append -flat9/-sharp9.
function modifierSlug(symbol: string): string {
  return symbol.replace(/mMaj/g, "m-maj").replace(/[()]/g, "")
    .replace(/b/g, "-flat").replace(/#/g, "-sharp");
}

export function diatonicChords(def: ScaleDef, root: string, stack: 3 | 4 | 5): { degree: number; roman: string; symbol: string; root: string; slug: string }[] {
  if (def.intervals.length !== 7) throw new Error("Diatonic chords require a seven-note scale");
  if (![3, 4, 5].includes(stack)) throw new Error("Chord stack must be 3, 4, or 5");
  const pcs = pitches(def.intervals);
  const notes = spellScale(def, root);
  const labels = degreeLabelsOf(def.intervals).map(label => label.replace(/#/g, "♯"));
  return notes.map((chordRoot, i) => {
    const tones = Array.from({ length: stack }, (_, j) => mod12(pcs[(i + j * 2) % 7] - pcs[i]));
    const third = tones[1], fifth = tones[2];
    const diminished = third === 3 && fifth === 6;
    const augmented = third === 4 && fifth === 8;
    const minor = third === 3;
    if (![3, 4].includes(third) || ![6, 7, 8].includes(fifth)) throw new Error("Unsupported diatonic chord quality");
    let suffix = diminished ? "dim" : augmented ? "aug" : minor ? "m" : "";
    const degreeRoman = minor ? labels[i].toLowerCase() : labels[i];
    let roman = degreeRoman;
    if (diminished) roman += "°";
    if (augmented) roman += "+";
    if (stack >= 4) {
      const seventh = tones[3];
      if (![9, 10, 11].includes(seventh)) throw new Error("Unsupported diatonic seventh");
      if (diminished && seventh === 9) suffix = "dim7";
      else {
        if (seventh === 9) throw new Error("Unsupported diminished seventh quality");
        suffix = minor ? (seventh === 11 ? "mMaj7" : "m7") : (seventh === 11 ? "maj7" : "7");
        if (fifth === 6) suffix += "b5";
        if (fifth === 8) suffix += "#5";
      }
      roman = diminished && seventh === 10 ? `${degreeRoman}ø7` : `${roman}${seventh === 11 ? "maj7" : "7"}`;
    }
    if (stack === 5) {
      const ninth = tones[4];
      if (ninth === 2) { suffix = suffix.replace("7", "9"); roman = roman.replace("7", "9"); }
      else if (ninth === 1 || ninth === 3) {
        const alteration = ninth === 1 ? "b9" : "#9";
        suffix += `(${alteration})`;
        roman += `(${alteration})`;
      } else throw new Error("Unsupported diatonic ninth");
    }
    const rootSlug = (chordRoot[0].toLowerCase() + chordRoot.slice(1).replace(/b/g, "-flat").replace(/#/g, "-sharp"));
    return { degree: i + 1, roman, symbol: chordRoot + suffix, root: chordRoot, slug: suffix ? `${rootSlug}-${modifierSlug(suffix)}` : rootSlug };
  });
}

export function modeDemo(mode: ScaleDef, defs: ScaleDef[]) {
  const degree = modeDegree(mode);
  const ordinal = degree === 1 ? "st" : degree === 2 ? "nd" : degree === 3 ? "rd" : "th";
  const { parent } = modeSource(mode, "C", defs);
  const relativeRoot = mode.relativeExampleRoot ?? (degree === 1 ? "G" : spellScale(parent, "C")[degree - 1]);
  const example = (root: string) => ({
    root, notes: spellScale(mode, root),
    question: `${root} is the ${ROMANS[degree - 1]} (${ordinal} degree) of?`,
    answer: modeSource(mode, root, defs).parentRoot,
  });
  return {
    title: `${degree}${ordinal} Degree - ${mode.name}`,
    steps: [...mode.steps], degreeLabels: mode.degreeLabels ? [...mode.degreeLabels] : degreeLabelsOf(mode.intervals),
    parallel: { ...example("C"), root: "C" as const },
    relative: (() => {
      const relative = example(relativeRoot);
      const parentNotes = spellScale(parent, relative.answer);
      const start = degree - 1;
      return { ...relative, notes: [...parentNotes.slice(start), ...parentNotes.slice(0, start)] };
    })(),
  };
}
