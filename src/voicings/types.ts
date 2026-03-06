export type VoicingEra =
  | "Bebop"
  | "Cool"
  | "Hard Bop"
  | "Modal"
  | "Post-Bop"
  | "Modern";

export type VoicingStyle =
  | "Shell"
  | "Rootless Type A"
  | "Rootless Type B"
  | "Quartal"
  | "Upper Structure"
  | "Drop 2";

export type VoicingQuality =
  | "maj7"
  | "min7"
  | "dom7"
  | "m7b5"
  | "dim7"
  | "min6"
  | "maj6"
  | "sus4"
  | "alt"
  | "6/9"
  | "m6/9";

export interface VoicingEntry {
  id: string;
  name: string;
  quality: VoicingQuality;

  /** Semitone offsets relative to root. e.g. [3, 7, 10, 14] = b3, 5, b7, 9 */
  intervals: number[];

  tags: {
    era: VoicingEra;
    style: VoicingStyle;
    artist?: string;
    source?: string;
  };

  /** Recommended MIDI range for the lowest sounding note */
  range?: {
    min: number; // default ~48 (C3)
    max: number; // default ~72 (C5)
  };
}

export interface VoicingQuery {
  quality?: VoicingQuality;
  era?: VoicingEra;
  style?: VoicingStyle;
  artist?: string;
}
