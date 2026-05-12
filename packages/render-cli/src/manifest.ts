import type { VisualPreset } from "./presets.js";

export interface ManifestEntry extends VisualPreset {
  /** Chord description, e.g. "Cmaj7", "Dm7b5", "F#dim7". */
  chord: string;
  /** Output filename (without extension). Auto-derived from chord+preset if omitted. */
  filename?: string;
  /** Preset name from PRESETS — merged under entry-level overrides. */
  preset?: string;
}

export interface Manifest {
  /** Output directory, relative to manifest file. Default: "./out". */
  outDir?: string;
  /** Default preset applied to every entry (overridable per-entry). */
  defaultPreset?: string;
  entries: ManifestEntry[];
}

/** Cross-product helper for generating large manifests programmatically. */
export function expandCombinations(opts: {
  roots: string[];
  qualities: string[];
  presets?: string[];
}): ManifestEntry[] {
  const presets = opts.presets ?? [undefined as unknown as string];
  const out: ManifestEntry[] = [];
  for (const root of opts.roots) {
    for (const q of opts.qualities) {
      for (const p of presets) {
        out.push({ chord: `${root}${q}`, preset: p });
      }
    }
  }
  return out;
}
