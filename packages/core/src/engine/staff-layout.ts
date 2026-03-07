import { FLAT_TO_SHARP } from "./svg-constants";
import {
  STAFF_LINE_SPACING,
  HALF_STAFF_SPACING,
  STAFF_WIDTH,
  STAFF_GAP,
  STAFF_TOP_MARGIN,
  STAFF_BOTTOM_MARGIN,
  LEDGER_LINE_EXTEND,
  NOTE_COLUMN_X,
  ACCIDENTAL_OFFSET,
} from "./staff-constants";

export interface StaffNote {
  pitchClass: string;
  octave: number;
  staff: "treble" | "bass";
  y: number;
  accidental: "sharp" | "flat" | null;
  ledgerLines: number[];
  accidentalX: number;
}

export interface StaffLayoutResult {
  notes: StaffNote[];
  staffMode: "treble" | "bass" | "grand";
  totalHeight: number;
  totalWidth: number;
  trebleTopY: number;
  bassTopY: number;
}

export interface StaffLayoutOptions {
  lhNotes?: string[];
  rhOctave?: number;
  lhOctave?: number;
}

const DIATONIC_INDEX: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
};

// Treble staff bottom line = E4 → absolutePos = 4*7 + 2 = 30
const TREBLE_BOTTOM_LINE_POS = 30;
// Bass staff bottom line = G2 → absolutePos = 2*7 + 4 = 18
const BASS_BOTTOM_LINE_POS = 18;

// Middle C = C4 → absolutePos = 4*7 + 0 = 28
// In treble, C4 is 1 step below bottom line (E4=30), so 1 ledger line below
// In bass, C4 is 2 steps above top line (A3=26), so 1 ledger line above

function normalizePitchClass(note: string): string {
  return FLAT_TO_SHARP[note] ?? note;
}

function letterFromPitchClass(pc: string): string {
  return pc.replace("#", "").replace("b", "");
}

function noteToMidi(pitchClass: string, octave: number): number {
  const letter = letterFromPitchClass(pitchClass);
  const chromaticBase: Record<string, number> = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
  };
  const base = chromaticBase[letter] ?? 0;
  const accidental = pitchClass.includes("#") ? 1 : pitchClass.includes("b") ? -1 : 0;
  return (octave + 1) * 12 + base + accidental;
}

function absoluteDiatonicPos(pitchClass: string, octave: number): number {
  const letter = letterFromPitchClass(pitchClass);
  return octave * 7 + (DIATONIC_INDEX[letter] ?? 0);
}

function computeY(absolutePos: number, staffBottomLineY: number, refPos: number): number {
  const relativeSteps = absolutePos - refPos;
  return staffBottomLineY - relativeSteps * HALF_STAFF_SPACING;
}

function computeLedgerLines(
  absolutePos: number,
  staffBottomLinePos: number,
  staffBottomLineY: number,
): number[] {
  const staffTopLinePos = staffBottomLinePos + 8; // 5 lines = 4 spaces = 8 diatonic steps
  const ledgers: number[] = [];

  if (absolutePos < staffBottomLinePos) {
    // Below staff — ledger lines at even steps below bottom line
    for (let pos = staffBottomLinePos - 2; pos >= absolutePos; pos -= 2) {
      ledgers.push(computeY(pos, staffBottomLineY, staffBottomLinePos));
    }
  } else if (absolutePos > staffTopLinePos) {
    // Above staff — ledger lines at even steps above top line
    for (let pos = staffTopLinePos + 2; pos <= absolutePos; pos += 2) {
      ledgers.push(computeY(pos, staffBottomLineY, staffBottomLinePos));
    }
  }
  // Special case: notes ON a ledger line position (like middle C)
  // The above loops already include them since they go >=/>= the note position

  return ledgers;
}

function assignOctaves(
  notes: string[],
  baseOctave: number,
): Array<{ pitchClass: string; octave: number }> {
  const result: Array<{ pitchClass: string; octave: number }> = [];
  let currentOctave = baseOctave;
  let prevDiatonic = -1;

  for (const note of notes) {
    const pc = normalizePitchClass(note);
    const letter = letterFromPitchClass(pc);
    const diatonic = DIATONIC_INDEX[letter] ?? 0;

    if (prevDiatonic >= 0 && diatonic <= prevDiatonic) {
      currentOctave++;
    }
    prevDiatonic = diatonic;

    result.push({ pitchClass: pc, octave: currentOctave });
  }
  return result;
}

function staggerAccidentals(notes: StaffNote[]): void {
  // Find notes with accidentals and stagger their X positions
  // when they are close together (within 2 diatonic steps)
  const accNotes = notes.filter((n) => n.accidental !== null);
  if (accNotes.length <= 1) return;

  // Sort by Y (top to bottom, lower Y = higher on staff)
  accNotes.sort((a, b) => a.y - b.y);

  let staggered = false;
  for (let i = 1; i < accNotes.length; i++) {
    const yDiff = Math.abs(accNotes[i].y - accNotes[i - 1].y);
    // If notes are within ~3 staff positions, stagger
    if (yDiff < STAFF_LINE_SPACING * 1.5) {
      if (!staggered) {
        accNotes[i].accidentalX = NOTE_COLUMN_X - ACCIDENTAL_OFFSET * 2;
        staggered = true;
      } else {
        staggered = false;
      }
    } else {
      staggered = false;
    }
  }
}

export function computeStaffLayout(
  notes: string[],
  options: StaffLayoutOptions = {},
): StaffLayoutResult {
  const { lhNotes, rhOctave = 4, lhOctave = 3 } = options;

  // Assign octaves to RH notes
  const rhNotesList = lhNotes
    ? notes.filter((n) => !lhNotes.includes(n))
    : notes;
  const lhNotesList = lhNotes ?? [];

  const rhWithOctaves = assignOctaves(rhNotesList, rhOctave);
  const lhWithOctaves = assignOctaves(lhNotesList, lhOctave);
  const allWithOctaves = [...lhWithOctaves, ...rhWithOctaves];

  // Determine staff assignment
  const hasTreble = allWithOctaves.some(
    (n) => noteToMidi(n.pitchClass, n.octave) >= 60,
  );
  const hasBass = allWithOctaves.some(
    (n) => noteToMidi(n.pitchClass, n.octave) < 60,
  );

  // Override: if lhNotes is explicitly set, those go to bass
  const staffMode: "treble" | "bass" | "grand" =
    hasTreble && hasBass ? "grand" : hasTreble ? "treble" : "bass";

  // Compute Y positions for staff lines
  // Treble bottom line (E4) Y position
  const trebleBottomLineY = STAFF_TOP_MARGIN + STAFF_LINE_SPACING * 4;
  // Bass top line starts after treble + gap
  const bassTopLineY =
    staffMode === "grand"
      ? trebleBottomLineY + STAFF_GAP
      : staffMode === "bass"
        ? STAFF_TOP_MARGIN
        : -1;
  const bassBottomLineY =
    bassTopLineY >= 0 ? bassTopLineY + STAFF_LINE_SPACING * 4 : -1;

  const trebleTopY = staffMode !== "bass" ? STAFF_TOP_MARGIN : -1;
  const bassTopY = bassTopLineY;

  const staffNotes: StaffNote[] = allWithOctaves.map((n) => {
    const midi = noteToMidi(n.pitchClass, n.octave);
    const isLH = lhNotes
      ? lhNotesList.some((lh) => normalizePitchClass(lh) === n.pitchClass)
      : midi < 60;

    let staff: "treble" | "bass";
    let refPos: number;
    let bottomLineY: number;
    let bottomLinePos: number;

    if (isLH && staffMode !== "treble") {
      staff = "bass";
      refPos = BASS_BOTTOM_LINE_POS;
      bottomLineY = bassBottomLineY;
      bottomLinePos = BASS_BOTTOM_LINE_POS;
    } else {
      staff = "treble";
      refPos = TREBLE_BOTTOM_LINE_POS;
      bottomLineY = trebleBottomLineY;
      bottomLinePos = TREBLE_BOTTOM_LINE_POS;
    }

    const absPos = absoluteDiatonicPos(n.pitchClass, n.octave);
    const y = computeY(absPos, bottomLineY, refPos);
    const ledgerLines = computeLedgerLines(absPos, bottomLinePos, bottomLineY);

    const accidental: "sharp" | "flat" | null = n.pitchClass.includes("#")
      ? "sharp"
      : n.pitchClass.includes("b")
        ? "flat"
        : null;

    return {
      pitchClass: n.pitchClass,
      octave: n.octave,
      staff,
      y,
      accidental,
      ledgerLines,
      accidentalX: NOTE_COLUMN_X - ACCIDENTAL_OFFSET,
    };
  });

  // Stagger accidentals that overlap
  staggerAccidentals(staffNotes);

  // Total height
  const lastLineY =
    staffMode === "bass" || staffMode === "grand"
      ? bassBottomLineY
      : trebleBottomLineY;
  // Account for notes that extend below the bottom
  const maxNoteY = Math.max(lastLineY, ...staffNotes.map((n) => n.y));
  // Account for ledger lines below
  const maxLedgerY = Math.max(
    lastLineY,
    ...staffNotes.flatMap((n) => n.ledgerLines),
  );

  const totalHeight =
    Math.max(maxNoteY, maxLedgerY) + STAFF_BOTTOM_MARGIN + HALF_STAFF_SPACING;

  return {
    notes: staffNotes,
    staffMode,
    totalHeight,
    totalWidth: STAFF_WIDTH,
    trebleTopY,
    bassTopY,
  };
}
