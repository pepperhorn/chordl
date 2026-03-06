import type { ChordProps, KeyboardProps } from "../types";
import { PianoKeyboard } from "./PianoKeyboard";
import { parseChordDescription } from "../parser/natural-language";
import { resolveChord } from "../resolver/chord-resolver";
import { calculateLayout } from "../resolver/auto-layout";
import type { WhiteNote } from "../types";

function isChordProps(props: ChordProps | KeyboardProps): props is ChordProps {
  return "chord" in props;
}

export function PianoChord(props: ChordProps | KeyboardProps) {
  if (!isChordProps(props)) {
    return <PianoKeyboard {...props} />;
  }

  const { chord, format, theme, highlightColor, padding, className, style } =
    props;

  const parsed = parseChordDescription(chord);
  const resolved = resolveChord(parsed.chordName, parsed.inversion);
  const layout = calculateLayout(resolved.notes, {
    padding: padding ?? 1,
    spanFrom: parsed.spanFrom,
    spanTo: parsed.spanTo,
  });

  return (
    <PianoKeyboard
      format={parsed.format ?? format}
      size={layout.size}
      startFrom={layout.startFrom as WhiteNote}
      highlightKeys={resolved.notes}
      theme={theme}
      highlightColor={highlightColor}
      className={className}
      style={style}
    />
  );
}
