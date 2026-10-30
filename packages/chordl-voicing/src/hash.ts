import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { parsePitch } from "./pitch.js";
import { soundingMidi } from "./realization.js";
import type { Realization, Voicing } from "./types.js";

const digest = (s: string) => "sha256:" + bytesToHex(sha256(utf8ToBytes(s)));
const asc = (a: number[]) => [...a].sort((x, y) => x - y);

function midiOf(pitch: string): number {
  const p = parsePitch(pitch);
  if (!p) throw new Error(`Invalid pitch "${pitch}"`);
  return p.midi;
}

// Canonical shape string; format documented in docs/CANONICAL.md.
function shapeString(r: Realization): string {
  if (r.kind === "fretted") {
    const frets = r.strings.map((f) => (f === null ? "x" : String(f))).join(",");
    return `shape/1|fretted|${r.instrument}|${r.tuning.map(midiOf).join(",")}|capo=${r.capo ?? 0}|${frets}`;
  }
  if (r.kind === "keyboard") {
    const side = (h: string[]) => asc(h.map(midiOf)).join(",");
    return `shape/1|keyboard|L=${side(r.hands.left)}|R=${side(r.hands.right)}`;
  }
  const pairs = r.stops
    .map((s) => ({ string: s.string, midi: midiOf(s.pitch) }))
    .sort((a, b) => a.string - b.string || a.midi - b.midi)
    .map((s) => `${s.string}:${s.midi}`);
  return `shape/1|bowed|${r.instrument}|${r.tuning.map(midiOf).join(",")}|${pairs.join(",")}`;
}

export const shapeHash = (r: Realization): string => digest(shapeString(r));
export const pitchHash = (r: Realization): string => digest(`pitch/1|${asc(soundingMidi(r)).join(",")}`);

export function withHashes(v: Voicing): Voicing {
  return { ...v, hashes: { shape: shapeHash(v.realization), pitch: pitchHash(v.realization) } };
}
