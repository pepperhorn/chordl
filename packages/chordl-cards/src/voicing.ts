import { resolveChord } from "@pepperhorn/chordl-core";
import { INSTRUMENTS } from "@pepperhorn/chordl-guitar";
import {
  chordIntervals,
  checkVoicing,
  newVoicingId,
  keyboardVariantsFor,
  labelNotes,
  levelOf,
  parseChordId,
  parsePitch,
  shapeHash,
  soundingMidi,
  withHashes,
} from "@pepperhorn/chordl-voicing";
import type { Realization, Voicing } from "@pepperhorn/chordl-voicing";
import {
  colourFingers,
  frettedRequest,
  requestFor,
  rootEntryFor,
} from "./faces";
import type { CardFace, FaceRequest, FrettedShape } from "./faces";
import { playbackFor } from "./playback";
import { positionsFor } from "./positions";
import { inversionsFor } from "./inversions";
import { keyboardWindow } from "./keyboard-window";
import type { Theme } from "./theme";
import { noteParts, spelledChord } from "./catalogue";

export function chordIdFor(chord: string): string {
  const resolved = resolveChord(chord);
  const bass = chord.match(/\/([A-G][b#]?)$/)?.[1] ?? null;
  const root = resolved.root;
  const intervals = resolved.intervals ?? [];
  // Prefer the catalogue quality, then find the canonical format quality by intervals.
  const parsed = chord.match(/^[A-G][b#]?(.*?)(?:\/[A-G][b#]?)?$/);
  const suffix = parsed?.[1] || "maj";
  const direct = `${root}:${suffix}${bass ? "/" + bass : ""}`;
  if (parseChordId(direct)) return direct;
  const qualities = [
    "maj",
    "m",
    "dim",
    "aug",
    "sus2",
    "sus4",
    "5",
    "6",
    "m6",
    "69",
    "m69",
    "add9",
    "madd9",
    "maj7",
    "7",
    "m7",
    "mmaj7",
    "m7b5",
    "dim7",
    "7sus4",
    "9sus4",
    "13sus4",
    "maj9",
    "9",
    "m9",
    "11",
    "m11",
    "maj13",
    "13",
    "m13",
  ];
  for (const quality of qualities) {
    const id = `${root}:${quality}${bass ? "/" + bass : ""}`;
    if (chordIntervals(id).join() === intervals.join()) return id;
  }
  throw new Error(`Unsupported voicing chord: ${chord}`);
}
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function voicingForRealization(
  chord: string,
  realization: Realization,
  initial?: Voicing,
): Voicing {
  const chordId = chordIdFor(chord);
  const spelling = spelledChord(chord).pitchClasses;
  const pitches = soundingMidi(realization).map((m) => {
    const pc =
      spelling.find((p) => noteParts(p)?.pc === m % 12) ?? NAMES[m % 12];
    const oct = Math.floor((m - (noteParts(pc)?.pc ?? m % 12)) / 12) - 1;
    return `${pc}${oct}`;
  });
  const v: Voicing = {
    schema: "chordl.voicing/1",
    id: newVoicingId(),
    rev: 1,
    previous: null,
    chordId,
    status: "live",
    tier: "community",
    licence: "CC0-1.0",
    notes: labelNotes(chordId, pitches).map(({ pitch, degree }) => ({
      pitch,
      degree,
    })),
    realization,
    provenance: {
      source: "chordl",
      authorId: "system",
      createdAt: new Date().toISOString(),
      changeNote: null,
      basedOn: initial ? `${initial.id}@${initial.rev}` : null,
      alternativeTo: null,
    },
    relations: { supersedes: null, supersededBy: null, duplicateOf: null },
    hashes: { shape: "", pitch: "" },
  };
  v.level = levelOf(v);
  return withHashes(v);
}

export function voicingFromRequest(
  chord: string,
  request: FaceRequest,
  face: CardFace,
): Voicing {
  if (
    (request.kind === "keyboard") !== face.startsWith("keyboard") ||
    (request.kind === "guitar" && request.instrument !== face)
  )
    throw new Error("Voicing kind/face mismatch");
  const playback = playbackFor(request);
  if (request.kind === "keyboard") {
    const pitch = (m: number) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;
    const left = new Set(
      face === "keyboard-hands" ? (request.hands?.lh ?? []) : [],
    );
    return voicingForRealization(chord, {
      kind: "keyboard",
      hands: {
        left: playback.notes.filter((_, i) => left.has(i)).map(pitch),
        right: playback.notes.filter((_, i) => !left.has(i)).map(pitch),
      },
    });
  }
  const cfg = INSTRUMENTS[request.instrument];
  const strings: (number | null)[] = Array(cfg.strings).fill(null);
  playback.strings!.forEach((s, i) => {
    strings[s] = playback.notes[i] - cfg.openMidi[s];
  });
  const fingers: (number | null)[] = Array(cfg.strings).fill(null);
  request.shape.fingers.forEach((f) => {
    const value = f[2];
    const text =
      typeof value === "string"
        ? value
        : typeof value === "object"
          ? value?.text
          : undefined;
    fingers[cfg.strings - f[0]] =
      text && /^[1-4]$/.test(text) ? Number(text) : null;
  });
  const baseFret = request.shape.position ?? 1;
  return voicingForRealization(chord, {
    kind: "fretted",
    instrument: face,
    tuning: cfg.openMidi.map(
      (m) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`,
    ),
    strings,
    fingers,
    baseFret,
    capo: null,
    barres: request.shape.barres.map((b) => ({
      fret: b.fret + baseFret - 1,
      fromString: cfg.strings - Math.max(b.fromString, b.toString),
      toString: cfg.strings - Math.min(b.fromString, b.toString),
    })),
  });
}

export function requestForVoicing(
  chord: string,
  voicing: Voicing,
  face: CardFace,
  theme: Theme,
): FaceRequest {
  const r = voicing.realization;
  if (
    (r.kind === "keyboard") !== face.startsWith("keyboard") ||
    r.kind === "bowed" ||
    (r.kind === "fretted" && r.instrument !== face)
  )
    throw new Error("Voicing kind/face mismatch");
  if (voicing.chordId !== chordIdFor(chord))
    throw new Error("Voicing chord mismatch");
  // Preserve the established artwork exactly for a lossless standard conversion.
  let standard: FaceRequest | undefined;
  try {
    standard = requestFor(chord, face, theme);
  } catch {
    /* custom shapes may cover chords without presets */
  }
  if (
    standard &&
    JSON.stringify(voicingFromRequest(chord, standard, face).realization) ===
      JSON.stringify(r)
  )
    return standard;
  if (r.kind === "keyboard") {
    const pitches = [...r.hands.left, ...r.hands.right];
    if (!pitches.length) throw new Error("Cannot draw an empty keyboard");
    const semis = pitches.map((p) => parsePitch(p)!.midi);
    const window = keyboardWindow(
      pitches.map((p) => NAMES[parsePitch(p)!.pc]),
      chord,
      {
        whiteKeys: Math.max(
          15,
          Math.ceil(((Math.max(...semis) - Math.min(...semis)) * 7) / 12) + 5,
        ),
        minContextKeys: 1,
      },
      semis,
    );
    return {
      kind: "keyboard",
      chordLabel: chord,
      notes: window.highlightKeys,
      midiNotes: semis,
      startFrom: window.startFrom,
      size: window.size,
      format: theme.keyboard.format,
      pitchColors: null,
      highlightColor: rootEntryFor(chord, theme)!.keyboardHighlight,
      ...(face === "keyboard-hands"
        ? {
            hands: {
              lh: r.hands.left.map((_, i) => i),
              rh: r.hands.right.map((_, i) => i + r.hands.left.length),
            },
          }
        : {}),
    };
  }
  const n = r.strings.length;
  const shape: FrettedShape = {
    title: chord,
    position: r.baseFret,
    fingers: r.strings.map((f, i) => [
      n - i,
      f === null ? "x" : f === 0 ? 0 : f - r.baseFret + 1,
      ...(r.fingers[i] ? [String(r.fingers[i])] : []),
    ]) as FrettedShape["fingers"],
    barres: r.barres.map((b) => ({
      fret: b.fret - r.baseFret + 1,
      fromString: n - b.toString,
      toString: n - b.fromString,
    })),
  };
  const request = frettedRequest(
    shape,
    face as "guitar",
    resolveChord(chord).root,
    rootEntryFor(chord, theme)!,
    theme,
  );
  const frets = Math.max(
    5,
    ...r.strings.map((f) => (f === null || f === 0 ? 0 : f - r.baseFret + 1)),
  );
  return frets > 5 ? { ...request, frets } : request;
}

export interface VoicingAlternative {
  voicing: Voicing;
  label: string;
  kind: string;
  level: NonNullable<Voicing["level"]>;
  isStandard: boolean;
}
export function alternativesFor(
  chord: string,
  face: CardFace,
  theme: Theme,
  { limit = 8 }: { limit?: number } = {},
): VoicingAlternative[] {
  const standard = requestFor(chord, face, theme);
  const result: VoicingAlternative[] = [];
  const seen = new Set<string>();
  const add = (voicing: Voicing, label: string, kind: string) => {
    const hash = shapeHash(voicing.realization);
    if (seen.has(hash)) return;
    seen.add(hash);
    result.push({
      voicing,
      label,
      kind,
      level: levelOf(voicing),
      isStandard: result.length === 0,
    });
  };
  add(voicingFromRequest(chord, standard, face), "Standard", "standard");
  if (standard.kind === "guitar")
    for (const p of positionsFor(chord, standard.instrument, theme, {
      limit: Math.max(8, limit),
    }))
      add(voicingFromRequest(chord, p.request, face), p.label, p.kind);
  else
    for (const inv of inversionsFor(chord)) {
      const notes = resolveChord(chord, inv.inversion).notes;
      let prev = 47;
      const pitches = notes.map((p) => {
        let midi = parsePitch(`${p}3`)!.midi;
        while (midi <= prev) midi += 12;
        prev = midi;
        return `${p}${Math.floor(midi / 12) - 1}`;
      });
      add(
        voicingForRealization(chord, {
          kind: "keyboard",
          hands: {
            left: face === "keyboard-hands" ? pitches.slice(0, 1) : [],
            right: face === "keyboard-hands" ? pitches.slice(1) : pitches,
          },
        }),
        inv.label,
        "inversion",
      );
    }
  if (standard.kind === "keyboard") {
    for (const variant of keyboardVariantsFor(chord, Math.max(8, limit))) {
      let last = -1;
      const first = parsePitch(`${variant.notes[0]}3`)!.midi;
      const pitches = variant.notes.map((note, i) => {
        const pc = parsePitch(`${note}3`)!.pc;
        let midi = 48 + pc;
        if (variant.octaveOffsets)
          midi =
            Math.floor(first / 12) * 12 + pc + variant.octaveOffsets[i] * 12;
        else while (midi <= last) midi += 12;
        last = midi;
        return `${note}${Math.floor(midi / 12) - 1}`;
      });
      const voicing = voicingForRealization(chord, {
        kind: "keyboard",
        hands: {
          left: face === "keyboard-hands" ? pitches.slice(0, 1) : [],
          right: face === "keyboard-hands" ? pitches.slice(1) : pitches,
        },
      });
      if (
        !checkVoicing(voicing).hard.length &&
        labelNotes(
          voicing.chordId,
          voicing.notes.map((n) => n.pitch),
        ).every((n) => n.inChord)
      )
        add(voicing, variant.label, variant.source);
    }
  }
  return result.slice(0, Math.max(1, Math.floor(limit) || 8));
}
