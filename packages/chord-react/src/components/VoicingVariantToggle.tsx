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

  // Reset active index only when the actual chord identity changes
  // (root + notes), not when display modifiers (fingering, midi, etc.) change.
  const chordIdentity = resolved ? `${resolved.root}:${resolved.notes.join(",")}` : chord;
  const [prevIdentity, setPrevIdentity] = useState(chordIdentity);
  if (chordIdentity !== prevIdentity) {
    setPrevIdentity(chordIdentity);
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

  // Extract display modifiers from the original prompt so all variants
  // inherit them (midi note names, fingering, note name size, etc.).
  const displayModifiers = useMemo(() => {
    if (!resolved) return "";
    const parts: string[] = [];
    const p = resolved.parsed;
    if (p.showNoteNames) {
      if (p.noteNameMode === "midi") {
        parts.push("midi note names");
      } else {
        parts.push("note names");
      }
      if (p.noteNameSize && p.noteNameSize !== "base") {
        parts.push(`in ${p.noteNameSize}`);
      }
    }
    if (p.autoFingering) {
      parts.push("with fingering");
    } else if (p.fingering) {
      parts.push(`fingering ${p.fingering.join("-")}`);
    }
    if (p.fingeringSize && p.fingeringSize !== "base") {
      parts.push(`fingering in ${p.fingeringSize}`);
    }
    return parts.length > 0 ? " " + parts.join(" ") : "";
  }, [resolved]);

  // Build the chord string for the active variant, preserving display modifiers.
  let chordString = chord;
  if (activeIndex > 0) {
    const baseChord = resolved.parsed.chordName ?? chord;
    if (active.source === "inversion") {
      const invNum = parseInt(active.id.replace("inv-", ""), 10);
      const ordinals = ["", "first", "second", "third", "fourth", "fifth"];
      chordString = `${baseChord} in ${ordinals[invNum] ?? `${invNum}th`} inversion${displayModifiers}`;
    } else if (active.source === "library") {
      chordString = `${baseChord} ${active.label} style${displayModifiers}`;
    } else {
      chordString = `${baseChord}${displayModifiers}`;
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
              border: i === activeIndex ? "1px solid transparent" : "1px solid var(--btn-border)",
              borderRadius: 10,
              background: i === activeIndex ? "var(--pill-active-bg)" : "var(--pill-bg)",
              color: i === activeIndex ? "var(--pill-active-text)" : "var(--text-muted)",
              boxShadow: i === activeIndex ? "0 1px 6px var(--pill-active-shadow)" : "none",
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
              color: "var(--text-dim)",
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
            border: "1px dashed var(--btn-border)",
            borderRadius: 10,
            background: "transparent",
            color: "var(--text-muted)",
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
