import type { CSSProperties } from "react";
import {
  computeStaffLayout,
  getDefaultGlyphs,
  STAFF_LINE_SPACING,
  STAFF_WIDTH,
  CLEF_AREA_WIDTH,
  NOTE_COLUMN_X,
  NOTE_HEAD_RX,
  NOTE_HEAD_RY,
  NOTE_HEAD_TILT,
  NOTE_HEAD_STROKE_WIDTH,
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

  // Font glyphs are Y-up; SVG is Y-down. Scale with negative Y to flip.
  const upm = g.upm || 1000;

  function renderClef(type: "treble" | "bass", staffTopY: number) {
    const clef = type === "treble" ? g.trebleClef : g.bassClef;
    const clefX = BRACE_WIDTH + 4;
    // Scale so the clef spans the right number of staff spaces
    const targetHeight = type === "treble"
      ? STAFF_LINE_SPACING * 4 * 1.8
      : STAFF_LINE_SPACING * 3 * 1.5;
    const s = targetHeight / clef.height;
    // In font coords, y=0 is the baseline (reference line for the clef).
    // After scale(s, -s), font y=0 maps to the translate Y.
    // Treble clef: baseline = G4 line = 2nd line from bottom = staffTopY + 3*spacing
    // Bass clef: baseline = F3 line = 2nd line from top = staffTopY + spacing
    const refLineY = type === "treble"
      ? staffTopY + STAFF_LINE_SPACING * 3
      : staffTopY + STAFF_LINE_SPACING;

    return (
      <g
        className={`bc-staff__clef--${type}`}
        transform={`translate(${clefX}, ${refLineY}) scale(${s}, ${-s})`}
      >
        <path d={clef.path} fill={staffColor} />
      </g>
    );
  }

  function renderAccidental(
    type: "sharp" | "flat",
    x: number,
    y: number,
  ) {
    const glyph = type === "sharp" ? g.sharp : g.flat;
    // Scale accidental to ~2.2 staff spaces tall
    const targetHeight = STAFF_LINE_SPACING * 2.2;
    const s = targetHeight / glyph.height;
    // Center horizontally at x, vertically at y
    const accX = x - (glyph.width * s) / 2;

    return (
      <g
        className="bc-staff__accidental"
        transform={`translate(${accX}, ${y}) scale(${s}, ${-s})`}
      >
        <path d={glyph.path} fill={noteColor} />
      </g>
    );
  }

  const controlsX = totalWidth - 144;
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
            y={STAFF_TOP_MARGIN - 8}
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

                {/* Notehead (open whole note) */}
                <ellipse
                  className="bc-staff__notehead"
                  cx={note.noteX}
                  cy={note.y}
                  rx={NOTE_HEAD_RX}
                  ry={NOTE_HEAD_RY}
                  fill="none"
                  stroke={noteColor}
                  strokeWidth={NOTE_HEAD_STROKE_WIDTH}
                  transform={`rotate(${NOTE_HEAD_TILT}, ${note.noteX}, ${note.y})`}
                />
              </g>
              );
            })}
          </g>
        </g>
      </g>
    </svg>
  );
}
