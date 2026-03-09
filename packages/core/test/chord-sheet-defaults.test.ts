import { describe, it, expect } from "vitest";
import { resolveDefaults, chordRef, SYSTEM_DEFAULTS } from "../src/chord-sheet/defaults";

describe("resolveDefaults", () => {
  it("returns system defaults when no overrides given", () => {
    const result = resolveDefaults();
    expect(result).toEqual(SYSTEM_DEFAULTS);
  });

  it("sheet defaults override system defaults", () => {
    const result = resolveDefaults({ display: "staff", scale: 0.8 });
    expect(result.display).toBe("staff");
    expect(result.scale).toBe(0.8);
    expect(result.format).toBe("compact"); // system default preserved
  });

  it("section defaults override sheet defaults", () => {
    const result = resolveDefaults(
      { display: "staff", scale: 0.8 },
      { display: "both", padding: 2 },
    );
    expect(result.display).toBe("both");
    expect(result.scale).toBe(0.8);   // sheet preserved
    expect(result.padding).toBe(2);   // section override
  });

  it("chord overrides override section defaults", () => {
    const result = resolveDefaults(
      { display: "staff" },
      { padding: 2 },
      { display: "keyboard", highlightColor: "#ff0000" },
    );
    expect(result.display).toBe("keyboard"); // chord wins
    expect(result.padding).toBe(2);          // section preserved
    expect(result.highlightColor).toBe("#ff0000");
  });

  it("undefined values don't clobber lower-priority values", () => {
    const result = resolveDefaults(
      { display: "staff", scale: 0.8 },
      { display: undefined, scale: undefined, padding: 3 },
    );
    expect(result.display).toBe("staff"); // not clobbered
    expect(result.scale).toBe(0.8);       // not clobbered
    expect(result.padding).toBe(3);
  });
});

describe("chordRef", () => {
  it("returns plain number for single section", () => {
    expect(chordRef(0, 0, 1)).toBe("1");
    expect(chordRef(0, 2, 1)).toBe("3");
  });

  it("returns letter + number for multiple sections", () => {
    expect(chordRef(0, 0, 3)).toBe("A1");
    expect(chordRef(1, 2, 3)).toBe("B3");
    expect(chordRef(2, 0, 3)).toBe("C1");
  });

  it("uses explicit section ID when provided", () => {
    expect(chordRef(0, 1, 2, "X")).toBe("X2");
    expect(chordRef(1, 0, 2, "intro")).toBe("intro1");
  });
});
