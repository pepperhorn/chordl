import { useState, useMemo } from "react";
import type { DisplayMode } from "../types";
import type { UIThemeMode } from "../config";
import { PianoChord } from "./PianoChord";
import {
  parseChordDescription,
  resolveChord,
  FLAT_TO_SHARP,
} from "@better-chord/core";
import {
  generateVariants,
  mapToVoicingQuality,
} from "@better-chord/voicings";
import type { VoicingVariant } from "@better-chord/voicings";

export interface VoicingVariantToggleProps {
  chord: string;
  format?: "compact" | "exact";
  theme?: string;
  highlightColor?: string;
  scale?: number;
  display?: DisplayMode;
  uiTheme?: UIThemeMode;
}

const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function VoicingVariantToggle({
  chord,
  format,
  theme,
  highlightColor,
  scale,
  display,
  uiTheme,
}: VoicingVariantToggleProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [totalCount, setTotalCount] = useState(3);

  // Parse and resolve chord to get root, quality, notes.
  // Apply "starting on" / inversion rotation so variants match what PianoChord renders.
  const resolved = useMemo(() => {
    try {
      const parsed = parseChordDescription(chord);
      if (!parsed.chordName) return null;
      const res = resolveChord(parsed.chordName, parsed.inversion);
      let notes = res.notes;

      // Apply "starting on X" rotation (same logic as PianoChord)
      if (parsed.startingNote) {
        const norm = FLAT_TO_SHARP[parsed.startingNote] ?? parsed.startingNote;
        const idx = notes.indexOf(norm);
        if (idx > 0) {
          notes = [...notes.slice(idx), ...notes.slice(0, idx)];
        }
      }

      const quality = mapToVoicingQuality(res.type, notes);
      return { parsed, root: res.root, quality, notes, type: res.type, styleHint: parsed.styleHint };
    } catch {
      return null;
    }
  }, [chord]);

  // Generate variants
  const variants = useMemo<VoicingVariant[]>(() => {
    if (!resolved) return [];
    return generateVariants(
      resolved.root,
      resolved.quality,
      resolved.notes,
      totalCount,
      { styleHint: resolved.styleHint },
    );
  }, [resolved, totalCount]);

  // Reset active index when chord changes
  const [prevChord, setPrevChord] = useState(chord);
  if (chord !== prevChord) {
    setPrevChord(chord);
    setActiveIndex(0);
    setTotalCount(3);
  }

  // If we couldn't resolve or only have 1 variant, just render PianoChord directly
  if (!resolved || variants.length <= 1) {
    return (
      <PianoChord
        chord={chord}
        format={format}
        theme={theme}
        highlightColor={highlightColor}
        scale={scale}
        display={display}
        uiTheme={uiTheme}
      />
    );
  }

  const active = variants[Math.min(activeIndex, variants.length - 1)];

  // Build the chord string for the active variant.
  // For library/algorithmic variants, we pass the note list directly as a chord override.
  // For the root position / default (index 0), pass the original chord string to preserve
  // all parser features (note names, fingering, etc.).
  const activeChord = activeIndex === 0
    ? chord
    : `${resolved.root} ${active.notes.slice(1).map(n => n).join(" ")}`;

  // For non-default variants, construct a chord input that PianoChord can render.
  // We pass the original chord for variant A, and override notes for B/C/etc.
  // The simplest approach: always pass the original chord and let PianoChord handle it,
  // but override the note list. Since PianoChord doesn't support a notes override prop,
  // we construct a synthetic chord string.
  //
  // Actually, the cleanest approach: for variant A use the original chord.
  // For other variants, use PianoChord with the resolved chord name but rotated notes.
  // Since PianoChord re-resolves internally, we need to pass a chord string that produces
  // the right notes. For inversions we can use "Cmaj7 in Nth inversion". For library
  // voicings, we pass the style hint.

  // Simplified: always render PianoChord with original chord for variant A,
  // and construct appropriate chord strings for other variants.
  let chordString = chord;
  if (activeIndex > 0) {
    if (active.source === "inversion") {
      const invNum = parseInt(active.id.replace("inv-", ""), 10);
      // Strip any existing inversion from the chord, add new one
      const baseParsed = resolved.parsed;
      const baseChord = baseParsed.chordName ?? chord;
      const ordinals = ["", "first", "second", "third", "fourth", "fifth"];
      chordString = `${baseChord} in ${ordinals[invNum] ?? `${invNum}th`} inversion`;
    } else if (active.source === "library") {
      const baseParsed = resolved.parsed;
      const baseChord = baseParsed.chordName ?? chord;
      chordString = `${baseChord} ${active.label} style`;
    } else {
      // Algorithmic — use root position chord name
      chordString = resolved.parsed.chordName ?? chord;
    }
  }

  return (
    <div className="voicing-variant-toggle" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      {/* Chord output — allow horizontal overflow so keyboard isn't squished */}
      <div style={{ width: "100%", overflowX: "auto", display: "flex", justifyContent: "center" }}>
        <PianoChord
          chord={chordString}
          format={format}
          theme={theme}
          highlightColor={highlightColor}
          scale={scale}
          display={display}
          uiTheme={uiTheme}
        />
      </div>

      {/* Variant toggle row */}
      <div className="variant-toggle-row" style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        justifyContent: "center",
      }}>
        {variants.map((v, i) => (
          <button
            key={v.id}
            className="variant-pill"
            data-active={i === activeIndex}
            onClick={() => setActiveIndex(i)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "12px 22px 10px",
              border: i === activeIndex ? "none" : "1px solid var(--glass-border, #e0e0e0)",
              borderRadius: 10,
              background: i === activeIndex ? "var(--pill-active-bg, #fff)" : "transparent",
              color: i === activeIndex ? "var(--pill-active-text, #1a1a2e)" : "var(--text-muted, #5a6374)",
              boxShadow: i === activeIndex ? "0 1px 6px var(--pill-active-shadow, rgba(0,0,0,0.08))" : "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "1.2rem",
              fontWeight: i === activeIndex ? 600 : 500,
              transition: "all 0.2s ease",
              minWidth: 64,
            }}
          >
            <span>{LABELS[i]}</span>
            <span style={{
              fontSize: "0.78rem",
              fontWeight: 400,
              color: "var(--text-dim, #8b95a5)",
              whiteSpace: "nowrap",
              maxWidth: 80,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {v.label}
            </span>
          </button>
        ))}

        {/* + button — hide when all variants exhausted */}
        {variants.length >= totalCount && <button
          className="variant-pill-add"
          onClick={() => setTotalCount((c) => c + 3)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "12px 16px",
            border: "1px dashed var(--glass-border, #e0e0e0)",
            borderRadius: 10,
            background: "transparent",
            color: "var(--text-muted, #5a6374)",
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: "1.2rem",
            fontWeight: 400,
            transition: "all 0.2s ease",
            minWidth: 52,
            height: 52,
          }}
          title="Generate more voicing options"
        >
          +
        </button>}
      </div>
    </div>
  );
}
