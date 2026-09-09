import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { buildMei, DEFAULT_PLAYBACK_HIGHLIGHT_COLOR } from "@pepperhorn/chordl-core";
import type { StaffGlyphSet } from "@pepperhorn/chordl-core";
import { PlaybackControls } from "./PlaybackControls";
import { useUITheme } from "../ui-theme";
import { renderMeiToSvg, isVerovioReady } from "../verovio";
import type { VerovioFont } from "../verovio";
import { getDefaultGlyphs } from "@pepperhorn/chordl-core";
import type { PlaybackSpecSnapshot } from "../types";

export interface StaffNotationProps {
  notes: string[];
  lhNotes?: string[];
  rhOctave?: number;
  lhOctave?: number;
  /** Pre-resolved octave-qualified notes (e.g. "C:4", "G#:5").
   *  When provided, bypasses internal octave assignment for exact matching. */
  octaveQualifiedNotes?: string[];
  chordLabel?: string;
  /**
   * Draw `chordLabel` inside the SVG. Default true. Card renderers pass false
   * and supply the name via the shared DOM heading instead, so a staff card's
   * type matches the keyboard card beside it. `chordLabel` is still used for
   * the accessible name and playback either way.
   */
  showLabel?: boolean;
  scale?: number;
  showPlayback?: boolean;
  arpeggioBpm?: number;
  playbackHighlightColor?: string;
  /** Controlled active note indices, shared with a keyboard in `both` mode. */
  activePlaybackIndices?: number[];
  onPlaybackActiveChange?: (indices: number[]) => void;
  onPlaybackSpecChange?: (spec: PlaybackSpecSnapshot) => void;
  /** Which SMuFL font to engrave with. `name` selects the Verovio font
   *  (Bravura / Petaluma); defaults to the app-wide glyph selection. */
  glyphs?: StaffGlyphSet;
  className?: string;
  style?: CSSProperties;
}

const CONTROLS_HEIGHT = 30;
const CONTROLS_WIDTH = 170;
const LABEL_HEIGHT = 18;

/**
 * How long a single uninterrupted wait may run before the dots explain
 * themselves. Necessary but not sufficient: the explanation is only true while
 * the engine is still downloading, so the toolkit is asked as well (see the
 * effect below). The threshold stays so the label never flashes on a cold start
 * that turns out to be quick — three silent dots are what turns "slow" into
 * "stuck" in a bug report, but a message that appears and vanishes is worse.
 */
const SLOW_LOAD_LABEL_MS = 1500;
const SLOW_LOAD_TITLE = "Loading notation engine";
const SLOW_LOAD_SUBTITLE = "first time only";

/** Map the app's SMuFL glyph set to a Verovio font name. */
function fontFor(glyphs: StaffGlyphSet | undefined): VerovioFont {
  const name = (glyphs ?? getDefaultGlyphs()).name;
  return name === "Petaluma" ? "Petaluma" : "Bravura";
}

/** Pull intrinsic pixel dimensions out of a Verovio SVG string. */
function parseSvgSize(svg: string): { width: number; height: number } {
  const w = svg.match(/\bwidth="([\d.]+)px"/);
  const h = svg.match(/\bheight="([\d.]+)px"/);
  if (w && h) return { width: parseFloat(w[1]), height: parseFloat(h[1]) };
  const vb = svg.match(/viewBox="[\d.]+ [\d.]+ ([\d.]+) ([\d.]+)"/);
  if (vb) return { width: parseFloat(vb[1]), height: parseFloat(vb[2]) };
  return { width: 160, height: 120 };
}

export function StaffNotation({
  notes,
  lhNotes,
  rhOctave,
  lhOctave,
  octaveQualifiedNotes,
  chordLabel,
  showLabel = true,
  scale = 0.5,
  showPlayback = true,
  glyphs,
  className,
  style,
  arpeggioBpm,
  playbackHighlightColor = DEFAULT_PLAYBACK_HIGHLIGHT_COLOR,
  activePlaybackIndices,
  onPlaybackActiveChange,
  onPlaybackSpecChange,
}: StaffNotationProps) {
  const [internalActiveIndices, setInternalActiveIndices] = useState<number[]>([]);
  const visibleActiveIndices = activePlaybackIndices ?? internalActiveIndices;
  const { tokens: ui } = useUITheme();
  const font = fontFor(glyphs);

  // One resolution of the chord, shared. `playbackNotes` are the very pitches
  // the MEI carries, so the play button, the MIDI export and the engraving
  // cannot describe different chords — whatever the engraver decided is what
  // sounds. Handing `PlaybackControls` bare pitch classes to re-octave was
  // what let a bare `<StaffNotation notes={["C","E","G"]} />` draw C4-E4-G4
  // and play C3-E3-G3.
  const built = useMemo(
    () => buildMei(notes, { lhNotes, rhOctave, lhOctave, octaveQualifiedNotes }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notes.join(","), lhNotes?.join(","), rhOctave, lhOctave, octaveQualifiedNotes?.join(",")],
  );
  const mei = built.mei;

  // One render result, tagged with the request it answers. Storing the key
  // alongside the markup is what lets the effect below stop blanking state on
  // every run: a result for a superseded request simply stops matching, so the
  // engraving on screen always belongs to the current mei/font/scale, while a
  // request that is still in flight no longer has to announce itself by
  // clearing state first.
  const [result, setResult] = useState<
    { key: string; svg: string | null; failed: boolean } | null
  >(null);
  const nestRef = useRef<SVGGElement | null>(null);
  /** Last markup written into `nestRef`, so a size change alone doesn't re-parse it. */
  const injectedRef = useRef<string | null>(null);
  // The engraving node is unmounted whenever the component drops back to
  // loading (it is keyed apart from the loading node), so a remount starts from
  // an empty <g>. Forget what was injected then, or identical markup coming
  // back would be skipped as "already there" and the staff would never appear.
  const setNest = useCallback((node: SVGGElement | null) => {
    nestRef.current = node;
    if (!node) injectedRef.current = null;
  }, []);

  // Verovio scale is a percent; map the component's ~0.5 scale into its range.
  const verovioScale = Math.max(24, Math.round(scale * 80));

  // Identifies the engraving these props ask for. Memoized because playback
  // re-renders this component on every note, and `mei` is a few KB — rebuilding
  // and re-comparing that string per frame is pure churn. Memoized it is also
  // reference-equal, so the match below is a pointer compare.
  const renderKey = useMemo(
    () => `${font}|${verovioScale}|${mei}`,
    [font, verovioScale, mei],
  );

  useEffect(() => {
    let cancelled = false;
    renderMeiToSvg(mei, { font, scale: verovioScale })
      .then((svg) => {
        if (cancelled) return;
        // Same request, same markup: keep the object so the injection effect
        // below isn't handed a new identity for markup already on screen.
        setResult((prev) =>
          prev && prev.key === renderKey && prev.svg === svg && !prev.failed
            ? prev
            : { key: renderKey, svg, failed: false },
        );
      })
      // Recorded against the key rather than in a separate flag, so a later
      // retry of identical MEI still changes state and re-fires the injection
      // effect below — and so a failure can never be read as belonging to a
      // different request.
      .catch(() => {
        if (!cancelled) setResult({ key: renderKey, svg: null, failed: true });
      });
    return () => { cancelled = true; };
  }, [mei, font, verovioScale, renderKey]);

  // A result only counts for the request it was produced for. Anything else —
  // a superseded chord, font or scale — reads as "still rendering", so no
  // engraving is ever shown under props it does not match.
  const current = result && result.key === renderKey ? result : null;
  const staffSvg = current?.svg ?? null;
  const failed = current?.failed ?? false;
  const loading = staffSvg === null && !failed;

  // Elapsed-wait clock for the label below. It deliberately keys off `loading`
  // alone, not off the render request: a prop change while the toolkit is still
  // downloading queues a new request against the *same* in-flight download, so
  // restarting the timer would hide the explanation from precisely the user who
  // waited longest. It resets only when a wait actually ends.
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    if (!loading) {
      setSlowLoad(false);
      return;
    }
    if (slowLoad) return;
    const id = setTimeout(() => {
      // Elapsed time alone would lie on a warm engine. A board renders one
      // staff per card through a single main-thread toolkit, so past roughly
      // the fifteenth card the wait is pure queue depth — nothing is being
      // downloaded, and "first time only" on a warm-cache reload is exactly
      // the false alarm this label was added to prevent.
      if (!isVerovioReady()) setSlowLoad(true);
    }, SLOW_LOAD_LABEL_MS);
    return () => clearTimeout(id);
  }, [loading, slowLoad]);

  const size = staffSvg ? parseSvgSize(staffSvg) : { width: 160, height: 120 };
  const labelDrawn = Boolean(chordLabel && showLabel);
  const labelH = labelDrawn ? LABEL_HEIGHT : 0;
  const controlsH = showPlayback && notes.length > 0 ? CONTROLS_HEIGHT : 0;
  const totalWidth = Math.max(size.width, controlsH ? CONTROLS_WIDTH : 0, 120);
  // The playback controls force a minimum width, so the engraving is usually
  // stretched wider than Verovio drew it. Its height has to follow that scale:
  // reserving only `size.height` leaves a box taller than the engraving's own
  // aspect ratio, and a nested <svg> answers that with `xMidYMid meet` — it
  // centres itself in the surplus and pads the difference above the clef.
  const engScale = totalWidth / Math.max(size.width, 1);
  const engHeight = size.height * engScale;
  const totalHeight = engHeight + labelH + controlsH;

  // Inject the raw Verovio SVG into the nested <g> (imperatively, so React
  // doesn't try to reconcile Verovio's markup).
  useEffect(() => {
    const g = nestRef.current;
    if (!g) return;
    // Re-pinning on a size change alone must not re-parse ~50KB of markup.
    // Tracked in a ref, not a data- attribute: this subtree is cloned by the
    // SVG/PNG exporters, and a copy of the markup inside itself would ship.
    const next = staffSvg ?? "";
    if (injectedRef.current !== next) {
      g.innerHTML = next;
      injectedRef.current = next;
    }
    // Verovio runs with `svgViewBox: true`, so its root <svg> carries no
    // width/height and would otherwise resolve to 100% of the *outer* viewport
    // rather than the strip left for it below the label and controls.
    const inner = g.querySelector("svg");
    if (inner) {
      inner.setAttribute("width", String(totalWidth));
      inner.setAttribute("height", String(engHeight));
    }
  }, [staffSvg, totalWidth, engHeight]);

  // Verovio preserves the MEI xml:id on each engraved note. Toggle a class on
  // those stable targets so staff paint follows the same index timeline as the
  // keyboard, even when grand-staff engraving reorders RH before LH in the DOM.
  useEffect(() => {
    const g = nestRef.current;
    if (!g) return;
    g.querySelectorAll(".bc-staff-note-active").forEach((note) => {
      note.classList.remove("bc-staff-note-active");
    });
    visibleActiveIndices.forEach((index) => {
      g.querySelector(`[id="chordl-playback-note-${index}"]`)
        ?.classList.add("bc-staff-note-active");
    });
  }, [staffSvg, visibleActiveIndices]);

  const staffColor = ui.text ?? "#333";
  const controlsX = totalWidth - CONTROLS_WIDTH + 4;

  return (
    <svg
      viewBox={`0 0 ${totalWidth} ${totalHeight}`}
      xmlns="http://www.w3.org/2000/svg"
      className={`bc-staff ${className ?? ""}`.trim()}
      // Verovio glyphs use `currentColor`; set it to the theme text color so
      // the engraving stays visible in dark mode (not left to CSS inheritance).
      style={{
        width: "100%",
        maxWidth: totalWidth * 1.6,
        color: staffColor,
        ["--bc-playback-highlight" as string]: playbackHighlightColor,
        ...style,
      }}
      role="img"
      aria-label={chordLabel ? `Staff notation: ${chordLabel}` : "Staff notation"}
    >
      <style>{`
        .bc-staff-note-active { animation: bc-staff-note-pulse 0.35s ease-out infinite alternate; }
        .bc-staff-note-active path,
        .bc-staff-note-active use { fill: var(--bc-playback-highlight) !important; stroke: var(--bc-playback-highlight) !important; }
        @keyframes bc-staff-note-pulse {
          from { filter: drop-shadow(0 0 1px var(--bc-playback-highlight)); }
          to { filter: drop-shadow(0 0 5px var(--bc-playback-highlight)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bc-staff-note-active { animation: none !important; }
        }
      `}</style>
      {controlsH > 0 && (
        <g data-controls="">
          <PlaybackControls
            notes={built.playbackNotes}
            lhNotes={lhNotes}
            rhOctave={rhOctave}
            lhOctave={lhOctave}
            chordName={chordLabel ?? notes.join("-")}
            x={controlsX}
            y={4}
            arpeggioBpm={arpeggioBpm}
            onActiveChange={(indices) => {
              setInternalActiveIndices(indices);
              onPlaybackActiveChange?.(indices);
            }}
            onPlaybackSpecChange={onPlaybackSpecChange}
          />
        </g>
      )}

      {labelDrawn && (
        <text
          className="bc-staff__label"
          x={size.width / 2}
          y={controlsH + LABEL_HEIGHT - 5}
          textAnchor="middle"
          fontSize={13}
          fontWeight={600}
          fill={staffColor}
          fontFamily="system-ui, sans-serif"
        >
          {chordLabel}
        </text>
      )}

      {failed ? (
        <text
          x={totalWidth / 2}
          y={controlsH + labelH + 20}
          textAnchor="middle"
          fontSize={11}
          fill={ui.textMuted ?? "#888"}
          fontFamily="system-ui, sans-serif"
        >
          notation unavailable
        </text>
      ) : loading ? (
        // Keyed apart from the engraving <g> below: both are <g> in the same
        // ternary slot, so without distinct keys React reuses one DOM node
        // across the two states and the imperatively injected Verovio markup
        // survives into the loading state — old staff, loading transform,
        // placeholder viewBox.
        <g
          key="loading"
          className="bc-render-loading bc-staff__loading"
          role="status"
          // A live region announces content *mutations*; NVDA, JAWS and
          // VoiceOver all ignore an aria-label swapped on the region itself.
          // So this name stays put and the slow-path explanation below is real
          // text inside the region, which is what actually gets announced.
          aria-label="Rendering notation"
          transform={`translate(${totalWidth / 2 - 14}, ${controlsH + labelH + Math.max(engHeight / 2, 14)})`}
          fill={ui.textMuted ?? "#888"}
        >
          {[0, 1, 2].map((index) => (
            <circle key={index} cx={index * 14} cy={0} r={3} opacity={0.25}>
              <animate
                attributeName="opacity"
                values="0.25;1;0.25"
                dur="0.9s"
                begin={`${index * 0.15}s`}
                repeatCount="indefinite"
              />
            </circle>
          ))}
          {slowLoad && (
            // Two short lines rather than one long one: the staff box is only
            // ~120px wide at its narrowest, and the outer <svg> would clip a
            // single run of this text.
            <text
              className="bc-staff__loading-label"
              x={14}
              y={18}
              textAnchor="middle"
              fontSize={9}
              fontWeight={500}
              fill={ui.textMuted ?? "#888"}
              fontFamily="Poppins, system-ui, sans-serif"
            >
              {/* Trailing space so the two lines read as one sentence when a
                  screen reader concatenates the region's text rather than
                  pausing between nodes. It renders as a single trailing space
                  on a centred 9px line — about a pixel of drift, invisible. */}
              <tspan className="bc-staff__loading-label-title" x={14} dy={0}>{`${SLOW_LOAD_TITLE} `}</tspan>
              <tspan className="bc-staff__loading-label-note" x={14} dy={11} opacity={0.75}>{SLOW_LOAD_SUBTITLE}</tspan>
            </text>
          )}
        </g>
      ) : (
        // Verovio's SVG is injected here imperatively (see effect above).
        <g key="engraving" ref={setNest} className="bc-staff__engraving" transform={`translate(0, ${controlsH + labelH})`} />
      )}
    </svg>
  );
}
