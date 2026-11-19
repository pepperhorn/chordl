import {
  checkVoicing,
  chordIntervals,
  labelNotes,
  levelOf,
} from "@pepperhorn/chordl-voicing";
import type { CheckResult, Voicing } from "@pepperhorn/chordl-voicing";
export interface EditorChecks extends CheckResult {
  notes: Voicing["notes"];
  level?: Voicing["level"];
  valid: boolean;
}
export const canUse = (checks: EditorChecks): boolean =>
  checks.valid && checks.hard.length === 0;
export function editorChecks(
  v: Voicing | null,
  error = "Enter a voicing",
): EditorChecks {
  if (!v)
    return {
      hard: [{ code: "input", severity: "hard", message: error }],
      flags: [],
      facts: [],
      notes: [],
      valid: false,
    };
  const checked = checkVoicing(v);
  const labels = labelNotes(
    v.chordId,
    v.notes.map((n) => n.pitch),
  );
  // The format checker owns chord membership, including slash bass and 7alt.
  // Editors promote its unwritten additions to hard failures for Use.
  checked.flags
    .filter((f) => f.code.startsWith("unwritten-addition:"))
    .forEach((f) => {
      checked.hard.push({ ...f, code: "wrong-note", severity: "hard" });
    });
  checked.flags = checked.flags.filter(
    (f) => !f.code.startsWith("unwritten-addition:"),
  );
  if (!v.notes.length)
    checked.hard.push({
      code: "empty",
      severity: "hard",
      message: "No notes sound",
    });
  if (
    chordIntervals(v.chordId).includes("5P") &&
    !labels.some((n) => n.degree === "V")
  )
    checked.flags.push({
      code: "omitted-fifth",
      severity: "flag",
      message: "The fifth is omitted",
    });
  return {
    ...checked,
    notes: v.notes,
    level: levelOf(v),
    valid: v.notes.length > 0,
  };
}
