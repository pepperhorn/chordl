import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SVGuitarChord } from "svguitar";
import type { Chord, ChordSettings } from "svguitar";
import { DEFAULT_PLAYBACK_HIGHLIGHT_COLOR } from "@pepperhorn/chordl-core";
import { useUITheme } from "../ui-theme";

export interface GuitarChordProps {
  /** An svguitar Chord (from chordl-guitar's lookupGuitarChord shapes). */
  chord: Chord;
  /** Number of frets to draw (default 5). */
  frets?: number;
  /** Extra svguitar settings (merged last). */
  settings?: ChordSettings;
  scale?: number;
  className?: string;
  style?: CSSProperties;
  /** Active physical string, zero-based in low-to-high instrument order. */
  activeString?: number;
  /** Active physical strings; used by block playback to paint the full voicing. */
  activeStrings?: number[];
  playbackHighlightColor?: string;
}

let keyCounter = 0;

/**
 * A value-identity for everything that goes into a drawing. `chord` and
 * `settings` are plain data (svguitar's types carry no functions), and callers
 * routinely rebuild them every render — GuitarChordPanel destructures the
 * shape's title off, hosts pass object literals. Keying the draw on object
 * identity therefore re-drew, and re-raised the loading veil, on every
 * unrelated parent re-render.
 */
function drawKeyOf(input: unknown): string {
  try {
    return JSON.stringify(input) ?? "";
  } catch {
    // Unserialisable input (a cycle): fall back to redrawing every time rather
    // than wrongly deciding nothing changed.
    return `unkeyable:${keyCounter++}`;
  }
}

/**
 * Render a single guitar chord diagram (fretboard "frame") with svguitar.
 *
 * svguitar draws imperatively into a DOM node, so we render into a ref'd div in
 * an effect and clear it on unmount — the same pattern the Verovio staff uses.
 * Colors come from the UI theme so the diagram stays visible in dark mode.
 */
export function GuitarChord({
  chord,
  frets = 5,
  settings,
  scale = 1,
  className,
  style,
  activeString,
  activeStrings,
  playbackHighlightColor = DEFAULT_PLAYBACK_HIGHLIGHT_COLOR,
}: GuitarChordProps) {
  const resolvedActiveStrings = activeStrings ?? (activeString === undefined ? [] : [activeString]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [painted, setPainted] = useState(false);
  const { tokens: ui } = useUITheme();
  const color = ui.text ?? "#0a0a0a";

  // Redraw when the drawing would differ, not when a prop object is merely a
  // new instance of the same data. GuitarChord is public API, so this has to
  // hold for any caller — memoising at the call site is not enough.
  const drawKey = drawKeyOf({ chord, frets, settings, color });
  // The effect runs off `drawKey` alone, so it reads the live props from here
  // rather than closing over stale ones.
  const drawRef = useRef({ chord, frets, settings, color });
  drawRef.current = { chord, frets, settings, color };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let firstFrame = 0;
    let secondFrame = 0;
    const { chord: nextChord, frets: nextFrets, settings: nextSettings, color: nextColor } =
      drawRef.current;
    setPainted(false);
    el.innerHTML = "";
    let drawn = false;
    try {
      new SVGuitarChord(el)
        .configure({
          frets: nextFrets,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          color: nextColor,
          backgroundColor: "transparent",
          strokeWidth: 2,
          fretLabelColor: nextColor,
          tuningsColor: nextColor,
          ...nextSettings,
        })
        .chord(nextChord)
        .draw();
      drawn = true;
    } catch {
      el.innerHTML = "";
      setPainted(true);
    }
    if (drawn) {
      // svguitar mutates the DOM synchronously, but the browser still needs a
      // paint. Keep the loading veil through that paint and remove it on the
      // following frame rather than exposing a blank frame container.
      //
      // Scheduled outside the try above on purpose: that catch wipes the
      // container, so a missing or throwing requestAnimationFrame would erase
      // a diagram that drew perfectly well. Here the worst case is dropping the
      // veil immediately.
      try {
        firstFrame = requestAnimationFrame(() => {
          secondFrame = requestAnimationFrame(() => setPainted(true));
        });
      } catch {
        setPainted(true);
      }
    }
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      el.innerHTML = "";
    };
    // Deliberately keyed on the serialized drawing, not on prop identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawKey]);

  return (
    <div
      className={`bc-guitar-chord ${className ?? ""}`.trim()}
      data-active-strings={resolvedActiveStrings.join(" ")}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 260 * scale,
        minHeight: painted ? undefined : 160 * scale,
        ...style,
        ["--bc-playback-highlight" as string]: playbackHighlightColor,
      }}
    >
      <style>{`
        @keyframes bc-render-loading-pulse {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
        }
        @keyframes bc-guitar-note-pulse {
          from { filter: drop-shadow(0 0 1px var(--bc-playback-highlight)); }
          to { filter: drop-shadow(0 0 7px var(--bc-playback-highlight)); }
        }
        ${Array.from({ length: 8 }, (_, index) => `
          .bc-guitar-chord[data-active-strings~="${index}"] .bc-playback-string-${index} {
            fill: var(--bc-playback-highlight) !important;
            stroke: var(--bc-playback-highlight) !important;
            opacity: 1 !important;
            animation: bc-guitar-note-pulse 0.35s ease-out infinite alternate;
          }
        `).join("")}
        @media (prefers-reduced-motion: reduce) {
          .bc-guitar-chord [class*="bc-playback-string-"] { animation: none !important; }
        }
      `}</style>
      <div ref={containerRef} className="bc-guitar-chord__canvas" />
      {!painted && (
        <div
          className="bc-render-loading bc-guitar-chord__loading"
          role="status"
          aria-label="Rendering chord frame"
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            color: ui.textMuted ?? "#888",
          }}
        >
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              style={{
                width: 6, height: 6, borderRadius: "50%", background: "currentColor",
                animation: "bc-render-loading-pulse 0.9s ease-in-out infinite",
                animationDelay: `${index * 0.15}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
