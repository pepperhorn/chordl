import type { NoteNameMode, ParsedChordRequest, TextSize } from "@pepperhorn/chordl-core";

/**
 * Card-wide note-name defaults a host can hand a chord. The chord text always
 * wins where it speaks; these only fill what it leaves out.
 */
export interface NoteNameDefaults {
  showNoteNames?: boolean;
  noteNameSize?: TextSize;
  noteNameMode?: NoteNameMode;
}

/**
 * Merge a chord's own note-name request with host defaults.
 *
 * The parser only ever sets `showNoteNames` to true or leaves it undefined, so
 * the text cannot switch names off: a default that turns them on stays on.
 * A degrees-only request ("with degrees") asks for no names, so a default that
 * turns names on adds them in front of the degrees instead of replacing them.
 */
export function resolveNoteNames(
  parsed: Pick<ParsedChordRequest, "showNoteNames" | "noteNameSize" | "noteNameMode">,
  defaults: NoteNameDefaults,
): NoteNameDefaults {
  const textAsksForNames = parsed.showNoteNames === true && parsed.noteNameMode !== "degree";
  if (textAsksForNames || defaults.showNoteNames !== true) {
    return {
      showNoteNames: parsed.showNoteNames,
      noteNameMode: parsed.noteNameMode,
      noteNameSize: parsed.noteNameSize ?? defaults.noteNameSize,
    };
  }
  const base = defaults.noteNameMode ?? "pitch-class";
  let noteNameMode: NoteNameMode = base;
  if (parsed.noteNameMode === "degree") {
    if (base === "pitch-class") noteNameMode = "pitch-class+degree";
    else if (base === "midi") noteNameMode = "midi+degree";
  }
  return {
    showNoteNames: true,
    noteNameMode,
    noteNameSize: parsed.noteNameSize ?? defaults.noteNameSize,
  };
}
