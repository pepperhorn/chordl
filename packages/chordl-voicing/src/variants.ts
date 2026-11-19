import { resolveChord } from "@pepperhorn/chordl-core";
import {
  generateVariants,
  mapToVoicingQuality,
} from "@pepperhorn/chordl-voicings";
/** Reuse the keyboard library and generator without copying its quality rules. */
export function keyboardVariantsFor(chord: string, count = 8) {
  const resolved = resolveChord(chord);
  return generateVariants(
    resolved.root,
    mapToVoicingQuality(resolved.type, resolved.intervals),
    resolved.notes,
    count,
  );
}
