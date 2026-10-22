import { describe, it, expect, vi } from "vitest";
import { loadTheme } from "./theme-fixture";

/**
 * chordcards tested "no top-3 shape" with C#, which chordl-guitar's presets
 * now cover — every supported root/suffix has a shape, so the branch has no
 * real input left. The lookup is stubbed to miss so the error stays pinned.
 */
vi.mock("@pepperhorn/chordl-guitar", async (importOriginal) => {
  const real = await importOriginal<typeof import("@pepperhorn/chordl-guitar")>();
  return { ...real, lookupTop3Chord: () => undefined };
});

const { requestFor } = await import("../src/faces");

describe("a chord with no top-3 preset", () => {
  it("throws naming the chord", () => {
    expect(() => requestFor("C#", "guitar-top3", loadTheme())).toThrow(
      /no top-3 shape for "C#"/,
    );
  });
});
