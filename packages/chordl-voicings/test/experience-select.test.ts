import { describe, it, expect } from "vitest";
import { selectVoicingsForExperience } from "../src/experience.js";
import type { VoicingVariant } from "../src/types.js";

const v = (id: string, level: "beginner" | "emerging" | "established"): VoicingVariant =>
  ({ id, label: id, notes: ["C"], source: "library", level });

describe("selectVoicingsForExperience", () => {
  it("matches cumulatively — a rung includes everything below it", () => {
    const vs = [v("a", "beginner"), v("b", "emerging"), v("c", "established")];
    expect(selectVoicingsForExperience(vs, "established").indices).toEqual([0, 1, 2]);
    expect(selectVoicingsForExperience(vs, "emerging").indices).toEqual([0, 1]);
    expect(selectVoicingsForExperience(vs, "beginner").indices).toEqual([0]);
  });

  it("widens one rung and says so rather than returning nothing", () => {
    const vs = [v("a", "emerging"), v("b", "established")];
    const sel = selectVoicingsForExperience(vs, "beginner");
    expect(sel.indices).toEqual([0]);
    expect(sel.level).toBe("emerging");
    expect(sel.widenedFrom).toBe("beginner");
  });

  it("widens as far as it must, still one rung at a time", () => {
    const vs = [v("a", "established")];
    const sel = selectVoicingsForExperience(vs, "beginner");
    expect(sel.indices).toEqual([0]);
    expect(sel.level).toBe("established");
    expect(sel.widenedFrom).toBe("beginner");
  });

  it("never widens when the requested rung already matched", () => {
    const vs = [v("a", "beginner")];
    expect(selectVoicingsForExperience(vs, "beginner").widenedFrom).toBeUndefined();
  });

  it("returns indices into the array it was handed", () => {
    const vs = [v("a", "established"), v("b", "beginner"), v("c", "established")];
    expect(selectVoicingsForExperience(vs, "beginner").indices).toEqual([1]);
  });

  it("survives an empty list", () => {
    expect(selectVoicingsForExperience([], "beginner").indices).toEqual([]);
  });

  it("treats a variant with no level as established", () => {
    // An older persisted variant, or one from a source that did not rank it.
    const vs = [{ id: "x", label: "x", notes: ["C"], source: "inversion" } as VoicingVariant];
    expect(selectVoicingsForExperience(vs, "beginner").level).toBe("established");
  });
});
