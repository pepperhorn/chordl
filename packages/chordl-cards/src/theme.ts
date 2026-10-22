/**
 * Card theme: every colour, size and font the printed deck uses, in one file.
 *
 * Moved here from chordcards (src/theme.ts) so the print pipeline and the web
 * player read one schema. File paths in the comments below (themes/, src/card.ts,
 * src/highlight.ts, ...) are chordcards' own. The one addition is the optional
 * `playback` block, which only the web player reads; a theme without it parses
 * exactly as before.
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

export interface Theme {
  name: string;
  description: string;
  ink: string;
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
  };
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
  };
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
