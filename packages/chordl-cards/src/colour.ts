/**
 * Colour arithmetic shared by the theme validator and anything that draws the
 * theme's motifs (the root-colour sheen, the groove fingerprint).
 *
 * Two operations, matching what the two media actually do:
 *
 * - `mixOklab(a, b, t)` is CSS `color-mix(in oklab, a, b t)`: the site draws
 *   the sheen's stops with it, and print should compute the same stop colours
 *   from it, so a gradient reads alike on paper and on screen.
 * - `over(fg, bg, alpha)` is plain sRGB alpha compositing: what a browser does
 *   with `fill-opacity` / an alpha colour, and what the card's 70% full-name
 *   line does on the ground.
 *
 * Contrast is WCAG 2.x relative luminance, the same formula chordcards'
 * src/highlight.ts and the site's tokens.test use.
 */

type Rgb = [number, number, number];

function rgbOf(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function hexOf(rgb: Rgb): string {
  return (
    "#" +
    rgb
      .map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const toGamma = (v: number) =>
  255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055);

function toOklab(hex: string): Rgb {
  const [r, g, b] = rgbOf(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, a, b]: Rgb): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return hexOf([
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]);
}

/** CSS `color-mix(in oklab, a, b <t>)`: `t` (0..1) of `b`, the rest `a`. */
export function mixOklab(a: string, b: string, t: number): string {
  if (t <= 0) return a.toLowerCase();
  const A = toOklab(a);
  const B = toOklab(b);
  return fromOklab([0, 1, 2].map((i) => A[i] * (1 - t) + B[i] * t) as Rgb);
}

/** `fg` at `alpha` (0..1) composited over an opaque `bg`, in sRGB. */
export function over(fg: string, bg: string, alpha: number): string {
  const f = rgbOf(fg);
  const b = rgbOf(bg);
  return hexOf(f.map((v, i) => v * alpha + b[i] * (1 - alpha)) as Rgb);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
