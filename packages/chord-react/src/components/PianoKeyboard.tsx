import type { KeyboardProps } from "../types";
import { computeKeyboard, computeSvgDimensions } from "../engine/keyboard-layout";
import { mapHighlights } from "../engine/highlight-mapper";
import { resolveTheme } from "../themes";
import {
  WHITE_KEY_RY,
  BLACK_KEY_RY,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
} from "../engine/svg-constants";

export function PianoKeyboard({
  format = "compact",
  size = 8,
  startFrom = "C",
  highlightKeys = [],
  theme,
  highlightColor,
  className,
  style,
}: KeyboardProps) {
  const keys = computeKeyboard(startFrom, size, format);
  const resolvedTheme = resolveTheme(theme, highlightColor);
  const fills = mapHighlights(keys, highlightKeys, resolvedTheme);
  const { width, height } = computeSvgDimensions(size, format);

  const whiteKeys = keys
    .map((k, i) => ({ key: k, fill: fills[i], index: i }))
    .filter(({ key }) => !key.isBlack);
  const blackKeys = keys
    .map((k, i) => ({ key: k, fill: fills[i], index: i }))
    .filter(({ key }) => key.isBlack);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ maxWidth: width, ...style }}
      role="img"
      aria-label="Piano keyboard"
    >
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
    </svg>
  );
}
