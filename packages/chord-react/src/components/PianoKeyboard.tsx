import type { KeyboardProps, HandBracket, TextSize, NoteNameMode } from "../types";
import {
  computeKeyboard, computeSvgDimensions,
  mapHighlights, normalizeNote,
  WHITE_KEY_RY, BLACK_KEY_RY,
  WHITE_KEY_WIDTH, BLACK_KEY_WIDTH,
  DEFAULT_STROKE, DEFAULT_STROKE_WIDTH,
  resolveTheme,
} from "@better-chord/core";
import { SHOW_NOTE_NAMES } from "../config";
import { PlaybackControls } from "./PlaybackControls";
import { useUITheme, resolveUITheme, UIThemeProvider } from "../ui-theme";

function renderBracket(
  keys: { note: string; octave: number; isBlack: boolean; x: number; width: number; height: number }[],
  bracket: HandBracket,
  y: number,
  bracketColor: string,
) {
  if (bracket.keyIndices.length === 0) return null;

  // Find leftmost and rightmost x positions
  const bracketKeys = bracket.keyIndices.map((i) => keys[i]).filter(Boolean);
  if (bracketKeys.length === 0) return null;

  const leftKey = bracketKeys.reduce((a, b) => (a.x < b.x ? a : b));
  const rightKey = bracketKeys.reduce((a, b) => (a.x + a.width > b.x + b.width ? a : b));

  const x1 = leftKey.x + (leftKey.isBlack ? 0 : 2);
  const x2 = rightKey.x + rightKey.width - (rightKey.isBlack ? 0 : 2);
  const midX = (x1 + x2) / 2;
  const tickH = 4;

  return (
    <g key={bracket.label}>
      {/* Horizontal beam */}
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={bracketColor} strokeWidth={1.5} />
      {/* Left tick */}
      <line x1={x1} y1={y - tickH} x2={x1} y2={y} stroke={bracketColor} strokeWidth={1.5} />
      {/* Right tick */}
      <line x1={x2} y1={y - tickH} x2={x2} y2={y} stroke={bracketColor} strokeWidth={1.5} />
      {/* Label */}
      <text
        x={midX}
        y={y + 11}
        textAnchor="middle"
        fontSize={10}
        fontWeight={500}
        fill={bracketColor}
        fontFamily="system-ui, sans-serif"
      >
        {bracket.label}
      </text>
    </g>
  );
}

/** Multipliers relative to the base font size (WHITE_KEY_WIDTH * 0.48, capped at 11). */
const TEXT_SIZE_SCALE: Record<TextSize, number> = {
  base: 1,
  lg: 1.25,
  xl: 1.5,
  "2xl": 1.875,
};

function resolveAnnotationFontSize(size: TextSize = "base"): number {
  const base = Math.min(WHITE_KEY_WIDTH * 0.48, 11);
  return base * TEXT_SIZE_SCALE[size];
}

function annotationRowHeight(size: TextSize = "base"): number {
  return resolveAnnotationFontSize(size) + 3;
}

/**
 * Match highlighted keys to keyboard positions and compute display names.
 * Returns an array of matched highlights with position and label data.
 */
function matchHighlightsToKeys(
  keys: { note: string; octave: number; isBlack: boolean; x: number; width: number }[],
  highlightKeys: string[],
  displayNoteNames: string[] | undefined,
  noteNameMode: NoteNameMode = "pitch-class",
  midiBaseOctave: number = 4,
): Array<{ x: number; width: number; note: string; index: number }> {
  const highlighted: Array<{ x: number; width: number; note: string; index: number }> = [];
  const remaining = highlightKeys.map((h, i) => {
    const colonIdx = h.indexOf(":");
    const note = colonIdx !== -1 ? normalizeNote(h.slice(0, colonIdx)) : normalizeNote(h);
    return { note, idx: i, matched: false };
  });

  for (const key of keys) {
    const keyNote = normalizeNote(key.note);
    const matchIdx = remaining.findIndex((h) => {
      if (h.matched || h.note !== keyNote) return false;
      const orig = highlightKeys[h.idx];
      if (orig.includes(":")) {
        const oct = parseInt(orig.split(":")[1], 10);
        if (oct !== key.octave) return false;
      }
      return true;
    });
    if (matchIdx !== -1) {
      remaining[matchIdx].matched = true;
      let displayName = displayNoteNames?.[remaining[matchIdx].idx] ?? remaining[matchIdx].note;
      if (noteNameMode === "midi") {
        displayName = `${displayName}${midiBaseOctave + key.octave}`;
      }
      highlighted.push({
        x: key.x,
        width: key.isBlack ? BLACK_KEY_WIDTH : WHITE_KEY_WIDTH,
        note: displayName,
        index: remaining[matchIdx].idx,
      });
    }
  }
  return highlighted;
}

export function PianoKeyboard({
  format = "compact",
  size = 8,
  startFrom = "C",
  highlightKeys = [],
  allNotes,
  lhNotes,
  rhOctave,
  lhOctave,
  theme,
  highlightColor,
  showPlayback = true,
  chordLabel,
  showHeading,
  handBrackets,
  scale = 0.5,
  showNoteNames,
  displayNoteNames,
  noteNameSize = "base",
  noteNameMode = "pitch-class",
  midiBaseOctave = 4,
  fingering,
  fingeringSize = "base",
  degreeLabels,
  clipLeft = false,
  clipRight = false,
  uiTheme,
  className,
  style,
}: KeyboardProps) {
  const parentCtx = useUITheme();
  const ctx = uiTheme ? resolveUITheme(uiTheme) : parentCtx;
  const uiTokens = ctx.tokens;
  const keys = computeKeyboard(startFrom, size, format);
  const resolvedTheme = resolveTheme(theme, highlightColor);
  const fills = mapHighlights(keys, highlightKeys, resolvedTheme);
  const { width: fullWidth, height: keyboardHeight } = computeSvgDimensions(size, format);
  const halfKey = WHITE_KEY_WIDTH / 2;
  // Clip based on actual key positions (not fullWidth which has +1 stroke padding)
  const vbX = clipLeft ? halfKey : 0;
  const lastKeyEnd = size * WHITE_KEY_WIDTH;
  const vbRight = clipRight ? lastKeyEnd - halfKey : fullWidth;
  const vbW = vbRight - vbX;
  const width = fullWidth;
  const hasPlayback = showPlayback && highlightKeys.length > 0;
  const hasBrackets = handBrackets && handBrackets.length > 0;
  const controlsHeight = hasPlayback ? 30 : 0;
  const bracketsHeight = hasBrackets ? 24 : 0;
  const resolvedShowNoteNames = showNoteNames ?? SHOW_NOTE_NAMES;
  // Determine which annotation rows to show based on noteNameMode
  const isDegreeOnly = noteNameMode === "degree";
  const isDegreeCombo = noteNameMode === "pitch-class+degree";
  const hasNoteNames = resolvedShowNoteNames && highlightKeys.length > 0 && !isDegreeOnly;
  const hasDegrees = resolvedShowNoteNames && highlightKeys.length > 0 && (isDegreeOnly || isDegreeCombo)
    && degreeLabels && degreeLabels.length > 0;
  const hasFingering = fingering && fingering.length > 0;
  // Annotations are now rendered as HTML below the SVG — no SVG height needed
  const hasAnnotations = hasNoteNames || hasFingering || hasDegrees;
  const height = keyboardHeight + controlsHeight + bracketsHeight;
  const keysOffsetY = controlsHeight;

  const whiteKeys = keys
    .map((k, i) => ({ key: k, fill: fills[i], index: i }))
    .filter(({ key }) => !key.isBlack);
  const blackKeys = keys
    .map((k, i) => ({ key: k, fill: fills[i], index: i }))
    .filter(({ key }) => key.isBlack);

  // Position controls in top-right of visible area
  const controlsX = vbX + vbW - 146;
  const controlsY = 4;

  const svg = (
    <svg
      viewBox={`${vbX} 0 ${vbW} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className={`bc-keyboard ${className ?? ""}`.trim()}
      style={{ width: "100%", display: "block", ...style }}
      role="img"
      aria-label="Piano keyboard"
    >
      {hasPlayback && (
        <g data-controls="">
          <PlaybackControls
            notes={allNotes ?? highlightKeys}
            lhNotes={lhNotes}
            rhOctave={rhOctave}
            lhOctave={lhOctave}
            chordName={chordLabel ?? highlightKeys.join("-")}
            x={controlsX}
            y={controlsY}
          />
        </g>
      )}
      {/* Clip path for rounded edges on partial keys */}
      {(clipLeft || clipRight) && whiteKeys.length > 0 && (
        <defs>
          <clipPath id={`kb-clip-${vbX}-${keysOffsetY}`}>
            <rect
              x={vbX}
              y={0}
              width={vbW}
              height={whiteKeys[0].key.height}
              rx={WHITE_KEY_RY}
              ry={WHITE_KEY_RY}
            />
          </clipPath>
        </defs>
      )}
      <g transform={`translate(0, ${keysOffsetY})`}>
        <g clipPath={(clipLeft || clipRight) && whiteKeys.length > 0 ? `url(#kb-clip-${vbX}-${keysOffsetY})` : undefined}>
          {whiteKeys.map(({ key, fill, index }) => (
            <rect
              key={`white-${index}`}
              x={key.x}
              y={key.y}
              width={key.width}
              height={key.height}
              rx={WHITE_KEY_RY}
              ry={WHITE_KEY_RY}
              fill={fill}
              stroke={DEFAULT_STROKE}
              strokeWidth={DEFAULT_STROKE_WIDTH}
            />
          ))}
          {blackKeys.map(({ key, fill, index }) => (
            <rect
              key={`black-${index}`}
              x={key.x}
              y={key.y}
              width={key.width}
              height={key.height}
              rx={BLACK_KEY_RY}
              ry={BLACK_KEY_RY}
              fill={fill}
              stroke={DEFAULT_STROKE}
              strokeWidth={DEFAULT_STROKE_WIDTH}
            />
          ))}
        </g>
        {/* Border rect at clipped edges */}
        {(clipLeft || clipRight) && whiteKeys.length > 0 && (
          <rect
            x={vbX}
            y={0}
            width={vbW}
            height={whiteKeys[0].key.height}
            rx={WHITE_KEY_RY}
            ry={WHITE_KEY_RY}
            fill="none"
            stroke={DEFAULT_STROKE}
            strokeWidth={DEFAULT_STROKE_WIDTH}
          />
        )}
      </g>
      {hasBrackets && (
        <g transform={`translate(0, ${keysOffsetY + keyboardHeight + 6})`}>
          {handBrackets!.map((b) => renderBracket(keys, b, 0, uiTokens.bracketColor))}
        </g>
      )}
    </svg>
  );

  // Match highlights for HTML annotations
  const highlighted = hasAnnotations
    ? matchHighlightsToKeys(
        keys, highlightKeys,
        isDegreeOnly ? degreeLabels : displayNoteNames,
        isDegreeOnly ? "pitch-class" : noteNameMode,
        midiBaseOctave,
      )
    : [];

  const nameFontSize = resolveAnnotationFontSize(noteNameSize);
  const fingerFontSize = resolveAnnotationFontSize(fingeringSize);

  // Stagger: if any note has an accidental (#/b), put accidentals on row 1
  // and naturals on row 2 to avoid overlap on adjacent keys.
  const isAccidental = (name: string) => /[#b]/.test(name.slice(1)); // skip first char (the letter)
  const anyAccidentals = highlighted.some((h) => isAccidental(h.note));
  const staggerHeight = anyAccidentals ? nameFontSize * 1.3 : 0;

  const content = (
    <div className="bc-keyboard-container" style={{ width: "100%", maxWidth: vbW * scale * 2 }}>
      {showHeading && chordLabel && (
        <div className="bc-keyboard-heading" style={{
          textAlign: "center",
          fontSize: 14,
          fontWeight: 600,
          color: uiTokens.text,
          fontFamily: "system-ui, sans-serif",
          marginBottom: 4,
        }}>
          {chordLabel}
        </div>
      )}
      {svg}
      {hasAnnotations && highlighted.length > 0 && (
        <div className="bc-annotations" style={{
          position: "relative",
          width: "100%",
          marginTop: 2,
          // Reserve space for both rows when staggering
          minHeight: staggerHeight + nameFontSize * 1.3 + (hasFingering ? fingerFontSize * 1.3 : 0),
        }}>
          {highlighted.map((h, i) => {
            const centerPct = ((h.x + h.width / 2 - vbX) / vbW) * 100;
            const showName = hasNoteNames || (isDegreeOnly && hasDegrees);
            const showDeg = isDegreeCombo && hasDegrees;
            const showFinger = hasFingering;
            const degree = degreeLabels?.[h.index];
            const fingerRaw = fingering?.[h.index];
            const fingerDisplay = fingerRaw == null ? null
              : typeof fingerRaw === "number" && (fingerRaw < 0 || fingerRaw > 5) ? "?" : fingerRaw;

            // Accidentals on row 1 (top=0), naturals on row 2 (top=staggerHeight)
            const rowOffset = anyAccidentals && !isAccidental(h.note) ? staggerHeight : 0;

            return (
              <div
                key={`ann-${i}`}
                className="bc-annotation-cell"
                style={{
                  position: "absolute",
                  left: `${centerPct}%`,
                  transform: "translateX(-50%)",
                  top: rowOffset,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0,
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                }}
              >
                {showName && (
                  <span className="bc-note-name" style={{
                    fontSize: nameFontSize,
                    fontWeight: 600,
                    color: uiTokens.text,
                    fontFamily: "system-ui, sans-serif",
                  }}>
                    {h.note}
                  </span>
                )}
                {showDeg && degree && (
                  <span className="bc-degree-label" style={{
                    fontSize: nameFontSize * 0.85,
                    fontWeight: 500,
                    color: uiTokens.textMuted,
                    fontFamily: "system-ui, sans-serif",
                  }}>
                    {degree}
                  </span>
                )}
                {showFinger && fingerDisplay != null && (
                  <span className="bc-fingering" style={{
                    fontSize: fingerFontSize,
                    fontWeight: 500,
                    color: uiTokens.textMuted,
                    fontFamily: "system-ui, sans-serif",
                  }}>
                    {fingerDisplay}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return uiTheme ? <UIThemeProvider value={ctx}>{content}</UIThemeProvider> : content;
}
