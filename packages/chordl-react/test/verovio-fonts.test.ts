import { describe, it, expect } from "vitest";
import { VEROVIO_FONT_ZIPS } from "../src/verovio-fonts.generated";

/**
 * The font zips are committed build output, embedded as base64 and handed to
 * Verovio's `fontAddCustom`. Nothing else in the suite looks at them, so a bad
 * regeneration would only surface as blank notation in a browser.
 *
 * These assertions read the archive directly rather than loading the toolkit:
 * that costs a 7.9 MB WASM instantiation and no test in this package pays it.
 */

interface ZipEntry {
  name: string;
  /** Uncompressed byte length, from the central directory. */
  size: number;
  crc: number;
}

/** Minimal zip central-directory reader — enough to list entries and their sizes. */
function entries(base64: string): ZipEntry[] {
  const buf = Buffer.from(base64, "base64");
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(eocd, "end-of-central-directory signature").toBeGreaterThan(-1);
  const count = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  const out: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(at)).toBe(0x02014b50); // central file header
    const nameLen = buf.readUInt16LE(at + 28);
    const extraLen = buf.readUInt16LE(at + 30);
    const commentLen = buf.readUInt16LE(at + 32);
    out.push({
      crc: buf.readUInt32LE(at + 16),
      size: buf.readUInt32LE(at + 24),
      name: buf.toString("utf8", at + 46, at + 46 + nameLen),
    });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

describe("bundled Verovio font zips", () => {
  it("ships exactly the two fonts the renderer offers", () => {
    expect(Object.keys(VEROVIO_FONT_ZIPS).sort()).toEqual(["Bravura", "Petaluma"]);
  });

  for (const font of ["Bravura", "Petaluma"] as const) {
    describe(font, () => {
      const all = entries(VEROVIO_FONT_ZIPS[font]);
      const byName = new Map(all.map((e) => [e.name, e]));

      it("carries the bounding-box file Verovio looks for by name", () => {
        expect(byName.get(`${font}.xml`)?.size).toBeGreaterThan(10_000);
      });

      it("carries a per-glyph path file for the glyphs the renderer needs", () => {
        // Treble and bass clef (mei-builder picks between them per chord),
        // a whole notehead, a sharp and a flat.
        for (const code of ["E050", "E062", "E0A2", "E262", "E260"]) {
          expect(byName.has(`${font}/${code}.xml`), code).toBe(true);
        }
        expect(all.filter((e) => e.name.startsWith(`${font}/`)).length).toBeGreaterThan(500);
      });

      it("has no empty entries", () => {
        /*
         * The real regeneration hazard, and the one a name-only check misses.
         * `build-verovio-fonts.mjs` writes whatever `fetchText` returns for each
         * of ~880 glyph URLs, so a 200 with an empty or truncated body produces
         * a zero-byte `<Font>/E050.xml`: the entry name is present, the archive
         * is valid, and notation renders with glyphs missing.
         *
         * (A genuinely truncated *archive* loses its trailing central directory
         * and fails in `entries` above, before any of this.)
         */
        const empty = all.filter((e) => e.size === 0 || e.crc === 0);
        expect(empty.map((e) => e.name)).toEqual([]);
      });

      it("carries a stub CSS rather than the upstream woff2 one", () => {
        /*
         * Verovio reads `<Font>.css` when registering a custom font and logs an
         * error on every toolkit init if it is absent, so the entry has to
         * exist. The upstream file is an @font-face wrapping ~80-102 KB of
         * base64 woff2 that nothing here consumes — every glyph is drawn as a
         * <use> of an embedded path. The stub keeps that saving and stays quiet.
         */
        const css = byName.get(`${font}.css`);
        expect(css, `${font}.css must be present`).toBeDefined();
        expect(css!.size).toBeLessThan(2_000);
      });
    });
  }
});
