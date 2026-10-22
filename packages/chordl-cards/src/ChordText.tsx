import type { CSSProperties } from "react";
import {
  accidentalGlyphs, glyphPathData, spokenChordSymbol, tokenizeChordSymbol, type AccidentalWeight,
} from "./accidentals";

export interface ChordTextProps {
  /** As the deck writes it: "Eb", "m7b5", "C#maj7", "Bb Db". */
  text: string;
  /** The Poppins weight the surrounding text is set in; the glyphs are drawn to match. */
  weight?: AccidentalWeight;
  /** What a screen reader says. Defaults to the symbol with its accidentals as words ("E flat"). */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** The glyph box: ascender 800 over a 250 descender, in font units. */
const ASC = 800;
const DESC = 250;

const SR_ONLY: CSSProperties = {
  position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
  overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
};

/**
 * A chord symbol or note name set in the page's Poppins, its accidentals drawn
 * as inline SVG glyphs (./accidentals.ts) in `currentColor`, each as wide as
 * its advance so the run sets like text. The drawn run is hidden from
 * assistive tech; a visually-hidden twin carries the words ("E flat") so a
 * screen reader never reads "Eb" as "e b".
 */
export function ChordText({ text, weight = 600, label, className, style }: ChordTextProps) {
  const tokens = tokenizeChordSymbol(text);
  return (
    <span className={`chord-text ${className ?? ""}`.trim()} style={{ position: "relative", whiteSpace: "nowrap", ...style }}>
      <span className="chord-text-visual" aria-hidden="true">
        {tokens.map((t, i) => {
          if (t.kind === "text") return t.text;
          const g = accidentalGlyphs[weight][t.kind];
          return (
            <svg
              key={i}
              className={`chord-accidental chord-accidental-${t.kind}`}
              viewBox={`0 ${-ASC} ${g.advance} ${ASC + DESC}`}
              style={{
                width: `${g.advance / 1000}em`,
                height: `${(ASC + DESC) / 1000}em`,
                verticalAlign: `${-DESC / 1000}em`,
                overflow: "visible",
                display: "inline",
              }}
              focusable="false"
            >
              <path d={glyphPathData(g, 0, 0, 1000)} fill="currentColor" />
            </svg>
          );
        })}
      </span>
      <span className="chord-text-sr" style={SR_ONLY}>{label ?? spokenChordSymbol(text)}</span>
    </span>
  );
}
