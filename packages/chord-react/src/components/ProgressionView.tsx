import { useState } from "react";
import type { ProgressionResult } from "../progression";
import type { Format, ColorTheme } from "../types";
import { ChordGroup } from "./ChordGroup";

export type GroupMode = "by-progression" | "by-chord";

export interface ProgressionViewProps {
  result: ProgressionResult;
  format?: Format;
  theme?: ColorTheme | string;
  highlightColor?: string;
  showPlayback?: boolean;
  defaultGroupMode?: GroupMode;
}

export function ProgressionView({
  result,
  format,
  theme,
  highlightColor,
  showPlayback = true,
  defaultGroupMode = "by-progression",
}: ProgressionViewProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>(defaultGroupMode);

  const toggleStyle = (active: boolean) => ({
    padding: "4px 12px",
    fontSize: 12,
    border: "1px solid #ccc",
    borderRadius: 4,
    background: active ? "#333" : "#fff",
    color: active ? "#fff" : "#333",
    cursor: "pointer" as const,
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          {result.progressionName} in {result.key}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            style={toggleStyle(groupMode === "by-progression")}
            onClick={() => setGroupMode("by-progression")}
          >
            By Progression
          </button>
          <button
            style={toggleStyle(groupMode === "by-chord")}
            onClick={() => setGroupMode("by-chord")}
          >
            By Chord
          </button>
        </div>
      </div>

      {groupMode === "by-progression" ? (
        // Each example is a row of chords
        result.examples.map((example, i) => (
          <ChordGroup
            key={i}
            chords={example.chords}
            label={example.label}
            format={format}
            theme={theme}
            highlightColor={highlightColor}
            showPlayback={showPlayback}
          />
        ))
      ) : (
        // Group by chord position — all example 1 first chords, then all second chords, etc.
        renderByChord(result, format, theme, highlightColor, showPlayback)
      )}
    </div>
  );
}

function renderByChord(
  result: ProgressionResult,
  format?: Format,
  theme?: ColorTheme | string,
  highlightColor?: string,
  showPlayback?: boolean,
) {
  if (result.examples.length === 0) return null;

  const numChords = result.examples[0].chords.length;
  const groups: Array<{ symbol: string; chords: Array<{ chord: typeof result.examples[0]["chords"][0]; style: string }> }> = [];

  for (let chordIdx = 0; chordIdx < numChords; chordIdx++) {
    const symbol = result.examples[0].chords[chordIdx].symbol;
    const chords = result.examples.map((ex) => ({
      chord: ex.chords[chordIdx],
      style: ex.label,
    }));
    groups.push({ symbol, chords });
  }

  return groups.map((group, i) => (
    <ChordGroup
      key={i}
      chords={group.chords.map((c) => c.chord)}
      label={`${group.symbol} — ${group.chords.length} voicings`}
      format={format}
      theme={theme}
      highlightColor={highlightColor}
      showPlayback={showPlayback}
    />
  ));
}
