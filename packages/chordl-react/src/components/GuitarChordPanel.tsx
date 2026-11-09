import { lazy, Suspense } from "react";
import { GuitarLoading } from "./GuitarLoading";
import type { CSSProperties } from "react";
import type { InstrumentId, ExperienceLevel } from "@pepperhorn/chordl-guitar";
import type { UIThemeMode } from "../config";
import type { FrameOrientation, FrameLineStyle } from "./GuitarChord";
import type { PlaybackSpecSnapshot } from "../types";

export interface GuitarChordPanelProps {
  /** NL chord string (same input the piano view takes). */
  chord: string;
  instrument?: InstrumentId;
  /** Frame appearance; changes are reported so hosts can persist them. */
  orientation?: FrameOrientation;
  onOrientationChange?: (orientation: FrameOrientation) => void;
  lineStyle?: FrameLineStyle;
  onLineStyleChange?: (lineStyle: FrameLineStyle) => void;
  /** Fires when the user picks a different instrument, so hosts can persist it. */
  onInstrumentChange?: (instrument: InstrumentId) => void;
  /**
   * Index of the fret position to show. Like `instrument`, this seeds internal
   * state and re-syncs whenever the prop changes, so a host can either leave it
   * alone or drive it. Out-of-range values clamp to the last available shape.
   */
  position?: number;
  /** Fires when the user picks a different fret position. */
  onPositionChange?: (position: number) => void;
  /**
   * Difficulty filter on the frame's alternate shapes — "can I play this
   * yet". The panel draws no control of its own for this — unlike
   * `instrument`/`position`, which the panel can also drive itself when
   * uncontrolled — the host owns the value entirely, and it is expected to
   * come from a control the host renders (`dev/App.tsx`'s level radios, for
   * one). Default "established" when the host doesn't pass one at all. Only
   * affects rendering when `showControls` is true — a board card pins one
   * exact shape via `position` and must keep showing exactly that shape, so
   * it never runs the filter, even if this prop is set.
   */
  level?: ExperienceLevel;
  /**
   * Show instrument, frame appearance and A/B/C position toggles. Default true; board cards
   * render one fixed shape and pass false.
   */
  showControls?: boolean;
  /**
   * Number of frets to draw. Optional — the panel always computes a floor
   * from the shape actually on screen (the highest window-relative fret it
   * uses) and never draws fewer than that, so a request below the floor can
   * widen the window but never crop the chord. That floor is at most 4 for
   * any fretted shape in the corpus — tighter than the instrument's own
   * default of 5 — except for a shape with no fretted string at all (every
   * string open or muted, e.g. ukulele Am7/C6, guitar Em/D), which has
   * nothing to floor on and falls back to the instrument's own default width
   * instead. Default is the floor itself.
   */
  frets?: number;
  scale?: number;
  uiTheme?: UIThemeMode;
  title?: string;
  subheading?: string;
  footerText?: string;
  className?: string;
  style?: CSSProperties;
  /**
   * Show chord/strum playback. Defaults to the value of `showControls`, so a
   * legacy static panel stays static unless playback is explicitly enabled.
   */
  showPlayback?: boolean;
  arpeggioBpm?: number;
  playbackHighlightColor?: string;
  /**
   * Controlled active note indices — positions in this frame's own playback
   * order, i.e. into the `notes` array reported by `onPlaybackSpecChange`
   * (sounding strings only, low to high). The panel maps them onto the
   * physical strings the fretboard paints, so a host that owns the timeline
   * (a board playing its cards) does not need the string mapping itself.
   * Absent it, the panel's own playback controls drive the highlight.
   */
  activePlaybackIndices?: number[];
  onPlaybackSpecChange?: (spec: PlaybackSpecSnapshot) => void;
}

const Renderer = lazy(() => import("./GuitarChordPanelImpl").then((m) => ({ default: m.GuitarChordPanel })));

/** Keep heavy rendering code off the public entry until the first render. */
export function GuitarChordPanel(props: GuitarChordPanelProps) {
  return <Suspense fallback={<GuitarLoading className={props.className} style={props.style} />}><Renderer {...props} /></Suspense>;
}
