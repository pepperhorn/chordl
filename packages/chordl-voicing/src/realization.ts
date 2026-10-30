import { INSTRUMENTS } from "@pepperhorn/chordl-guitar";
import { parsePitch } from "./pitch.js";
import type { Realization, Voicing } from "./types.js";

export interface Finding {
  code: string;
  severity: "hard" | "flag" | "fact";
  message: string;
  data?: Record<string, unknown>;
}

function midiOf(pitch: string): number {
  const p = parsePitch(pitch);
  if (!p) throw new Error(`Invalid pitch "${pitch}"`);
  return p.midi;
}

// Sounding MIDI in realization order. Fretted `strings` hold absolute frets (baseFret is
// display only) counted from the capo, so the capo adds to every sounding string.
export function soundingMidi(r: Realization): number[] {
  if (r.kind === "keyboard") return [...r.hands.left, ...r.hands.right].map(midiOf);
  if (r.kind === "bowed") return r.stops.map((s) => midiOf(s.pitch));
  const capo = r.capo ?? 0;
  const out: number[] = [];
  r.strings.forEach((fret, i) => {
    if (fret === null) return;
    out.push(midiOf(r.tuning[i]) + fret + capo);
  });
  return out;
}

const sorted = (a: number[]) => [...a].sort((x, y) => x - y);
const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export function notesMatchRealization(v: Voicing): Finding[] {
  const r = v.realization;
  const findings: Finding[] = [];
  if (r.kind === "fretted") {
    if (!Object.prototype.hasOwnProperty.call(INSTRUMENTS, r.instrument)) {
      findings.push({ code: "unknown-instrument", severity: "hard", message: `Unknown fretted instrument "${r.instrument}"`, data: { instrument: r.instrument } });
    }
    if (r.strings.length !== r.tuning.length) {
      findings.push({
        code: "tuning-length", severity: "hard",
        message: `strings has ${r.strings.length} entries but tuning has ${r.tuning.length}`,
        data: { strings: r.strings.length, tuning: r.tuning.length },
      });
      return findings;
    }
  }
  if (r.kind === "bowed") {
    for (const s of r.stops) {
      const open = r.tuning[s.string];
      if (open === undefined) {
        findings.push({ code: "invalid-realization", severity: "hard", message: `Stop string ${s.string} is outside the tuning`, data: { string: s.string } });
        return findings;
      }
      if (midiOf(s.pitch) < midiOf(open)) {
        findings.push({
          code: "stop-below-open", severity: "hard",
          message: `Stop ${s.pitch} is lower than open string ${open}`,
          data: { string: s.string, pitch: s.pitch, open },
        });
      }
    }
  }
  let sounding: number[];
  let declared: number[];
  try {
    sounding = sorted(soundingMidi(r));
    declared = sorted(v.notes.map((n) => midiOf(n.pitch)));
  } catch (e) {
    findings.push({ code: "invalid-realization", severity: "hard", message: (e as Error).message });
    return findings;
  }
  if (!same(sounding, declared)) {
    findings.push({
      code: "notes-mismatch", severity: "hard",
      message: "notes do not match the pitches sounded by the realization",
      data: { notes: declared, sounding },
    });
  }
  return findings;
}
