import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SVGuitarChord } from "svguitar";
import type { Chord, ChordSettings } from "svguitar";
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
}: GuitarChordProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [painted, setPainted] = useState(false);
  const { tokens: ui } = useUITheme();
  const color = ui.text ?? "#0a0a0a";

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let firstFrame = 0;
    let secondFrame = 0;
    setPainted(false);
    el.innerHTML = "";
    try {
      new SVGuitarChord(el)
        .configure({
          frets,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          color,
          backgroundColor: "transparent",
          strokeWidth: 2,
          fretLabelColor: color,
          tuningsColor: color,
          ...settings,
        })
        .chord(chord)
        .draw();
      // svguitar mutates the DOM synchronously, but the browser still needs a
      // paint. Keep the loading veil through that paint and remove it on the
      // following frame rather than exposing a blank frame container.
      firstFrame = requestAnimationFrame(() => {
        secondFrame = requestAnimationFrame(() => setPainted(true));
      });
    } catch {
      el.innerHTML = "";
      setPainted(true);
    }
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      el.innerHTML = "";
    };
  }, [chord, frets, settings, color]);

  return (
    <div
      className={`bc-guitar-chord ${className ?? ""}`.trim()}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 260 * scale,
        minHeight: painted ? undefined : 160 * scale,
        ...style,
      }}
    >
      <style>{`
        @keyframes bc-render-loading-pulse {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-2px); }
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
