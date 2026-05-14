import type { ColorTheme } from "@pepperhorn/chordl-core";
import type { UIThemeMode } from "@pepperhorn/chordl-react";

/**
 * Visual presets — named bundles of theming options for batch renders.
 * Add entries here so a manifest can reference them by name (`"preset": "print-bw"`).
 */
export interface VisualPreset {
  theme?: ColorTheme | string;
  highlightColor?: string;
  uiTheme?: UIThemeMode;
  scale?: number;
  showNoteNames?: boolean;
  /**
   * Natural-language wrapper applied to each entry's chord string.
   * Use `{chord}` as the placeholder. Lets a preset bake in parser-driven
   * options (padding, note-name size, format) so manifests can stay terse.
   *
   * Example: `"full {chord} with 2 notes either side with note names 2xl"`
   */
  chordTemplate?: string;
}

export const PRESETS: Record<string, VisualPreset> = {
  "app-color": {
    theme: "boomwhacker",
    uiTheme: "light",
    scale: 1,
    showNoteNames: true,
  },
  "app-dark": {
    theme: "boomwhacker",
    uiTheme: "dark",
    scale: 1,
    showNoteNames: true,
  },
  "print-bw": {
    theme: "simple",
    highlightColor: "#222",
    uiTheme: "light",
    scale: 1,
    showNoteNames: true,
  },
  "crf-brand": {
    theme: "crf",
    uiTheme: "light",
    scale: 1,
    showNoteNames: true,
  },
  "chord-cards": {
    theme: "crf",
    uiTheme: "light",
    chordTemplate: "full {chord} with 2 notes either side with note names 2xl",
  },
};

export function resolvePreset(name?: string): VisualPreset {
  if (!name) return {};
  const p = PRESETS[name];
  if (!p) {
    throw new Error(
      `Unknown preset "${name}". Available: ${Object.keys(PRESETS).join(", ")}`
    );
  }
  return p;
}
