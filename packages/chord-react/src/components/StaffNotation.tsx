import type { CSSProperties } from "react";
import {
  computeStaffLayout,
  getDefaultGlyphs,
  STAFF_LINE_SPACING,
  STAFF_WIDTH,
  NOTE_COLUMN_X,
  NOTE_HEAD_RX,
  LEDGER_LINE_EXTEND,
  LEDGER_LINE_STROKE,
  STAFF_LINE_STROKE,
  BRACE_WIDTH,
  STAFF_TOP_MARGIN,
} from "@better-chord/core";
import type { StaffGlyphSet, StaffLayoutOptions } from "@better-chord/core";
import { PlaybackControls } from "./PlaybackControls";
import { useUITheme } from "../ui-theme";

export interface StaffNotationProps {
  notes: string[];
  lhNotes?: string[];
  rhOctave?: number;
  lhOctave?: number;
  /** Pre-resolved octave-qualified notes (e.g. "C:4", "G#:5").
   *  When provided, bypasses internal octave assignment for exact matching. */
  octaveQualifiedNotes?: string[];
  chordLabel?: string;
  scale?: number;
  showPlayback?: boolean;
  glyphs?: StaffGlyphSet;
  className?: string;
  style?: CSSProperties;
}

export function StaffNotation({
  notes,
  lhNotes,
  rhOctave,
  lhOctave,
  octaveQualifiedNotes,
  chordLabel,
  scale = 0.5,
  showPlayback = true,
  glyphs,
  className,
  style,
}: StaffNotationProps) {
  const { tokens: ui } = useUITheme();
  const g = glyphs ?? getDefaultGlyphs();
  const layoutOpts: StaffLayoutOptions = { lhNotes, rhOctave, lhOctave, octaveQualifiedNotes };
  const layout = computeStaffLayout(notes, layoutOpts);

  const hasPlayback = showPlayback && notes.length > 0;
  const controlsHeight = hasPlayback ? 30 : 0;
  const totalHeight = layout.totalHeight + controlsHeight;
  const totalWidth = layout.totalWidth;

  const staffColor = ui.text ?? "#333";
  const noteColor = ui.text ?? "#333";

  // Render 5 staff lines starting at topY
  function renderStaffLines(topY: number) {
    const lines = [];
    for (let i = 0; i < 5; i++) {
      const y = topY + i * STAFF_LINE_SPACING;
      lines.push(
        <line
          key={`line-${topY}-${i}`}
          className="bc-staff__line"
          x1={BRACE_WIDTH + 2}
          y1={y}
          x2={STAFF_WIDTH - 4}
          y2={y}
          stroke={staffColor}
          strokeWidth={STAFF_LINE_STROKE}
        />,
      );
    }
    return lines;
  }

  // SMuFL fonts are designed so that 1 em = 4 staff spaces.
  // Setting font-size = 4 * STAFF_LINE_SPACING renders glyphs at correct staff size.
  const glyphFontSize = STAFF_LINE_SPACING * 4;

  function renderClef(type: "treble" | "bass", staffTopY: number) {
    const clefX = BRACE_WIDTH + 4;
    // SMuFL glyph y-origin sits on the clef's reference line:
    //   gClef on G4 (2nd line from bottom), fClef on F3 (2nd line from top).
    const refLineY = type === "treble"
      ? staffTopY + STAFF_LINE_SPACING * 3
      : staffTopY + STAFF_LINE_SPACING;
    const codepoint = type === "treble" ? g.glyphs.trebleClef : g.glyphs.bassClef;

    return (
      <text
        className={`bc-staff__clef--${type}`}
        x={clefX}
        y={refLineY}
        fontFamily={g.fontFamily}
        fontSize={glyphFontSize}
        fill={staffColor}
      >
        {codepoint}
      </text>
    );
  }

  function renderAccidental(
    type: "sharp" | "flat",
    x: number,
    y: number,
  ) {
    const codepoint = type === "sharp" ? g.glyphs.sharp : g.glyphs.flat;
    return (
      <text
        className="bc-staff__accidental"
        x={x}
        y={y}
        fontFamily={g.fontFamily}
        fontSize={glyphFontSize}
        fill={noteColor}
        textAnchor="middle"
      >
        {codepoint}
      </text>
    );
  }

  const controlsX = totalWidth - 170;
  const controlsY = 4;
  const staffOffsetY = controlsHeight;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      className={`bc-staff ${className ?? ""}`.trim()}
      style={{ width: "100%", maxWidth: totalWidth * scale * 2, ...style }}
      role="img"
      aria-label={chordLabel ? `Staff notation: ${chordLabel}` : "Staff notation"}
    >
      {hasPlayback && (
        <g data-controls="">
          <PlaybackControls
            notes={notes}
            lhNotes={lhNotes}
            rhOctave={rhOctave}
            lhOctave={lhOctave}
            chordName={chordLabel ?? notes.join("-")}
            x={controlsX}
            y={controlsY}
          />
        </g>
      )}

      <g transform={`translate(0, ${staffOffsetY})`}>
        {/* Chord label */}
        {chordLabel && (
          <text
            className="bc-staff__label"
            x={NOTE_COLUMN_X}
            y={STAFF_TOP_MARGIN - 13}
            textAnchor="middle"
            fontSize={13}
            fontWeight={600}
            fill={noteColor}
            fontFamily="system-ui, sans-serif"
          >
            {chordLabel}
          </text>
        )}

        <g className="bc-staff__system">
          {/* Brace (grand staff only) */}
          {layout.staffMode === "grand" && layout.trebleTopY >= 0 && (
            <path
              className="bc-staff__brace"
              d={g.brace(
                layout.bassTopY + STAFF_LINE_SPACING * 4 - layout.trebleTopY,
              )}
              transform={`translate(0, ${layout.trebleTopY})`}
              fill="none"
              stroke={staffColor}
              strokeWidth={2}
            />
          )}

          {/* Barline */}
          {layout.staffMode === "grand" && (
            <line
              className="bc-staff__barline"
              x1={BRACE_WIDTH + 2}
              y1={layout.trebleTopY}
              x2={BRACE_WIDTH + 2}
              y2={layout.bassTopY + STAFF_LINE_SPACING * 4}
              stroke={staffColor}
              strokeWidth={STAFF_LINE_STROKE}
            />
          )}

          {/* Treble staff */}
          {layout.trebleTopY >= 0 && (
            <g className="bc-staff__treble">
              {renderStaffLines(layout.trebleTopY)}
              {renderClef("treble", layout.trebleTopY)}
            </g>
          )}

          {/* Bass staff */}
          {layout.bassTopY >= 0 && (
            <g className="bc-staff__bass">
              {renderStaffLines(layout.bassTopY)}
              {renderClef("bass", layout.bassTopY)}
            </g>
          )}

          {/* Notes */}
          <g className="bc-staff__notes">
            {layout.notes.map((note, i) => {
              // Ledger lines extend to cover offset noteheads
              const ledgerLeft = Math.min(note.noteX, NOTE_COLUMN_X) - NOTE_HEAD_RX - LEDGER_LINE_EXTEND;
              const ledgerRight = Math.max(note.noteX, NOTE_COLUMN_X) + NOTE_HEAD_RX + LEDGER_LINE_EXTEND;

              return (
              <g key={i} className="bc-staff__note">
                {/* Ledger lines */}
                {note.ledgerLines.map((ly, j) => (
                  <line
                    key={`ledger-${j}`}
                    className="bc-staff__ledger"
                    x1={ledgerLeft}
                    y1={ly}
                    x2={ledgerRight}
                    y2={ly}
                    stroke={staffColor}
                    strokeWidth={LEDGER_LINE_STROKE}
                  />
                ))}

                {/* Accidental */}
                {note.accidental && renderAccidental(
                  note.accidental,
                  note.accidentalX,
                  note.y,
                )}

                {/* Notehead (whole note glyph) */}
                <text
                  className="bc-staff__notehead"
                  x={note.noteX}
                  y={note.y}
                  fontFamily={g.fontFamily}
                  fontSize={glyphFontSize}
                  fill={noteColor}
                  textAnchor="middle"
                >
                  {g.glyphs.wholeNote}
                </text>
              </g>
              );
            })}
          </g>
        </g>
      </g>
    </svg>
  );
}
