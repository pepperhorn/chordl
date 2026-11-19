import { newVoicingId } from "@pepperhorn/chordl-voicing";
import { useEffect, useId, useMemo, useState, useRef } from "react";
import {
  identifyChords,
  matchesChordName,
  parseChordDescription,
  placeAscending,
  resolveChord,
} from "@pepperhorn/chordl-core";
import type { TextSize } from "@pepperhorn/chordl-core";
import { PianoChord } from "@pepperhorn/chordl-react";
import { voicingForRealization } from "@pepperhorn/chordl-cards";
import type { CardFace } from "@pepperhorn/chordl-cards";
import { parsePitch } from "@pepperhorn/chordl-voicing";
import type { Voicing } from "@pepperhorn/chordl-voicing";
import { editorChecks } from "./checks";
import type { EditorChecks } from "./checks";
import { VoicingChecks } from "./VoicingChecks";
export interface KeyboardSpellerProps {
  chord: string;
  face: CardFace;
  initial?: Voicing;
  onChange: (voicing: Voicing | null, checks: EditorChecks) => void;
  theme?: string;
  showNoteNames?: boolean;
  noteNameSize?: TextSize;
  size?: number;
}
export function parseKeyboard(
  text: string,
  chord: string,
  face: CardFace,
  initial?: Voicing,
): Voicing {
  if (face !== "keyboard" && face !== "keyboard-hands")
    throw new Error("Expected a keyboard face");
  const bare = /^[A-G](?:bb?|##?)?\d*(?:\s+[A-G](?:bb?|##?)?\d*)+$/i.test(
    text.trim(),
  );
  const parsed = parseChordDescription(bare ? `notes ${text}` : text);
  if (parsed.isScale || parsed.allInversions)
    throw new Error("Enter one chord or a list of notes");
  const hands: { left: string[]; right: string[] } = { left: [], right: [] };
  if (parsed.notesGroups?.length) {
    for (const group of parsed.notesGroups) {
      const left = group.hand === "lh" || group.clef === "bass";
      let last = -1;
      const notes = group.notes.map((token) => {
        const explicit = parsePitch(token);
        if (explicit) {
          last = explicit.midi;
          return token;
        }
        const base = placeAscending([token], left ? 3 : 4)[0];
        let octave = base.octave;
        let midi = base.midi;
        while (midi <= last) {
          midi += 12;
          octave++;
        }
        last = midi;
        return `${token}${octave}`;
      });
      hands[face === "keyboard-hands" && left ? "left" : "right"].push(
        ...notes,
      );
    }
  } else {
    if (!parsed.chordName) throw new Error("No chord found");
    hands.right = placeAscending(
      resolveChord(parsed.chordName, parsed.inversion).notes,
      4,
    ).map((n) => `${n.note}${n.octave}`);
  }
  if (!hands.left.length && !hands.right.length)
    throw new Error("No notes found");
  return voicingForRealization(chord, { kind: "keyboard", hands }, initial);
}
function initialText(v: Voicing | undefined, chord: string) {
  if (v?.realization.kind !== "keyboard") return chord;
  const { left, right } = v.realization.hands;
  return `${left.length ? `lh ${left.join(" ")} ` : ""}${right.length ? `rh ${right.join(" ")}` : ""}`;
}
export function KeyboardSpeller({
  chord,
  face,
  initial,
  onChange,
  theme = "crf",
  showNoteNames = true,
  noteNameSize = "xl",
  size = 2,
}: KeyboardSpellerProps) {
  const id = useId();
  const [draftId] = useState(newVoicingId);
  const [text, setText] = useState(() => initialText(initial, chord));
  const state = useMemo(() => {
    try {
      const voicing = {
        ...parseKeyboard(text, chord, face, initial),
        id: draftId,
      };
      return { voicing, checks: editorChecks(voicing) };
    } catch {
      return {
        voicing: null,
        checks: editorChecks(
          null,
          "Can't read that. Try C maj 2nd inversion, E G C, or rh G C E lh C.",
        ),
      };
    }
  }, [text, chord, face, initial, draftId]);
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => callback.current(state.voicing, state.checks), [state]);
  const notes = state.voicing?.notes.map((n) => n.pitch) ?? [];
  const names = notes.length
    ? identifyChords(notes)
        .slice(0, 4)
        .map((n) => n.symbol)
        .join(" · ")
    : "";
  const matches = notes.length ? matchesChordName(chord, notes).ok : false;
  return (
    <section className="cve-editor" aria-label="Keyboard speller">
      <label htmlFor={id}>Spell a chord or notes</label>
      <input
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault();
        }}
      />
      <div className="cve-examples">
        {[
          "C maj 2nd inversion",
          "E G C",
          "E F# A B",
          "rh G C E lh C",
          "Eb Gb Bb // Db F",
        ].map((s) => (
          <button type="button" key={s} onClick={() => setText(s)}>
            {s}
          </button>
        ))}
      </div>
      {state.voicing && (
        <>
          <div className="cve-keyboard">
            <div className="cve-keyboard-inner">
              <PianoChord
                chord={initialText(state.voicing, chord).replace(
                  /(lh|rh) /g,
                  "$1 notes ",
                )}
                theme={theme}
                showNoteNames={showNoteNames}
                noteNameSize={noteNameSize}
                scale={size}
              />
            </div>
          </div>
          <p>
            Identified: {names || "No name found"}
            {matches ? " · Matches requested chord" : ""}
          </p>
        </>
      )}
      <VoicingChecks checks={state.checks} />
    </section>
  );
}
