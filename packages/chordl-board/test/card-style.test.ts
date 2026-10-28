import { describe, it, expect } from "vitest";
import { normalizeCardStyle, cardStyleChordProps, cardStyleRenderConfig } from "../src/cardStyle";

describe("card style", () => {
  it("keeps a full valid style", () => {
    const s = { theme: "crf", showNoteNames: true, noteNameSize: "xl", noteNameMode: "midi" };
    expect(normalizeCardStyle(s)).toEqual(s);
    expect(normalizeCardStyle(s)).not.toBe(s);
  });
  it("returns {} for anything that is not an object", () => {
    for (const v of [undefined, null, "crf", '{"theme":"crf"}', 5, true, ["crf"]]) expect(normalizeCardStyle(v)).toEqual({});
  });
  it("drops anything it does not recognise", () => {
    const out = normalizeCardStyle({ theme: "CRF", showNoteNames: "true", noteNameSize: "xxl", noteNameMode: "degree", colour: "red" });
    expect(out).toEqual({});
    expect(Object.keys(out)).toEqual([]);
    expect(normalizeCardStyle({ theme: "rainbow" })).toEqual({});
    expect(normalizeCardStyle({ showNoteNames: false })).toEqual({ showNoteNames: false });
  });
  it("never writes undefined keys", () => {
    expect(Object.keys(normalizeCardStyle({ theme: "boomwhacker", noteNameSize: undefined }))).toEqual(["theme"]);
  });
  it("maps simple to no theme prop", () => {
    expect(cardStyleChordProps({ theme: "simple", showNoteNames: true })).toEqual({ showNoteNames: true });
    expect(cardStyleChordProps({ theme: "crf" })).toEqual({ theme: "crf" });
  });
  it("gives guitar, staff-only and text cards no render config", () => {
    const s = { theme: "crf", showNoteNames: true } as const;
    expect(cardStyleRenderConfig({ id: "g", nl: "C", display: "guitar" }, s)).toEqual({});
    expect(cardStyleRenderConfig({ id: "s", nl: "C", display: "staff" }, s)).toEqual({});
    expect(cardStyleRenderConfig({ id: "t", kind: "text", title: "x" }, s)).toEqual({});
    expect(cardStyleRenderConfig({ id: "b", nl: "C", display: "both" }, s)).toEqual(s);
  });
});
