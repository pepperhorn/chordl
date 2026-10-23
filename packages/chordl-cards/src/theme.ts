/**
 * Card theme: every colour, size and font the printed deck uses, in one file.
 *
 * Moved here from chordcards (src/theme.ts) so the print pipeline and the web
 * player read one schema, and the theme file itself lives here too:
 * `themes/crf-default.json` in this package, exported as
 * `@pepperhorn/chordl-cards/themes/crf-default.json`. chordcards and the chords
 * site both import it; neither keeps a copy. Other file paths in the comments
 * below (src/card.ts, src/highlight.ts, ...) are chordcards' own. Additions
 * over print's schema are optional blocks: `playback` (web player only) and
 * the brand motifs `paper` / `contrast` / `groove` (fingerprint, ambient,
 * skeleton) / `gradient` (rules in this package's DESIGN.md). A theme without
 * them parses exactly as before.
 *
 * The theme is loaded from JSON (`themes/crf-default.json`) rather than being
 * spread across `src/palette.ts`, `src/card.ts` and `src/render-host/entry.tsx`
 * as literals. Two reasons that matters for a print pipeline: a colour change
 * becomes reviewable as a diff in one place, and the JSON can be handed to a
 * designer who does not read TypeScript.
 *
 * Nothing here is derived at load time. `themes/crf-default.json` lists all
 * twelve roots with every slot spelled out, so what is written in the file is
 * what prints — there is no rule to reverse-engineer when a card comes out
 * wrong.
 *
 * ## The colorMode decision, and the root-tone collision
 *
 * `keyboard.colorMode` and `fret.colorMode` each take:
 *
 * - `"pitch"` — every chord tone is coloured by its OWN pitch from the CRF
 *   palette. This is chordl's native `theme="crf"` behaviour on the keyboard.
 * - `"single"` — every tone on a card takes one colour, `roots[root].*`.
 *
 * `"pitch"` has a consequence that is not obvious and cannot be fixed by
 * choosing different colours: **a card's background is its root's CRF colour,
 * so in pitch mode the root tone is filled with exactly the card background —
 * a 1.00:1 contrast ratio, on every one of the twenty cards.** The root is the
 * note a beginner most needs to find.
 *
 * That is why `fret.circleStrokeColor`/`circleStrokeWidth` exist and are not
 * optional in pitch mode: svguitar draws finger markers with no border by
 * default, so an unstroked root circle vanishes into the card completely. The
 * keyboard is less exposed — chordl already strokes every key — but a root key
 * still reads as a cut-out showing the card through rather than as a
 * highlight.
 *
 * Whether that reads as a bug or as a feature ("the card IS the root") is a
 * design call for a printed proof, not something to settle in code. Both modes
 * are therefore supported and switchable, and neither is silently corrected.
 */

import { contrastRatio, mixOklab, over } from "./colour";

export type ColorMode = "pitch" | "single";
export type KeyboardFormat = "compact" | "exact";

export type FontFamilyKey = "display" | "mono" | "ui";
export type FontStyle = "normal" | "italic";

export interface FontSpec {
  /** Key into `fonts.families`, not a raw CSS family list. */
  family: FontFamilyKey;
  size: number;
  weight: number;
  style: FontStyle;
  /**
   * The template makes its own outline by drawing the glyph twice: a larger
   * copy in ink behind, then the fill on top. Present on `titleRoot`, where
   * the measured pair is 113.9pt behind 110.6pt. A plain stroke is not the
   * same shape — it thickens every contour rather than offsetting the
   * silhouette.
   */
  outlineSize?: number;
  /**
   * The template's labels sit over a copy of themselves offset down-right in
   * ink, i.e. a hard drop shadow rather than a stroke. Measured at +1.4pt for
   * the keyboard note names and +0.9pt for the string labels.
   */
  shadowOffset?: number;
  /**
   * A true ink stroke behind the fill, via `paint-order: stroke` — the deck's
   * standard note-text treatment. This replaced `outlineSize` on the title:
   * the enlarged-copy trick scales the glyph from its baseline anchor, so with
   * a heavy face (Poppins Bold) the copy hides behind the fill and peeks out
   * only above the cap. A stroke follows every contour evenly. Renders
   * correctly because this pipeline prints through Chromium, which honours
   * `paint-order`; renderers that ignore it (svg2pdf.js) would need the
   * three-pass emulation instead.
   *
   * Precedence when several treatments are set: strokeWidth, then outlineSize,
   * then shadowOffset — see src/card.ts's themedText.
   */
  strokeWidth?: number;
  /** Fill strength 0..1, printed as `fill-opacity`; absent means solid. */
  opacity?: number;
  /**
   * How a run's sharps and flats are set (print's title root reads it):
   * "full" (default) letter-sized on the baseline, or "raised" — the
   * chord-chart convention, ~62% size hung from cap height.
   */
  accidental?: "full" | "raised";
}

/**
 * The deck's type system: Poppins throughout (Bold for the root letter,
 * SemiBold for every label), set in ink on the saturated card grounds.
 *
 * This deliberately departs from the original template, which set Big
 * Shoulders Display for the letter and Roboto Mono Italic in white for the
 * labels. Two reasons, both from the 2026-08 design review: white mono
 * fails on the light grounds (1.13:1 on E's yellow — illegible), and the
 * condensed-grotesk/mono/geometric three-family mix had no relationship.
 * Ink Poppins clears every background in the palette at 6.1:1 (C) to
 * 15.3:1 (E). The template's measured faces remain in git history and in
 * src/export.ts's FONT_FACES, so a theme can still reach them by family key.
 *
 * The embedded faces are static weights (see FONT_FACES), but Big Shoulders
 * is variable with a `wght` default of 100, so `weight` stays load-bearing
 * for any theme that uses the `display` family — see src/card.ts fontAttrs.
 */
export interface ThemeFonts {
  families: Record<FontFamilyKey, string>;
  titleRoot: FontSpec;
  titleQuality: FontSpec;
  /** The chord's spelled-out name ("F sharp minor seventh"), small under the title. */
  titleFullName: FontSpec;
  badge: FontSpec;
  fretFingerText: FontSpec;
  keyboardNoteText: FontSpec;
  keyboardHandText: FontSpec;
  stringLabel: FontSpec;
}

export interface ThemeKeyboard {
  /** "exact" = true piano proportions (120pt white keys); "compact" = 65pt. */
  format: KeyboardFormat;
  whiteKeys: number;
  minContextKeys: number;
  /**
   * How far the keyboard overhangs each card edge, in points, before the card's
   * rounded background masks it. 0 renders the keyboard flush to both edges;
   * a positive value cuts the outermost keys off, which is the template's look.
   */
  bleed: number;
  colorMode: ColorMode;
  textColor: string;
  textStroke: string;
  textStrokeWidth: number;
}

export interface ThemeFret {
  colorMode: ColorMode;
  /** Not optional in pitch mode — see this module's doc comment. */
  circleStrokeColor: string;
  circleStrokeWidth: number;
  diagramColor: string;
  /**
   * The plate the fret diagram is drawn on.
   *
   * The frame is line art in `diagramColor` (near-black) carrying finger dots
   * filled by pitch. On a bare card both fail in pitch mode: the grid competes
   * with a saturated background, and the root's dot is the card's own colour,
   * so it disappears entirely — the collision this module's doc comment
   * describes. A plate under the artwork gives every card the same known
   * ground, which is the only way the dots read at a fixed contrast rather
   * than one that varies by root.
   *
   * `panelPadding` is measured outward from the *fitted artwork's* bounds, not
   * from `geometry.diagramBox` — the frame is fitted preserving aspect, so it
   * rarely fills the box on both axes and a box-sized plate would sit visibly
   * off-centre.
   *
   * `panelStrokeWidth` and `panelShadowOffset` are the plate's "sticker"
   * finish: an ink outline plus a hard ink copy offset down-right. A bare
   * white rectangle read as unfinished because nothing tied it to the card's
   * visual language — the double draw is the same technique the deck's type
   * already uses, which is what makes the plate belong.
   */
  panelFill: string;
  panelPadding: number;
  panelRadius: number;
  panelStrokeWidth: number;
  panelShadowOffset: number;
}

/**
 * The rounded white chip behind the QR code.
 *
 * Two jobs: it finishes the QR the way the plate finishes the diagram (the
 * bare code floated as a raw square before), and it is a *printed, guaranteed
 * quiet zone* — the scanning margin no longer depends on what colour the card
 * behind the code happens to be. `padding` is that quiet zone, in points,
 * around the fixed 15mm code.
 */
export interface ThemeQrChip {
  fill: string;
  padding: number;
  radius: number;
  /** Ink outline; matches the plate's sticker language. */
  strokeWidth: number;
}

/**
 * ## The logo is no longer a theme setting
 *
 * There used to be a `logoVariant` here, choosing between a `knockout` lockup
 * (white wordmark, unreadable on all twelve of this palette's pastels — 2.82:1
 * at best) and a `colour` one (near-black, 6.14:1 to 15.29:1, so it won). The
 * replacement artwork is a single lockup drawn for coloured grounds, which
 * leaves nothing to choose; see `crfLogo` in src/art.ts.
 */

export interface PitchEntry {
  hex: string;
  cmyk: [number, number, number, number];
}

export interface RootEntry {
  background: string;
  titleHighlight: string;
  /** Used when `fret.colorMode` is "single". */
  fretCircle: string;
  fretCircleStroke: string;
  fretFingerText: string;
  /** Used when `keyboard.colorMode` is "single". */
  keyboardHighlight: string;
  keyboardText: string;
}

/**
 * Web-player defaults. Optional: print has no use for them, and a theme that
 * omits the block parses to an object without a `playback` key at all, so a
 * request hashed from it is unchanged.
 */
export interface ThemePlayback {
  /** Default arpeggio tempo, an integer 40-300 (chordl-core's bounds). */
  arpeggioBpm?: number;
  /** Colour of the transient "now sounding" paint. */
  highlightColor?: string;
}

/**
 * Text contrast floors (WCAG 2.x ratios). Rules that read colours the theme
 * does not spell out per root (the gradient's stops, below) are checked
 * against these at load, so a stronger sheen cannot ship below them.
 */
export interface ThemeContrast {
  /** Body text: 4.5. */
  body: number;
  /** Large text (`largeTextPx` and up): 3. */
  large: number;
  /** The size, in CSS px, from which `large` applies (24). */
  largeTextPx: number;
  /**
   * Ink at this opacity (0.7, the card's full-name line) is large-text only:
   * it must clear `large`, never `body`.
   */
  mutedInkOpacity: number;
}

/**
 * A colour named by role, so one motif definition serves both media: `ink` is
 * `theme.ink`, `paper` is `theme.paper` (white stock on a card; on the site
 * the light ground, or the shell's off-white text on the dark shell), `root`
 * the chord's root colour (`roots[root].background`).
 */
export type ColourRef = "ink" | "paper" | "root";

/** A length in both media: screen CSS px and print points. */
export interface DualLength {
  px: number;
  /** Absent for screen-only layers. */
  pt?: number;
}

/** One ground a groove can sit on: what the lines are drawn in, how strongly. */
export interface GrooveInk {
  colour: ColourRef;
  /** Groove line strength, 0..1 (alpha on light/dark, an oklab mix on root). */
  line: number;
  /** Label disc strength, 0..1. */
  label?: number;
  /** The light catch a spinning groove shows, 0..1 (screen only). */
  sheen?: number;
}

/** Where a groove's centre sits, as fractions of the surface (may lie outside 0..1). */
export interface GroovePreset {
  x: number;
  y: number;
}

export interface GrooveSpin {
  /** Seconds per full turn when spinning (screen only; print is static). */
  secondsPerTurn: number;
  /** Whether a surface spins unless asked otherwise. */
  default: "static" | "spinning";
}

/**
 * The groove fingerprint: a 45's grooves, label and spindle as a big partial
 * circle bleeding off an edge or corner. See DESIGN.md "Groove fingerprint".
 */
export interface ThemeGrooveFingerprint {
  /** Centre-to-centre distance between groove lines. */
  ringPitch: DualLength;
  /** Groove line thickness; `pt` is floored at MIN_PRINT_STROKE_PT. */
  stroke: DualLength;
  /** Grooves fade out from this fraction of the radius to the edge (0.82). */
  fadeFrom: number;
  /**
   * The label, as fractions of the record's radius, innermost first: the
   * spindle hole, its rim, the label disc's edge, the label rim's edge.
   */
  label?: { hole: number; holeRim: number; radius: number; rim: number };
  grounds: { light: GrooveInk; dark: GrooveInk };
  /** Record radius per size, screen rem (print sizes against the card in the proposal). */
  sizes: { sm: number; md: number; lg: number };
  presets: Record<string, GroovePreset>;
  defaultPreset: string;
  spin: GrooveSpin;
}

/**
 * The big record turning behind a root-colour surface (screen only): coarser,
 * elliptical grooves tone-on-tone, masked to a ring.
 */
export interface ThemeGrooveAmbient {
  ringPitch: DualLength;
  stroke: DualLength;
  /** Vertical radius over horizontal (0.92: "ellipse 50% 46%"). */
  aspect: number;
  grounds: { root: GrooveInk; dark: GrooveInk };
  /** Ring mask, fractions of the radius: grooves fade in innerFrom→innerTo, out outerFrom→1. */
  mask: { innerFrom: number; innerTo: number; outerFrom: number };
  spin: GrooveSpin;
}

/**
 * The loading skeleton (screen only): a placeholder in a card's footprint,
 * fine grooves and a passing shimmer until the image or batch arrives. Drawn
 * in the surrounding text colour (CSS `currentColor`), so one skeleton reads
 * on the dark shell and on a root band. See DESIGN.md "Loading skeleton".
 */
export interface ThemeGrooveSkeleton {
  ringPitch: DualLength;
  stroke: DualLength;
  /** Groove centre, fractions of the placeholder (0.5, 0.6: a little below the middle). */
  centre: GroovePreset;
  /** Placeholder ground: the surrounding text colour at this strength, 0..1. */
  fill: number;
  /** Groove line: the surrounding text colour at this strength, 0..1. */
  line: number;
  /** A card image's frame while it loads: its root colour mixed this far toward the dark ground (the site shell), 0..1. */
  frame: number;
  /**
   * A light band sweeping across once per `seconds` (UI feedback speed, not an
   * ambient loop): `colour` at `strength`, a linear gradient at `angle`
   * degrees, transparent at `from` and `to`, full at `peak` (fractions).
   */
  shimmer: { colour: ColourRef; strength: number; angle: number; from: number; peak: number; to: number; seconds: number };
}

export interface ThemeGroove {
  fingerprint: ThemeGrooveFingerprint;
  ambient?: ThemeGrooveAmbient;
  skeleton?: ThemeGrooveSkeleton;
}

/** One gradient stop: the root colour mixed `amount` toward ink or paper, in oklab. */
export interface GradientStop {
  /** Position along the gradient line, 0..1. */
  at: number;
  toward: "ink" | "paper";
  /** 0 is the root colour itself (CSS draws it as `transparent` over the root ground). */
  amount: number;
}

/**
 * The root-colour sheen: a broad linear gradient relative to the root colour,
 * plus an optional counter highlight. Every point keeps ink at
 * `contrast.body` and muted ink at `contrast.large` on every root — enforced
 * by parseTheme.
 */
export interface ThemeGradient {
  /** CSS degrees (105: light from the upper left, travelling right). */
  angle: number;
  stops: GradientStop[];
  /** A soft radial highlight, fractions of its layer: centre, radius, and its mix. */
  counterHighlight?: { x: number; y: number; radius: number; toward: "paper"; amount: number };
  /** Screen only: the sheen drifts `travel` (a fraction of its width) each way per cycle. */
  drift?: { secondsPerCycle: number; travel: number; overscan: number };
}

export interface Theme {
  name: string;
  description: string;
  ink: string;
  /** White stock / the light ground. Required by `groove` and `gradient`. */
  paper?: string;
  contrast?: ThemeContrast;
  groove?: ThemeGroove;
  gradient?: ThemeGradient;
  fonts: ThemeFonts;
  keyboard: ThemeKeyboard;
  fret: ThemeFret;
  qrChip: ThemeQrChip;
  pitches: Record<string, PitchEntry>;
  roots: Record<string, RootEntry>;
  playback?: ThemePlayback;
}

/** The twelve pitch classes every theme must cover. */
const REQUIRED_PITCHES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

/**
 * The one spelling of "a colour" this pipeline accepts, exported because a
 * theme is not the only file an operator writes colours into.
 *
 * Six digits and nothing else — no `#rgb`, no `rgba()`, no CSS names. That is
 * narrower than SVG allows on purpose: every colour here ends up in printed
 * artwork AND in src/highlight.ts's contrast arithmetic, whose
 * `relativeLuminance` slices the string into three byte pairs and would read a
 * shorthand or a name as NaN. src/manifest.ts applies the same regex to a
 * deck's `highlightColor` so the two files an operator hand-edits agree on
 * what a colour looks like, and disagree with the same message.
 */
export const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

function fail(where: string, msg: string): never {
  throw new Error(`theme ${where}: ${msg}`);
}

function str(v: unknown, where: string): string {
  if (typeof v !== "string" || v === "") fail(where, "must be a non-empty string");
  return v;
}

function hex(v: unknown, where: string): string {
  const s = str(v, where);
  if (!HEX_COLOUR.test(s)) fail(where, `must be a 6-digit hex colour, got "${s}"`);
  return s;
}

function num(v: unknown, where: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(where, "must be a finite number");
  return v;
}

function unit(v: unknown, where: string): number {
  const n = num(v, where);
  if (n < 0 || n > 1) fail(where, "must be between 0 and 1");
  return n;
}

function colorMode(v: unknown, where: string): ColorMode {
  if (v !== "pitch" && v !== "single") {
    fail(where, `must be "pitch" or "single", got ${JSON.stringify(v)}`);
  }
  return v;
}

function font(v: unknown, where: string): FontSpec {
  const o = obj(v, where);
  const family = o.family;
  if (family !== "display" && family !== "mono" && family !== "ui") {
    fail(`${where}.family`, `must be "display", "mono" or "ui", got ${JSON.stringify(family)}`);
  }
  const style = o.style;
  if (style !== "normal" && style !== "italic") {
    fail(`${where}.style`, `must be "normal" or "italic", got ${JSON.stringify(style)}`);
  }
  return {
    family,
    size: num(o.size, `${where}.size`),
    weight: num(o.weight, `${where}.weight`),
    style,
    ...(o.outlineSize === undefined ? {} : { outlineSize: num(o.outlineSize, `${where}.outlineSize`) }),
    ...(o.shadowOffset === undefined ? {} : { shadowOffset: num(o.shadowOffset, `${where}.shadowOffset`) }),
    ...(o.strokeWidth === undefined ? {} : { strokeWidth: num(o.strokeWidth, `${where}.strokeWidth`) }),
    ...(o.opacity === undefined ? {} : { opacity: unit(o.opacity, `${where}.opacity`) }),
    ...(o.accidental === undefined ? {} : { accidental: accidentalMode(o.accidental, `${where}.accidental`) }),
  };
}

function accidentalMode(v: unknown, where: string): "full" | "raised" {
  if (v !== "full" && v !== "raised") fail(where, `must be "full" or "raised", got ${JSON.stringify(v)}`);
  return v as "full" | "raised";
}

function obj(v: unknown, where: string): Record<string, unknown> {
  if (typeof v !== "object" || v === null || Array.isArray(v)) fail(where, "must be an object");
  return v as Record<string, unknown>;
}

/**
 * Parse and validate a theme.
 *
 * Every field is checked and every colour must be a literal hex — a typo'd or
 * missing colour throws here, at load, rather than rendering as `undefined`
 * and printing a black or transparent card face. This mirrors the rest of the
 * pipeline's failure policy: a build error costs minutes, a bad print run
 * costs the whole batch.
 */
export function parseTheme(json: unknown): Theme {
  const t = obj(json, "root");

  const fonts = obj(t.fonts, "fonts");
  const kb = obj(t.keyboard, "keyboard");
  const fret = obj(t.fret, "fret");

  const format = kb.format;
  if (format !== "compact" && format !== "exact") {
    fail("keyboard.format", `must be "compact" or "exact", got ${JSON.stringify(format)}`);
  }

  const whiteKeys = num(kb.whiteKeys, "keyboard.whiteKeys");
  const minContextKeys = num(kb.minContextKeys, "keyboard.minContextKeys");
  if (!Number.isInteger(whiteKeys) || whiteKeys < 1) {
    fail("keyboard.whiteKeys", "must be a positive integer");
  }
  if (!Number.isInteger(minContextKeys) || minContextKeys < 0) {
    fail("keyboard.minContextKeys", "must be a non-negative integer");
  }

  const pitchesRaw = obj(t.pitches, "pitches");
  const pitches: Record<string, PitchEntry> = {};
  for (const p of REQUIRED_PITCHES) {
    const e = obj(pitchesRaw[p], `pitches.${p}`);
    const cmyk = e.cmyk;
    if (!Array.isArray(cmyk) || cmyk.length !== 4 || cmyk.some((n) => typeof n !== "number")) {
      fail(`pitches.${p}.cmyk`, "must be four numbers [C, M, Y, K]");
    }
    pitches[p] = {
      hex: hex(e.hex, `pitches.${p}.hex`),
      cmyk: cmyk as [number, number, number, number],
    };
  }

  const rootsRaw = obj(t.roots, "roots");
  const roots: Record<string, RootEntry> = {};
  for (const r of REQUIRED_PITCHES) {
    const e = obj(rootsRaw[r], `roots.${r}`);
    roots[r] = {
      background: hex(e.background, `roots.${r}.background`),
      titleHighlight: hex(e.titleHighlight, `roots.${r}.titleHighlight`),
      fretCircle: hex(e.fretCircle, `roots.${r}.fretCircle`),
      fretCircleStroke: hex(e.fretCircleStroke, `roots.${r}.fretCircleStroke`),
      fretFingerText: hex(e.fretFingerText, `roots.${r}.fretFingerText`),
      keyboardHighlight: hex(e.keyboardHighlight, `roots.${r}.keyboardHighlight`),
      keyboardText: hex(e.keyboardText, `roots.${r}.keyboardText`),
    };
  }

  return {
    name: str(t.name, "name"),
    description: str(t.description, "description"),
    ink: hex(t.ink, "ink"),
    fonts: {
      families: {
        display: str(obj(fonts.families, "fonts.families").display, "fonts.families.display"),
        mono: str(obj(fonts.families, "fonts.families").mono, "fonts.families.mono"),
        ui: str(obj(fonts.families, "fonts.families").ui, "fonts.families.ui"),
      },
      titleRoot: font(fonts.titleRoot, "fonts.titleRoot"),
      titleQuality: font(fonts.titleQuality, "fonts.titleQuality"),
      titleFullName: font(fonts.titleFullName, "fonts.titleFullName"),
      badge: font(fonts.badge, "fonts.badge"),
      fretFingerText: font(fonts.fretFingerText, "fonts.fretFingerText"),
      keyboardNoteText: font(fonts.keyboardNoteText, "fonts.keyboardNoteText"),
      keyboardHandText: font(fonts.keyboardHandText, "fonts.keyboardHandText"),
      stringLabel: font(fonts.stringLabel, "fonts.stringLabel"),
    },
    keyboard: {
      format,
      whiteKeys,
      minContextKeys,
      bleed: num(kb.bleed, "keyboard.bleed"),
      colorMode: colorMode(kb.colorMode, "keyboard.colorMode"),
      textColor: hex(kb.textColor, "keyboard.textColor"),
      textStroke: str(kb.textStroke, "keyboard.textStroke"),
      textStrokeWidth: num(kb.textStrokeWidth, "keyboard.textStrokeWidth"),
    },
    fret: {
      colorMode: colorMode(fret.colorMode, "fret.colorMode"),
      circleStrokeColor: hex(fret.circleStrokeColor, "fret.circleStrokeColor"),
      circleStrokeWidth: num(fret.circleStrokeWidth, "fret.circleStrokeWidth"),
      diagramColor: hex(fret.diagramColor, "fret.diagramColor"),
      panelFill: hex(fret.panelFill, "fret.panelFill"),
      panelPadding: num(fret.panelPadding, "fret.panelPadding"),
      panelRadius: num(fret.panelRadius, "fret.panelRadius"),
      panelStrokeWidth: num(fret.panelStrokeWidth, "fret.panelStrokeWidth"),
      panelShadowOffset: num(fret.panelShadowOffset, "fret.panelShadowOffset"),
    },
    qrChip: (() => {
      const q = obj(t.qrChip, "qrChip");
      return {
        fill: hex(q.fill, "qrChip.fill"),
        padding: num(q.padding, "qrChip.padding"),
        radius: num(q.radius, "qrChip.radius"),
        strokeWidth: num(q.strokeWidth, "qrChip.strokeWidth"),
      };
    })(),
    pitches,
    roots,
    ...(t.playback === undefined ? {} : { playback: playback(t.playback) }),
    ...motifs(t, hex(t.ink, "ink"), roots),
  };
}

/**
 * The thinnest groove line print may carry, in points. Offset litho holds a
 * solid 0.25pt hairline; grooves are low-strength tints, which break up into
 * screen dots below that, so the floor is the solid hairline and the shipped
 * theme sits at twice it.
 */
export const MIN_PRINT_STROKE_PT = 0.25;

/** The slowest-allowed ambient loop floor, seconds: anything faster reads as UI motion. */
export const MIN_AMBIENT_SECONDS = 20;

function positive(v: unknown, where: string): number {
  const n = num(v, where);
  if (n <= 0) fail(where, "must be greater than 0");
  return n;
}

function colourRef(v: unknown, where: string): ColourRef {
  if (v !== "ink" && v !== "paper" && v !== "root") {
    fail(where, `must be "ink", "paper" or "root", got ${JSON.stringify(v)}`);
  }
  return v;
}

function dualLength(v: unknown, where: string, print: boolean): DualLength {
  const o = obj(v, where);
  const out: DualLength = { px: positive(o.px, `${where}.px`) };
  if (o.pt !== undefined) out.pt = positive(o.pt, `${where}.pt`);
  else if (print) fail(`${where}.pt`, "is required: this layer can print");
  return out;
}

function grooveInk(v: unknown, where: string): GrooveInk {
  const o = obj(v, where);
  return {
    colour: colourRef(o.colour, `${where}.colour`),
    line: unit(o.line, `${where}.line`),
    ...(o.label === undefined ? {} : { label: unit(o.label, `${where}.label`) }),
    ...(o.sheen === undefined ? {} : { sheen: unit(o.sheen, `${where}.sheen`) }),
  };
}

function spin(v: unknown, where: string): GrooveSpin {
  const o = obj(v, where);
  const secondsPerTurn = num(o.secondsPerTurn, `${where}.secondsPerTurn`);
  if (secondsPerTurn < MIN_AMBIENT_SECONDS) {
    fail(`${where}.secondsPerTurn`, `must be at least ${MIN_AMBIENT_SECONDS}s: ambient motion is slow`);
  }
  if (o.default !== "static" && o.default !== "spinning") {
    fail(`${where}.default`, `must be "static" or "spinning", got ${JSON.stringify(o.default)}`);
  }
  return { secondsPerTurn, default: o.default };
}

function ringStroke(pitch: DualLength, stroke: DualLength, where: string): void {
  if (stroke.px >= pitch.px) fail(`${where}.stroke.px`, "must be thinner than ringPitch.px");
  if (stroke.pt !== undefined && pitch.pt !== undefined && stroke.pt >= pitch.pt) {
    fail(`${where}.stroke.pt`, "must be thinner than ringPitch.pt");
  }
  if (stroke.pt !== undefined && stroke.pt < MIN_PRINT_STROKE_PT) {
    fail(`${where}.stroke.pt`, `must be at least ${MIN_PRINT_STROKE_PT}pt to print`);
  }
}

function ascending(values: number[], where: string, what: string): void {
  for (let i = 1; i < values.length; i++) {
    if (!(values[i] > values[i - 1])) fail(where, `${what} must increase, got ${values.join(", ")}`);
  }
}

function fingerprint(v: unknown): ThemeGrooveFingerprint {
  const w = "groove.fingerprint";
  const o = obj(v, w);
  const ringPitch = dualLength(o.ringPitch, `${w}.ringPitch`, true);
  const stroke = dualLength(o.stroke, `${w}.stroke`, true);
  ringStroke(ringPitch, stroke, w);
  const fadeFrom = unit(o.fadeFrom, `${w}.fadeFrom`);
  let label: ThemeGrooveFingerprint["label"];
  if (o.label !== undefined) {
    const l = obj(o.label, `${w}.label`);
    label = {
      hole: unit(l.hole, `${w}.label.hole`),
      holeRim: unit(l.holeRim, `${w}.label.holeRim`),
      radius: unit(l.radius, `${w}.label.radius`),
      rim: unit(l.rim, `${w}.label.rim`),
    };
    ascending([label.hole, label.holeRim, label.radius, label.rim], `${w}.label`, "hole, holeRim, radius, rim");
    if (label.rim >= fadeFrom) fail(`${w}.label.rim`, "must sit inside fadeFrom");
  }
  const g = obj(o.grounds, `${w}.grounds`);
  const sz = obj(o.sizes, `${w}.sizes`);
  const sizes = {
    sm: positive(sz.sm, `${w}.sizes.sm`),
    md: positive(sz.md, `${w}.sizes.md`),
    lg: positive(sz.lg, `${w}.sizes.lg`),
  };
  ascending([sizes.sm, sizes.md, sizes.lg], `${w}.sizes`, "sm, md, lg");
  const pr = obj(o.presets, `${w}.presets`);
  const presets: Record<string, GroovePreset> = {};
  for (const [name, p] of Object.entries(pr)) {
    const e = obj(p, `${w}.presets.${name}`);
    presets[name] = { x: num(e.x, `${w}.presets.${name}.x`), y: num(e.y, `${w}.presets.${name}.y`) };
  }
  const defaultPreset = str(o.defaultPreset, `${w}.defaultPreset`);
  if (!(defaultPreset in presets)) fail(`${w}.defaultPreset`, `"${defaultPreset}" is not one of presets`);
  return {
    ringPitch,
    stroke,
    fadeFrom,
    ...(label ? { label } : {}),
    grounds: { light: grooveInk(g.light, `${w}.grounds.light`), dark: grooveInk(g.dark, `${w}.grounds.dark`) },
    sizes,
    presets,
    defaultPreset,
    spin: spin(o.spin, `${w}.spin`),
  };
}

function ambientGroove(v: unknown): ThemeGrooveAmbient {
  const w = "groove.ambient";
  const o = obj(v, w);
  const ringPitch = dualLength(o.ringPitch, `${w}.ringPitch`, false);
  const stroke = dualLength(o.stroke, `${w}.stroke`, false);
  ringStroke(ringPitch, stroke, w);
  const m = obj(o.mask, `${w}.mask`);
  const mask = {
    innerFrom: unit(m.innerFrom, `${w}.mask.innerFrom`),
    innerTo: unit(m.innerTo, `${w}.mask.innerTo`),
    outerFrom: unit(m.outerFrom, `${w}.mask.outerFrom`),
  };
  ascending([mask.innerFrom, mask.innerTo, mask.outerFrom], `${w}.mask`, "innerFrom, innerTo, outerFrom");
  const g = obj(o.grounds, `${w}.grounds`);
  const aspect = positive(o.aspect, `${w}.aspect`);
  return {
    ringPitch,
    stroke,
    aspect,
    grounds: { root: grooveInk(g.root, `${w}.grounds.root`), dark: grooveInk(g.dark, `${w}.grounds.dark`) },
    mask,
    spin: spin(o.spin, `${w}.spin`),
  };
}

function skeletonGroove(v: unknown): ThemeGrooveSkeleton {
  const w = "groove.skeleton";
  const o = obj(v, w);
  const ringPitch = dualLength(o.ringPitch, `${w}.ringPitch`, false);
  const stroke = dualLength(o.stroke, `${w}.stroke`, false);
  ringStroke(ringPitch, stroke, w);
  const c = obj(o.centre, `${w}.centre`);
  const sh = obj(o.shimmer, `${w}.shimmer`);
  const shimmer = {
    colour: colourRef(sh.colour, `${w}.shimmer.colour`),
    strength: unit(sh.strength, `${w}.shimmer.strength`),
    angle: num(sh.angle, `${w}.shimmer.angle`),
    from: unit(sh.from, `${w}.shimmer.from`),
    peak: unit(sh.peak, `${w}.shimmer.peak`),
    to: unit(sh.to, `${w}.shimmer.to`),
    seconds: positive(sh.seconds, `${w}.shimmer.seconds`),
  };
  ascending([shimmer.from, shimmer.peak, shimmer.to], `${w}.shimmer`, "from, peak, to");
  return {
    ringPitch,
    stroke,
    centre: { x: num(c.x, `${w}.centre.x`), y: num(c.y, `${w}.centre.y`) },
    fill: unit(o.fill, `${w}.fill`),
    line: unit(o.line, `${w}.line`),
    frame: unit(o.frame, `${w}.frame`),
    shimmer,
  };
}

function toward(v: unknown, where: string): "ink" | "paper" {
  if (v !== "ink" && v !== "paper") fail(where, `must be "ink" or "paper", got ${JSON.stringify(v)}`);
  return v;
}

function gradient(v: unknown): ThemeGradient {
  const o = obj(v, "gradient");
  const angle = num(o.angle, "gradient.angle");
  if (!Array.isArray(o.stops) || o.stops.length < 2) fail("gradient.stops", "must list at least two stops");
  const stops = o.stops.map((s, i): GradientStop => {
    const e = obj(s, `gradient.stops[${i}]`);
    return {
      at: unit(e.at, `gradient.stops[${i}].at`),
      toward: toward(e.toward, `gradient.stops[${i}].toward`),
      amount: unit(e.amount, `gradient.stops[${i}].amount`),
    };
  });
  ascending(stops.map((s) => s.at), "gradient.stops", "positions (at)");
  const out: ThemeGradient = { angle, stops };
  if (o.counterHighlight !== undefined) {
    const h = obj(o.counterHighlight, "gradient.counterHighlight");
    if (h.toward !== "paper") fail("gradient.counterHighlight.toward", 'must be "paper": a highlight lightens');
    out.counterHighlight = {
      x: unit(h.x, "gradient.counterHighlight.x"),
      y: unit(h.y, "gradient.counterHighlight.y"),
      radius: unit(h.radius, "gradient.counterHighlight.radius"),
      toward: "paper",
      amount: unit(h.amount, "gradient.counterHighlight.amount"),
    };
  }
  if (o.drift !== undefined) {
    const d = obj(o.drift, "gradient.drift");
    const secondsPerCycle = num(d.secondsPerCycle, "gradient.drift.secondsPerCycle");
    if (secondsPerCycle < MIN_AMBIENT_SECONDS) {
      fail("gradient.drift.secondsPerCycle", `must be at least ${MIN_AMBIENT_SECONDS}s: ambient motion is slow`);
    }
    out.drift = {
      secondsPerCycle,
      travel: unit(d.travel, "gradient.drift.travel"),
      overscan: num(d.overscan, "gradient.drift.overscan"),
    };
  }
  return out;
}

function contrastFloors(v: unknown): ThemeContrast {
  const o = obj(v, "contrast");
  const body = positive(o.body, "contrast.body");
  const large = positive(o.large, "contrast.large");
  if (large < 1 || body < large) fail("contrast", "needs 1 <= large <= body");
  return {
    body,
    large,
    largeTextPx: positive(o.largeTextPx, "contrast.largeTextPx"),
    mutedInkOpacity: unit(o.mutedInkOpacity, "contrast.mutedInkOpacity"),
  };
}

/**
 * The optional motif blocks: `paper`, `contrast`, `groove`, `gradient`. A
 * theme without them parses to an object without those keys, so nothing that
 * hashes a theme-derived request (chordcards' diagram cache) can change.
 */
function motifs(
  t: Record<string, unknown>,
  ink: string,
  roots: Record<string, RootEntry>,
): Pick<Theme, "paper" | "contrast" | "groove" | "gradient"> {
  const out: Pick<Theme, "paper" | "contrast" | "groove" | "gradient"> = {};
  if (t.paper !== undefined) out.paper = hex(t.paper, "paper");
  if (t.contrast !== undefined) out.contrast = contrastFloors(t.contrast);
  if (t.groove !== undefined) {
    if (!out.paper) fail("groove", 'needs "paper": groove colours are named by role');
    const g = obj(t.groove, "groove");
    out.groove = {
      fingerprint: fingerprint(g.fingerprint),
      ...(g.ambient === undefined ? {} : { ambient: ambientGroove(g.ambient) }),
      ...(g.skeleton === undefined ? {} : { skeleton: skeletonGroove(g.skeleton) }),
    };
  }
  if (t.gradient !== undefined) {
    if (!out.paper) fail("gradient", 'needs "paper": stops mix toward ink or paper');
    if (!out.contrast) fail("gradient", 'needs "contrast": every point is checked against its floors');
    const gr = gradient(t.gradient);
    // The hard rule: ink text stays readable on every point of every root's sheen.
    const probe = { ink, paper: out.paper, contrast: out.contrast, gradient: gr, roots } as Theme;
    for (const root of Object.keys(roots)) {
      const c = gradientContrast(probe, root);
      if (c.ink < out.contrast.body) {
        fail("gradient", `ink on ${root}'s darkest point is ${c.ink.toFixed(2)}:1, under the ${out.contrast.body}:1 body floor`);
      }
      if (c.mutedInk < out.contrast.large) {
        fail(
          "gradient",
          `ink at ${out.contrast.mutedInkOpacity} on ${root}'s darkest point is ${c.mutedInk.toFixed(2)}:1, under the ${out.contrast.large}:1 large-text floor`,
        );
      }
    }
    out.gradient = gr;
  }
  return out;
}

/** The colour a role names for one root. */
export function resolveColourRef(theme: Theme, ref: ColourRef, root: string): string {
  if (ref === "ink") return theme.ink;
  if (ref === "root") {
    const entry = theme.roots[root];
    if (!entry) throw new Error(`theme has no root entry for "${root}"`);
    return entry.background;
  }
  if (!theme.paper) throw new Error('theme has no "paper" colour');
  return theme.paper;
}

/**
 * Every colour the sheen paints on one root, as solid hex: the stops in order,
 * then the counter highlight (if any). This is what print fills with and what
 * the contrast rule checks; the site draws the same mixes with CSS color-mix.
 */
export function gradientColours(theme: Theme, root: string): { at: number | null; hex: string }[] {
  if (!theme.gradient) throw new Error("theme has no gradient");
  const base = resolveColourRef(theme, "root", root);
  const out: { at: number | null; hex: string }[] = theme.gradient.stops.map((s) => ({
    at: s.at,
    hex: mixOklab(base, resolveColourRef(theme, s.toward, root), s.amount),
  }));
  const h = theme.gradient.counterHighlight;
  if (h) out.push({ at: null, hex: mixOklab(base, resolveColourRef(theme, "paper", root), h.amount) });
  return out;
}

/**
 * The worst ink contrast anywhere on a root's sheen: full ink, and ink at
 * `contrast.mutedInkOpacity`, each on the point where it is lowest.
 */
export function gradientContrast(theme: Theme, root: string): { ink: number; mutedInk: number } {
  const opacity = theme.contrast?.mutedInkOpacity ?? 1;
  let ink = Infinity;
  let mutedInk = Infinity;
  for (const { hex: c } of gradientColours(theme, root)) {
    ink = Math.min(ink, contrastRatio(theme.ink, c));
    mutedInk = Math.min(mutedInk, contrastRatio(over(theme.ink, c, opacity), c));
  }
  return { ink, mutedInk };
}

function playback(v: unknown): ThemePlayback {
  const o = obj(v, "playback");
  const out: ThemePlayback = {};
  if (o.arpeggioBpm !== undefined) {
    const bpm = num(o.arpeggioBpm, "playback.arpeggioBpm");
    if (!Number.isInteger(bpm) || bpm < 40 || bpm > 300) {
      fail("playback.arpeggioBpm", "must be an integer from 40 to 300");
    }
    out.arpeggioBpm = bpm;
  }
  if (o.highlightColor !== undefined) out.highlightColor = hex(o.highlightColor, "playback.highlightColor");
  return out;
}

/**
 * Colour for one chord tone on one surface.
 *
 * In "pitch" mode the tone's own CRF colour is used, which is what makes the
 * root collide with the card background — see this module's doc comment.
 */
export function toneColor(
  theme: Theme,
  surface: "keyboard" | "fret",
  pitchClass: string,
  root: string,
): string {
  const mode = surface === "keyboard" ? theme.keyboard.colorMode : theme.fret.colorMode;
  if (mode === "pitch") {
    const entry = theme.pitches[pitchClass];
    if (!entry) throw new Error(`theme has no pitch entry for "${pitchClass}"`);
    return entry.hex;
  }
  const entry = theme.roots[root];
  if (!entry) throw new Error(`theme has no root entry for "${root}"`);
  return surface === "keyboard" ? entry.keyboardHighlight : entry.fretCircle;
}

/** Resolve a font spec to the CSS family list its `family` key names. */
export function familyOf(theme: Theme, spec: FontSpec): string {
  return theme.fonts.families[spec.family];
}
