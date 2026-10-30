import { Interval, Note } from "tonal";
import { INSTRUMENTS, analyzeChordTones, levelForFacts, positionFacts, reviewGuitarPosition } from "@pepperhorn/chordl-guitar";
import type { ChordsDbPosition } from "@pepperhorn/chordl-guitar";
import { levelForVoicing } from "@pepperhorn/chordl-voicings";
import { chordIntervals, parseChordId } from "./chordId.js";
import { degreeLabel, labelNotes, parsePitch } from "./pitch.js";
import { notesMatchRealization } from "./realization.js";
import type { Finding } from "./realization.js";
import type { FrettedRealization, Voicing } from "./types.js";

export interface CheckResult {
  hard: Finding[];
  flags: Finding[];
  facts: Finding[];
}

const NO_THIRD_CHECK = new Set(["5", "sus2", "sus4", "7sus4"]);
const MAX_HAND_SPAN = 14;
const STRETCH = 4;
// Alterations a `7alt` chord leaves unspecified: tensions on these are not additions.
const ALT_TENSION_LABELS = new Set(["9m", "9A", "5d", "5A", "13m", "11A"].map(degreeLabel));

const hard = (code: string, message: string, data?: Record<string, unknown>): Finding => ({ code, severity: "hard", message, data });
const flag = (code: string, message: string, data?: Record<string, unknown>): Finding => ({ code, severity: "flag", message, data });
const fact = (code: string, message: string, data?: Record<string, unknown>): Finding => ({ code, severity: "fact", message, data });
const byCode = (a: Finding, b: Finding) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
const degreeNumber = (iv: string) => parseInt(iv, 10);

function frettedHard(r: FrettedRealization): Finding[] {
  const out: Finding[] = [];
  const distinct = new Set(r.fingers.filter((f): f is number => f !== null && f > 0));
  const barres = r.barres;
  const covered = (i: number) =>
    barres.some((b) => i >= Math.min(b.fromString, b.toString) && i <= Math.max(b.fromString, b.toString) && r.strings[i] === b.fret);
  const fretted = r.strings.flatMap((f, i) => (f !== null && f > 0 ? [i] : []));
  const needed = fretted.filter((i) => !covered(i)).length + barres.length;
  if (distinct.size > 4 || needed > 4) {
    out.push(hard("too-many-fingers", `Grip needs more than four fingers (${Math.max(distinct.size, needed)})`, { fingers: distinct.size, needed }));
  }
  return out;
}

function guitarFindings(v: Voicing, r: FrettedRealization, names: string[], rootPc: number): { flags: Finding[]; facts: Finding[] } {
  const parsed = parseChordId(v.chordId)!;
  const pos: ChordsDbPosition = {
    frets: r.strings.map((f) => (f === null ? -1 : f)),
    fingers: r.fingers.map((f) => f ?? 0),
    baseFret: 1,
    barres: r.barres.map((b) => b.fret),
  };
  const analysis = analyzeChordTones(parsed.root, names, parsed.bass ?? undefined);
  const review = reviewGuitarPosition(pos, analysis);
  const flags = review.reasons.map((code) => flag(`guitar:${code}`, `chordl-guitar review: ${code}`, { reason: code }));
  const facts: Finding[] = [];
  if (pos.frets.some((f) => f >= 0)) {
    const level = levelForFacts(positionFacts(pos, INSTRUMENTS.guitar.openMidi, rootPc));
    facts.push(fact(`level:${level}`, `Experience level: ${level}`, { level }));
  }
  return { flags, facts };
}

export function checkVoicing(v: Voicing): CheckResult {
  const r = v.realization;
  const hards: Finding[] = notesMatchRealization(v);
  const flags: Finding[] = [];
  const facts: Finding[] = [];
  const finish = (): CheckResult => ({ hard: hards.sort(byCode), flags: flags.sort(byCode), facts: facts.sort(byCode) });

  if (hards.some((f) => f.code === "tuning-length" || f.code === "invalid-realization")) return finish();
  const parsed = parseChordId(v.chordId);
  if (!parsed || v.notes.some((n) => !parsePitch(n.pitch))) return finish();

  // Spelling: misspelled per labelNotes, or degree field differs from the computed label.
  const labelled = labelNotes(v.chordId, v.notes.map((n) => n.pitch));
  labelled.forEach((l, i) => {
    if (l.misspelled || v.notes[i].degree !== l.degree) {
      hards.push(hard("wrong-note", `${l.pitch}: expected degree ${l.degree}${l.misspelled ? " with a different spelling" : ""}, got "${v.notes[i].degree}"`,
        { pitch: l.pitch, expected: l.degree, got: v.notes[i].degree, misspelled: l.misspelled }));
    }
  });

  const rootPc = Note.chroma(parsed.root);
  const intervals = chordIntervals(v.chordId).map((iv) => ({ iv, pc: (rootPc + Interval.semitones(iv)) % 12, label: degreeLabel(iv) }));
  const bassPcExpected = parsed.bass ? Note.chroma(parsed.bass) : rootPc;
  const midis = v.notes.map((n) => parsePitch(n.pitch)!.midi);
  const pcs = new Set(midis.map((m) => m % 12));

  // Unwritten additions apply to every instrument, bowed included.
  const seenAdditions = new Set<string>();
  labelled.forEach((l) => {
    if (l.inChord) return;
    if (Note.chroma(Note.pitchClass(l.pitch)) === bassPcExpected) return; // the written slash bass
    if (parsed.base === "7alt" && ALT_TENSION_LABELS.has(l.degree)) return;
    if (seenAdditions.has(l.degree)) return;
    seenAdditions.add(l.degree);
    flags.push(flag(`unwritten-addition:${l.degree}`, `${l.pitch} (${l.degree}) is not part of ${v.chordId}`, { pitch: l.pitch, degree: l.degree }));
  });

  if (r.kind === "bowed") return finish();

  // Chord completeness.
  const third = intervals.find((i) => degreeNumber(i.iv) === 3);
  if (third && !NO_THIRD_CHECK.has(parsed.base) && !pcs.has(third.pc)) {
    hards.push(hard("missing-third", `${v.chordId} has a 3rd (${third.label}) but none sounds`, { degree: third.label }));
  }
  const seventh = intervals.find((i) => degreeNumber(i.iv) === 7);
  if (seventh && !pcs.has(seventh.pc)) flags.push(flag("missing-seventh", `The 7th (${seventh.label}) does not sound`, { degree: seventh.label }));
  for (const i of intervals) {
    if (degreeNumber(i.iv) >= 9 && !pcs.has(i.pc)) {
      flags.push(flag(`missing-extension:${i.label}`, `The ${i.label} written in ${v.chordId} does not sound`, { degree: i.label }));
    }
  }
  if (!pcs.has(rootPc)) flags.push(flag("root-omitted", "The root does not sound"));
  const lowest = midis.reduce((a, b) => Math.min(a, b), Infinity);
  if (midis.length > 0 && lowest % 12 !== bassPcExpected) {
    flags.push(flag("bass-mismatch", `Lowest note ${v.notes.find((n) => parsePitch(n.pitch)!.midi === lowest)!.pitch} is not the expected bass`, { lowestMidi: lowest, expectedPc: bassPcExpected }));
  }

  const names = chordIntervals(v.chordId).map((iv) => Note.transpose(parsed.root, iv));

  if (r.kind === "keyboard") {
    for (const hand of ["left", "right"] as const) {
      const m = r.hands[hand].map((p) => parsePitch(p)!.midi);
      const span = m.length > 0 ? m.reduce((a, b) => Math.max(a, b), -Infinity) - m.reduce((a, b) => Math.min(a, b), Infinity) : 0;
      if (span > MAX_HAND_SPAN) {
        hards.push(hard("keyboard-hand-span", `${hand} hand spans ${span} semitones (max ${MAX_HAND_SPAN})`, { hand }));
      }
    }
    if (midis.length > 0) {
      // Offsets from the root at or below the lowest note, unreduced.
      const offset = (((lowest % 12) - rootPc) % 12 + 12) % 12;
      const level = levelForVoicing(midis.map((m) => m - lowest + offset));
      facts.push(fact(`level:${level}`, `Experience level: ${level}`, { level }));
    }
    return finish();
  }

  // Fretted.
  hards.push(...frettedHard(r));
  const sounded = r.strings.flatMap((f) => (f === null ? [] : [f]));
  const first = r.strings.findIndex((f) => f !== null);
  const last = r.strings.length - 1 - [...r.strings].reverse().findIndex((f) => f !== null);
  if (sounded.length > 0 && r.strings.slice(first, last + 1).some((f) => f === null)) {
    flags.push(flag("interior-mute", "A muted string sits between sounding strings"));
  }
  if (sounded.length > 0 && !sounded.includes(0)) facts.push(fact("movable", "No open strings; the shape can be moved"));
  const standard = r.instrument === "guitar" && r.tuning.length === INSTRUMENTS.guitar.openMidi.length
    && r.tuning.every((t, i) => parsePitch(t)?.midi === INSTRUMENTS.guitar.openMidi[i]);
  if (standard) {
    const g = guitarFindings(v, r, names, rootPc);
    flags.push(...g.flags);
    facts.push(...g.facts);
  } else {
    // Non-guitar instruments and non-standard guitar tunings get the generic stretch flag.
    const f = sounded.filter((x) => x > 0);
    if (f.length > 0 && f.reduce((a, b) => Math.max(a, b), -Infinity) - f.reduce((a, b) => Math.min(a, b), Infinity) >= STRETCH) flags.push(flag("stretch", "Fretted notes span four or more frets"));
  }
  return finish();
}
