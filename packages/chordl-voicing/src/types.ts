export type Pitch = string;

export interface VoicingNote {
  pitch: Pitch;
  degree: string;
}

export interface FrettedRealization {
  kind: "fretted";
  instrument: string;
  tuning: Pitch[];
  strings: (number | null)[];
  fingers: (number | null)[];
  baseFret: number;
  barres: { fret: number; fromString: number; toString: number }[];
  capo: number | null;
}

export interface KeyboardRealization {
  kind: "keyboard";
  hands: { left: Pitch[]; right: Pitch[] };
  fingering?: { left?: number[]; right?: number[] };
}

export interface BowedRealization {
  kind: "bowed";
  instrument: "violin" | "viola" | "cello" | "double-bass";
  tuning: Pitch[];
  stops: { string: number; pitch: Pitch; finger: number | null }[];
  position: number | null;
}

export type Realization = FrettedRealization | KeyboardRealization | BowedRealization;

export type RepoStatus = "live" | "retired" | "superseded";
export type Tier = "curated" | "community";

export interface Voicing {
  schema: "chordl.voicing/1";
  id: string;
  rev: number;
  previous: number | null;
  chordId: string;
  status: RepoStatus;
  tier: Tier;
  licence: string;
  notes: VoicingNote[];
  realization: Realization;
  level?: "beginner" | "emerging" | "established";
  provenance: {
    source: string;
    authorId: string;
    createdAt: string;
    changeNote: string | null;
    basedOn: string | null;
    alternativeTo: string | null;
  };
  relations: {
    supersedes: string | null;
    supersededBy: string | null;
    duplicateOf: string | null;
  };
  externalIds?: Record<string, string>;
  hashes: { shape: string; pitch: string };
}

export interface ChordFile {
  schema: "chordl.chord/1";
  chord: {
    id: string;
    symbol: string;
    root: string;
    quality: string;
    bass: string | null;
    aliases: string[];
  };
  voicings: Voicing[];
}
