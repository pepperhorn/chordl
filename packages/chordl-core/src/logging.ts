export const LOG_SCHEMA_VERSION = "1.1.0";

export interface ChordLogEntry {
  input: string;
  /** Optional: where this chord came from. */
  source?: {
    type: "chord-sheet" | "standalone";
    /** Chord reference ID within a sheet (e.g. "A3", "B1"). */
    sheetRef?: string;
  };
  pipeline: {
    parser: "chord" | "progression";
    parsed: {
      chordName: string;
      inversion?: number;
      allInversions?: boolean;
      startingNote?: string;
      startingDegree?: number;
      bassNote?: string;
      bassDegree?: number;
      spanFrom?: string;
      spanTo?: string;
      padding?: number;
      chordOctaveShift?: number;
      bassOctaveShift?: number;
      styleHint?: string;
      format?: string;
      showNoteNames?: boolean;
      fingering?: (number | string)[];
      autoFingering?: boolean;
    };
    resolver: {
      method: "tonal" | "special-builder" | "fallback";
      type: string;
      root: string;
      pitchClasses: string[];
    };
    voicing: {
      attempted: boolean;
      style?: string;
      quality?: string;
      found: boolean;
    };
    layout: {
      startFrom: string;
      size: number;
      chordOctave: number;
    };
    output: {
      notes: string[];       // MIDI note names: ["C4", "E4", "G4", "B4"]
      lhNotes?: string[];
      rhNotes?: string[];
      highlightKeys: string[];
      format?: string;
      display?: string;
    };
  };
  success: boolean;
  errorMessage?: string;
  durationMs: number;
}

export interface LogConfig {
  enabled: boolean;
  endpoint?: string;
  versions?: {
    core?: string;
    voicings?: string;
    react?: string;
  };
}

export function logChordRequest(entry: ChordLogEntry, config: LogConfig): void {
  if (!config.enabled || !config.endpoint) return;

  const payload = {
    logSchema: LOG_SCHEMA_VERSION,
    ...entry,
    versions: config.versions ?? {},
    timestamp: new Date().toISOString(),
  };

  try {
    fetch(config.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      // silently swallow — logging must never affect functionality
    });
  } catch {
    // silently swallow
  }
}
