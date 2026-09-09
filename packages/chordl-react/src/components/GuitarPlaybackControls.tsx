import type { PlaybackInstrument } from "@pepperhorn/chordl-core";
import { DEFAULT_ARPEGGIO_BPM } from "@pepperhorn/chordl-core";
import { usePlaybackTimeline } from "../audio/usePlaybackTimeline";

export interface GuitarPlaybackControlsProps {
  notes: number[];
  arpeggioBpm?: number;
  instrument?: PlaybackInstrument;
  onActiveChange?: (indices: number[]) => void;
}

export function GuitarPlaybackControls({
  notes,
  arpeggioBpm = DEFAULT_ARPEGGIO_BPM,
  instrument = "electric_guitar_clean",
  onActiveChange,
}: GuitarPlaybackControlsProps) {
  const { play, playing } = usePlaybackTimeline(onActiveChange);
  const start = (mode: "block" | "arpeggio") => {
    if (playing || notes.length === 0) return;
    void play(notes, { mode, instrument, bpm: arpeggioBpm });
  };

  return (
    <div className="bc-guitar-playback" style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      <button
        type="button"
        className="bc-guitar-playback-block"
        data-active={playing === "block"}
        disabled={Boolean(playing)}
        aria-label="Play block guitar chord"
        onClick={() => start("block")}
        style={{ padding: "5px 10px", borderRadius: 999, cursor: playing ? "wait" : "pointer" }}
      >
        ▶ Chord
      </button>
      <button
        type="button"
        className="bc-guitar-playback-arpeggio"
        data-active={playing === "arpeggio"}
        disabled={Boolean(playing)}
        aria-label="Play guitar chord low to high"
        onClick={() => start("arpeggio")}
        style={{ padding: "5px 10px", borderRadius: 999, cursor: playing ? "wait" : "pointer" }}
      >
        ↗ Strum
      </button>
    </div>
  );
}
