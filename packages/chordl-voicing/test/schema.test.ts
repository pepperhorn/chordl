import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateChordFileSchema, chordSchema, voicingSchema } from "../src/index.js";

const load = (): any => JSON.parse(readFileSync(new URL("./fixtures/cmaj7.json", import.meta.url), "utf8"));
const voicing = (d: any) => d.voicings[0];

function expectInvalid(data: unknown) {
  const r = validateChordFileSchema(data);
  expect(r.ok).toBe(false);
  return r.ok ? [] : r.errors;
}

describe("validateChordFileSchema", () => {
  it("accepts the Cmaj7 guitar example", () => {
    const r = validateChordFileSchema(load());
    expect(r.ok).toBe(true);
  });

  it("exports both schemas", () => {
    expect(chordSchema.title).toBe("chordl.chord/1");
    expect(voicingSchema.title).toBe("chordl.voicing/1");
  });

  it("rejects voicings: []", () => {
    const d = load();
    d.voicings = [];
    const errors = expectInvalid(d);
    expect(errors.some((e) => e.path === "/voicings")).toBe(true);
  });

  it('rejects unknown realization kind "harp"', () => {
    const d = load();
    voicing(d).realization.kind = "harp";
    expectInvalid(d);
  });

  it('rejects status "held" and tier "gold"', () => {
    const a = load();
    voicing(a).status = "held";
    expectInvalid(a);
    const b = load();
    voicing(b).tier = "gold";
    expectInvalid(b);
  });

  it('rejects pitch "E♭4" with a message containing "Eb4"', () => {
    const d = load();
    voicing(d).notes[0].pitch = "E♭4";
    const errors = expectInvalid(d);
    expect(errors.some((e) => e.message.includes("Eb4"))).toBe(true);
  });

  it('rejects id "v_123"', () => {
    const d = load();
    voicing(d).id = "v_123";
    expectInvalid(d);
  });

  it("rejects a displayName or email property anywhere", () => {
    const a = load();
    voicing(a).provenance.displayName = "Someone";
    expectInvalid(a);
    const b = load();
    voicing(b).provenance.email = "a@b.com";
    expectInvalid(b);
    const c = load();
    c.chord.displayName = "x";
    expectInvalid(c);
  });

  it("allows chord.bass to be a string and level to be omitted", () => {
    const d = load();
    d.chord.bass = "E";
    delete voicing(d).level;
    expect(validateChordFileSchema(d).ok).toBe(true);
  });
});
