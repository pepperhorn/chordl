import {
  levelForFacts,
  levelForTop3,
  positionFacts,
} from "@pepperhorn/chordl-guitar";
import { levelForVoicing } from "@pepperhorn/chordl-voicings";
import { parsePitch } from "./pitch.js";
import { parseChordId } from "./chordId.js";
import type { Voicing } from "./types.js";

/** Computed experience; stored level is deliberately ignored. */
export function levelOf(v: Voicing): "beginner" | "emerging" | "established" {
  const r = v.realization;
  if (r.kind === "fretted") {
    const frets = r.strings.map((f) => f ?? -1);
    if (r.instrument === "guitar-top3") return levelForTop3(frets.slice(-3), 1);
    return levelForFacts(
      positionFacts(
        {
          frets,
          fingers: r.fingers.map((f) => f ?? 0),
          baseFret: 1,
          barres: r.barres.map((b) => b.fret),
        },
        r.tuning.map((p) => parsePitch(p)!.midi),
        parsePitch(`${parseChordId(v.chordId)!.root}4`)!.pc,
      ),
    );
  }
  if (r.kind !== "keyboard")
    throw new Error("Experience levels are not defined for bowed voicings");
  const notes = [...r.hands.left, ...r.hands.right].map(
    (p) => parsePitch(p)!.midi,
  );
  if (!notes.length) return levelForVoicing([]);
  const lowest = Math.min(...notes);
  const root = parsePitch(`${parseChordId(v.chordId)!.root}4`)!.pc;
  const offset = ((lowest % 12) - root + 12) % 12;
  return levelForVoicing(notes.map((m) => m - lowest + offset));
}
