import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PianoChord, UIThemeProvider, resolveUITheme } from "@better-chord/react";
import type { ManifestEntry } from "./manifest.js";
import { resolvePreset, type VisualPreset } from "./presets.js";

/** Merge precedence: entry overrides > entry preset > manifest default preset. */
export function resolveEntryProps(
  entry: ManifestEntry,
  defaultPresetName?: string
): VisualPreset & { chord: string } {
  const defaults = resolvePreset(defaultPresetName);
  const entryPreset = resolvePreset(entry.preset);
  const { chord, filename: _filename, preset: _preset, ...overrides } = entry;
  return { chord, ...defaults, ...entryPreset, ...overrides };
}

/** Render a single chord to an SVG string. */
export function renderChordSvg(props: VisualPreset & { chord: string }): string {
  const { uiTheme, chordTemplate, chord, ...rest } = props;
  const expandedChord = chordTemplate
    ? chordTemplate.replace(/\{chord\}/g, chord)
    : chord;
  const html = renderToStaticMarkup(
    createElement(
      UIThemeProvider,
      { value: resolveUITheme(uiTheme) },
      createElement(PianoChord, {
        ...rest,
        chord: expandedChord,
        uiTheme,
        showPlayback: false,
      } as Parameters<typeof PianoChord>[0])
    )
  );
  const match = html.match(/<svg[\s\S]*?<\/svg>/);
  return match ? match[0] : html;
}

export function defaultFilename(entry: ManifestEntry): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  const parts = [safe(entry.chord)];
  if (entry.preset) parts.push(safe(entry.preset));
  return parts.join("-");
}
