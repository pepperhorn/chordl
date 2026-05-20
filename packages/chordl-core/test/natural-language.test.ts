import { describe, it, expect } from "vitest";
import { parseChordDescription } from "@pepperhorn/chordl-core";

describe("parseChordDescription", () => {
  it("parses 'Cmaj7#5 starting on G#'", () => {
    const result = parseChordDescription("Cmaj7#5 starting on G#");
    expect(result.chordName).toBe("Cmaj7#5");
    expect(result.startingNote).toBe("G#");
  });

  it("parses 'show me a D minor seventh in first inversion'", () => {
    const result = parseChordDescription(
      "show me a D minor seventh in first inversion"
    );
    expect(result.chordName).toBe("Dm7");
    expect(result.inversion).toBe(1);
  });

  it("parses 'G sharp augmented'", () => {
    const result = parseChordDescription("G sharp augmented");
    expect(result.chordName).toBe("G#aug");
  });

  it("parses '2nd inversion'", () => {
    const result = parseChordDescription("C 2nd inversion");
    expect(result.inversion).toBe(2);
  });

  it("parses 'compact' format", () => {
    const result = parseChordDescription("Cmaj7 compact");
    expect(result.format).toBe("compact");
  });

  it("parses spanning", () => {
    const result = parseChordDescription(
      "a C triad in the 2nd inversion, spanning E to E, compact layout"
    );
    expect(result.chordName).toBe("C");
    expect(result.inversion).toBe(2);
    expect(result.spanFrom).toBe("E");
    expect(result.spanTo).toBe("E");
    expect(result.format).toBe("compact");
  });

  it("parses root position", () => {
    const result = parseChordDescription("C root position");
    expect(result.inversion).toBe(0);
  });

  it("parses 'Cmaj7 in the style of Bill Evans'", () => {
    const result = parseChordDescription("Cmaj7 in the style of Bill Evans");
    expect(result.chordName).toBe("Cmaj7");
    expect(result.styleHint).toBe("Bill Evans");
  });

  it("parses 'Dm7 like McCoy Tyner'", () => {
    const result = parseChordDescription("Dm7 like McCoy Tyner");
    expect(result.chordName).toBe("Dm7");
    expect(result.styleHint).toBe("McCoy Tyner");
  });

  it("parses 'C7 bebop'", () => {
    const result = parseChordDescription("C7 bebop");
    expect(result.chordName).toBe("C7");
    expect(result.styleHint).toBe("bebop");
  });

  it("parses 'Cmaj7#5#9 in the style of Bill Evans starting on G'", () => {
    const result = parseChordDescription(
      "Cmaj7#5#9 in the style of Bill Evans starting on G"
    );
    expect(result.chordName).toBe("Cmaj7#5#9");
    expect(result.styleHint).toBe("Bill Evans");
    expect(result.startingNote).toBe("G");
  });

  // Padding
  it("parses 'Cmaj7 with 3 notes on either side'", () => {
    const result = parseChordDescription("Cmaj7 with 3 notes on either side");
    expect(result.chordName).toBe("Cmaj7");
    expect(result.padding).toBe(3);
  });

  // Bass note via "over"
  it("parses 'C6/9 over D'", () => {
    const result = parseChordDescription("C6/9 over D");
    expect(result.chordName).toBe("C6/9");
    expect(result.bassNote).toBe("D");
  });

  it("parses 'Cmaj7 over E in the bass'", () => {
    const result = parseChordDescription("Cmaj7 over E in the bass");
    expect(result.chordName).toBe("Cmaj7");
    expect(result.bassNote).toBe("E");
  });

  // Bass degree
  it("parses 'Cmaj7 with the 5th in the bass'", () => {
    const result = parseChordDescription("Cmaj7 with the 5th in the bass");
    expect(result.chordName).toBe("Cmaj7");
    expect(result.bassDegree).toBe(5);
  });

  // Starting degree
  it("parses 'Dbmaj9 starting on the 9th'", () => {
    const result = parseChordDescription("Dbmaj9 starting on the 9th");
    expect(result.chordName).toBe("Dbmaj9");
    expect(result.startingDegree).toBe(9);
  });

  // Style keywords - new ones
  it("parses 'G7 drop 2'", () => {
    const result = parseChordDescription("G7 drop 2");
    expect(result.chordName).toBe("G7");
    expect(result.styleHint).toBe("drop 2");
  });

  it("parses 'G7 drop 2+4'", () => {
    const result = parseChordDescription("G7 drop 2+4");
    expect(result.chordName).toBe("G7");
    expect(result.styleHint).toBe("drop 2+4");
  });

  it("parses 'Cmaj7 spread'", () => {
    const result = parseChordDescription("Cmaj7 spread");
    expect(result.chordName).toBe("Cmaj7");
    expect(result.styleHint).toBe("spread");
  });

  it("parses 'G7 nestico'", () => {
    const result = parseChordDescription("G7 nestico");
    expect(result.chordName).toBe("G7");
    expect(result.styleHint).toBe("nestico");
  });

  it("parses 'Dm7 basie'", () => {
    const result = parseChordDescription("Dm7 basie");
    expect(result.chordName).toBe("Dm7");
    expect(result.styleHint).toBe("basie");
  });

  it("parses 'C7 ellington'", () => {
    const result = parseChordDescription("C7 ellington");
    expect(result.chordName).toBe("C7");
    expect(result.styleHint).toBe("ellington");
  });

  // Explicit notes list
  it("parses 'with notes C E G'", () => {
    const result = parseChordDescription("with notes C E G");
    expect(result.notesList).toEqual(["C", "E", "G"]);
    expect(result.notesHand).toBeUndefined();
  });

  it("parses 'with notes E4 G4 C5' with explicit octaves", () => {
    const result = parseChordDescription("with notes E4 G4 C5");
    expect(result.notesList).toEqual(["E4", "G4", "C5"]);
  });

  it("parses 'notes C E G in lh'", () => {
    const result = parseChordDescription("notes C E G in lh");
    expect(result.notesList).toEqual(["C", "E", "G"]);
    expect(result.notesHand).toBe("lh");
  });

  it("parses 'notes E G B in right hand'", () => {
    const result = parseChordDescription("notes E G B in right hand");
    expect(result.notesList).toEqual(["E", "G", "B"]);
    expect(result.notesHand).toBe("rh");
  });

  it("parses 'notes C E G in bottom hand' (alias for lh)", () => {
    const result = parseChordDescription("notes C E G in bottom hand");
    expect(result.notesList).toEqual(["C", "E", "G"]);
    expect(result.notesHand).toBe("lh");
  });

  it("parses 'notes E G B in top hand' (alias for rh)", () => {
    const result = parseChordDescription("notes E G B in top hand");
    expect(result.notesList).toEqual(["E", "G", "B"]);
    expect(result.notesHand).toBe("rh");
  });

  it("parses 'with notes Bb Eb Ab' (flats)", () => {
    const result = parseChordDescription("with notes Bb Eb Ab");
    expect(result.notesList).toEqual(["Bb", "Eb", "Ab"]);
  });

  it("parses 'with notes C E G' alongside chord ('Cmaj7 with notes E G B C')", () => {
    const result = parseChordDescription("Cmaj7 with notes E G B C");
    expect(result.chordName).toBe("Cmaj7");
    expect(result.notesList).toEqual(["E", "G", "B", "C"]);
  });

  it("doesn't confuse 'with note names' with notes list", () => {
    const result = parseChordDescription("Cmaj7 with note names");
    expect(result.showNoteNames).toBe(true);
    expect(result.notesList).toBeUndefined();
  });

  it("parses 'notes C E G' followed by 'compact' (terminator)", () => {
    const result = parseChordDescription("with notes C E G compact");
    expect(result.notesList).toEqual(["C", "E", "G"]);
    expect(result.format).toBe("compact");
  });
});
