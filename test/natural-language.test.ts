import { describe, it, expect } from "vitest";
import { parseChordDescription } from "../src/parser/natural-language";

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
});
