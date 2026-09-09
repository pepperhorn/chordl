import { describe, it, expect } from "vitest";
import { VEROVIO_FONT_ZIPS } from "../src/verovio-fonts.generated";

/**
 * The font zips are committed build output, embedded as base64 and handed to
 * Verovio's `fontAddCustom`. Nothing else in the suite looks at them, so a bad
 * regeneration would only surface as blank notation in a browser.
 *
 * These assertions are on the archive, not on Verovio: loading the toolkit
 * costs a 7.9 MB WASM instantiation and no test in this package pays that.
 */

/** Minimal zip central-directory reader — enough to list entry names. */
function entryNames(base64: string): string[] {
  const buf = Buffer.from(base64, "base64");
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(eocd, "end-of-central-directory signature").toBeGreaterThan(-1);
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(at)).toBe(0x02014b50); // central file header
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    names.push(buf.toString("utf8", at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

describe("bundled Verovio font zips", () => {
  const fonts = Object.keys(VEROVIO_FONT_ZIPS);

  it("ships exactly the two fonts the renderer offers", () => {
    expect(fonts.sort()).toEqual(["Bravura", "Petaluma"]);
  });

  for (const font of ["Bravura", "Petaluma"] as const) {
    describe(font, () => {
      const names = entryNames(VEROVIO_FONT_ZIPS[font]);

      it("carries the bounding-box file Verovio looks for by name", () => {
        expect(names).toContain(`${font}.xml`);
      });

      it("carries a per-glyph path file for the glyphs a chord needs", () => {
        // A treble clef, a whole notehead, a sharp and a flat — enough that a
        // truncated archive cannot pass.
        for (const code of ["E050", "E0A2", "E262", "E260"]) {
          expect(names, code).toContain(`${font}/${code}.xml`);
        }
        expect(names.filter((n) => n.startsWith(`${font}/`)).length).toBeGreaterThan(500);
      });

      it("does not carry the @font-face CSS", () => {
        // Dropped deliberately: every glyph is drawn as a <use> of an embedded
        // path, so no output references that face, and it was ~193 KB of base64
        // across both fonts. See scripts/build-verovio-fonts.mjs.
        expect(names).not.toContain(`${font}.css`);
      });
    });
  }
});
