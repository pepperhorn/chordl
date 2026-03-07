import { describe, it, expect } from "vitest";
import { computeStaffLayout } from "../src/engine/staff-layout";
import { HALF_STAFF_SPACING, STAFF_LINE_SPACING, NOTE_COLUMN_X, SECOND_OFFSET } from "../src/engine/staff-constants";

describe("computeStaffLayout", () => {
  describe("staff mode detection", () => {
    it("assigns treble-only for notes >= C4", () => {
      const result = computeStaffLayout(["C", "E", "G"], { rhOctave: 4 });
      expect(result.staffMode).toBe("treble");
    });

    it("assigns bass-only for notes < C4", () => {
      const result = computeStaffLayout(["C", "E", "G"], { rhOctave: 3 });
      expect(result.staffMode).toBe("bass");
    });

    it("assigns grand staff when notes span both staves", () => {
      const result = computeStaffLayout(["C", "E", "G", "B"], {
        lhNotes: ["C"],
        lhOctave: 3,
        rhOctave: 4,
      });
      expect(result.staffMode).toBe("grand");
    });
  });

  describe("note Y positions", () => {
    it("places E4 on the treble bottom line", () => {
      const result = computeStaffLayout(["E"], { rhOctave: 4 });
      const eNote = result.notes.find((n) => n.pitchClass === "E" && n.octave === 4);
      expect(eNote).toBeDefined();
      // E4 is the bottom line of treble — y should equal trebleBottomLineY
      expect(eNote!.y).toBe(result.trebleTopY + STAFF_LINE_SPACING * 4);
    });

    it("places F4 one step above E4", () => {
      const result = computeStaffLayout(["E", "F"], { rhOctave: 4 });
      const eNote = result.notes.find((n) => n.pitchClass === "E");
      const fNote = result.notes.find((n) => n.pitchClass === "F");
      expect(fNote!.y).toBe(eNote!.y - HALF_STAFF_SPACING);
    });

    it("places notes ascending in Y (lower Y = higher pitch)", () => {
      const result = computeStaffLayout(["C", "E", "G", "B"], { rhOctave: 4 });
      for (let i = 1; i < result.notes.length; i++) {
        expect(result.notes[i].y).toBeLessThan(result.notes[i - 1].y);
      }
    });
  });

  describe("ledger lines", () => {
    it("adds ledger line for middle C (C4) on treble staff", () => {
      const result = computeStaffLayout(["C"], { rhOctave: 4 });
      const cNote = result.notes[0];
      expect(cNote.staff).toBe("treble");
      // C4 is below treble staff bottom line (E4), needs 1 ledger line
      expect(cNote.ledgerLines.length).toBe(1);
    });

    it("has no ledger lines for notes within staff range", () => {
      const result = computeStaffLayout(["E", "G", "B"], { rhOctave: 4 });
      for (const note of result.notes) {
        expect(note.ledgerLines.length).toBe(0);
      }
    });

    it("adds ledger lines for high notes above treble staff", () => {
      // A5 = absolutePos 5*7+5 = 40, treble top line (F5) = 38
      // Need ledger line at pos 40 (above top)
      const result = computeStaffLayout(["A"], { rhOctave: 5 });
      expect(result.notes[0].ledgerLines.length).toBeGreaterThan(0);
    });
  });

  describe("accidental detection", () => {
    it("detects sharp accidentals", () => {
      const result = computeStaffLayout(["C#", "E", "G#"], { rhOctave: 4 });
      const sharps = result.notes.filter((n) => n.accidental === "sharp");
      expect(sharps.length).toBe(2);
    });

    it("has no accidentals for natural notes", () => {
      const result = computeStaffLayout(["C", "E", "G"], { rhOctave: 4 });
      expect(result.notes.every((n) => n.accidental === null)).toBe(true);
    });

    it("normalizes flats to sharps", () => {
      const result = computeStaffLayout(["Db", "Eb"], { rhOctave: 4 });
      expect(result.notes[0].pitchClass).toBe("C#");
      expect(result.notes[1].pitchClass).toBe("D#");
    });
  });

  describe("notehead offsets (seconds)", () => {
    it("offsets the upper note when two notes are a second apart", () => {
      // E and F are a second apart — F (upper) should be offset right
      const result = computeStaffLayout(["E", "F"], { rhOctave: 4 });
      const eNote = result.notes.find((n) => n.pitchClass === "E")!;
      const fNote = result.notes.find((n) => n.pitchClass === "F")!;
      expect(eNote.noteX).toBe(NOTE_COLUMN_X);
      expect(fNote.noteX).toBe(NOTE_COLUMN_X + SECOND_OFFSET);
    });

    it("does not offset notes a third or more apart", () => {
      const result = computeStaffLayout(["C", "E", "G"], { rhOctave: 4 });
      for (const note of result.notes) {
        expect(note.noteX).toBe(NOTE_COLUMN_X);
      }
    });

    it("alternates offsets for consecutive seconds (cluster)", () => {
      // C, D, E — C normal, D offset, E normal (since D is already offset)
      const result = computeStaffLayout(["C", "D", "E"], { rhOctave: 4 });
      const c = result.notes.find((n) => n.pitchClass === "C")!;
      const d = result.notes.find((n) => n.pitchClass === "D")!;
      const e = result.notes.find((n) => n.pitchClass === "E")!;
      expect(c.noteX).toBe(NOTE_COLUMN_X);
      expect(d.noteX).toBe(NOTE_COLUMN_X + SECOND_OFFSET);
      expect(e.noteX).toBe(NOTE_COLUMN_X); // alternates back
    });
  });

  describe("accidental collision avoidance", () => {
    it("staggers accidentals on adjacent notes", () => {
      // C# and D# are adjacent — should get different X positions
      const result = computeStaffLayout(["C#", "D#", "G#"], { rhOctave: 4 });
      const accNotes = result.notes.filter((n) => n.accidental === "sharp");
      expect(accNotes.length).toBe(3);
      const xPositions = accNotes.map((n) => n.accidentalX);
      const uniquePositions = new Set(xPositions);
      expect(uniquePositions.size).toBeGreaterThan(1);
    });

    it("pushes accidentals left when notehead is offset", () => {
      // E and F# — F# is offset right, so its accidental needs to clear E's notehead
      const result = computeStaffLayout(["E", "F#"], { rhOctave: 4 });
      const fSharp = result.notes.find((n) => n.pitchClass === "F#")!;
      // accidentalX should be further left than default
      expect(fSharp.accidentalX).toBeLessThan(NOTE_COLUMN_X - 14);
    });
  });

  describe("dimensions", () => {
    it("computes reasonable total height for treble-only", () => {
      const result = computeStaffLayout(["C", "E", "G"], { rhOctave: 4 });
      expect(result.totalHeight).toBeGreaterThan(40);
      expect(result.totalHeight).toBeLessThan(120);
    });

    it("computes larger height for grand staff", () => {
      const treble = computeStaffLayout(["E", "G"], { rhOctave: 4 });
      const grand = computeStaffLayout(["C", "E", "G"], {
        lhNotes: ["C"],
        lhOctave: 3,
        rhOctave: 4,
      });
      expect(grand.totalHeight).toBeGreaterThan(treble.totalHeight);
    });

    it("returns correct width", () => {
      const result = computeStaffLayout(["C", "E", "G"]);
      expect(result.totalWidth).toBe(120);
    });
  });

  describe("octave assignment", () => {
    it("increments octave when note wraps around", () => {
      // G, B, D, F — D and F should be octave+1
      const result = computeStaffLayout(["G", "B", "D", "F"], { rhOctave: 3 });
      expect(result.notes[0].octave).toBe(3); // G
      expect(result.notes[1].octave).toBe(3); // B
      expect(result.notes[2].octave).toBe(4); // D (wrapped)
      expect(result.notes[3].octave).toBe(4); // F
    });
  });
});
