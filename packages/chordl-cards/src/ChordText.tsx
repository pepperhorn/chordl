import type { CSSProperties } from "react";
import {
  ACCIDENTAL_METRICS, RAISED_SCALE, accidentalGlyphs, glyphBounds, glyphPathData, spokenChordSymbol,
  tokenizeChordSymbol, type AccidentalWeight,
} from "./accidentals";

export interface ChordTextProps {
  /** As the deck writes it: "Eb", "m7b5", "C#maj7", "Bb Db". */
  text: string;
  /** The Poppins weight the surrounding text is set in; the glyphs are drawn to match. */
  weight?: AccidentalWeight;
  /** What a screen reader says. Defaults to the symbol with its accidentals as words ("E flat"). */
  label?: string;
  /**
   * "full" (default): letter-sized on the baseline. "raised": the chord-chart
   * convention the print title can use — RAISED_SCALE, hung from cap height.
   */
  accidentals?: "full" | "raised";
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
export function ChordText({ text, weight = 600, label, accidentals = "full", className, style }: ChordTextProps) {
  const tokens = tokenizeChordSymbol(text);
  const s = accidentals === "raised" ? RAISED_SCALE : 1;
  return (
    <span
      className={`chord-text ${className ?? ""}`.trim()}
      data-accidentals={accidentals}
      style={{ position: "relative", whiteSpace: "nowrap", ...style }}
    >
      <span className="chord-text-visual" aria-hidden="true">
        {tokens.map((t, i) => {
          if (t.kind === "text") return t.text;
          const g = accidentalGlyphs[weight][t.kind];
          // Raised: the glyph's baseline lifts so its top meets cap height. A
          // stroke set in the glyph's user units shrinks with it, as on the card.
          const lift = s === 1 ? 0 : ACCIDENTAL_METRICS.capHeight[weight] - glyphBounds(g).yMax * s;
          return (
            <svg
              key={i}
              className={`chord-accidental chord-accidental-${t.kind}`}
              viewBox={`0 ${-ASC} ${g.advance} ${ASC + DESC}`}
              style={{
                width: `${(g.advance * s) / 1000}em`,
                height: `${((ASC + DESC) * s) / 1000}em`,
                verticalAlign: `${(lift - DESC * s) / 1000}em`,
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
