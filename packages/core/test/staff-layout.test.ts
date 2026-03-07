import { describe, it, expect } from "vitest";
import { computeStaffLayout } from "../src/engine/staff-layout";
import { HALF_STAFF_SPACING, STAFF_LINE_SPACING } from "../src/engine/staff-constants";

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

  describe("accidental staggering", () => {
    it("staggers accidentals on adjacent notes", () => {
      // C# and D# are adjacent — should get different X positions
      const result = computeStaffLayout(["C#", "D#", "G#"], { rhOctave: 4 });
      const accNotes = result.notes.filter((n) => n.accidental === "sharp");
      // At least two accidentals should exist
      expect(accNotes.length).toBe(3);
      // C# and D# are close — one should be staggered
      const xPositions = accNotes.map((n) => n.accidentalX);
      const uniquePositions = new Set(xPositions);
      expect(uniquePositions.size).toBeGreaterThan(1);
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
