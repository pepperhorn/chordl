import type { ProgressionChord } from "../progression";
import type { Format, ColorTheme } from "../types";
import { PianoKeyboard } from "./PianoKeyboard";
import { calculateLayout } from "../resolver/auto-layout";
import type { WhiteNote } from "../types";

export interface ChordGroupProps {
  chords: ProgressionChord[];
  label?: string;
  format?: Format;
  theme?: ColorTheme | string;
  highlightColor?: string;
  showPlayback?: boolean;
}

export function ChordGroup({
  chords,
  label,
  format,
  theme,
  highlightColor,
  showPlayback = true,
}: ChordGroupProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>
          {label}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        {chords.map((chord, i) => {
          const layout = calculateLayout(chord.notes, { padding: 1 });
          return (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                {chord.symbol}
              </div>
              <PianoKeyboard
                format={format}
                size={layout.size}
                startFrom={layout.startFrom as WhiteNote}
                highlightKeys={chord.notes}
                theme={theme}
                highlightColor={highlightColor}
                showPlayback={showPlayback}
                chordLabel={chord.symbol}
              />
              {chord.voicingStyle && (
                <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                  {chord.voicingStyle}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
