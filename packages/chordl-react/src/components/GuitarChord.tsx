import { lazy, Suspense } from "react";
import { GuitarLoading } from "./GuitarLoading";
import type { CSSProperties } from "react";
import type { Chord, ChordSettings } from "svguitar";
export type FrameOrientation = "vertical" | "horizontal";
export type FrameLineStyle = "clean" | "handdrawn";

export interface GuitarChordProps {
  /** Direction of the neck. Defaults to vertical. */
  orientation?: FrameOrientation;
  /** Subtle hand-drawn fret/string lines; labels and note targets stay crisp. */
  lineStyle?: FrameLineStyle;
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

// Keep heavy rendering code off the public entry until the first render.
const Renderer = lazy(() => import("./GuitarChordImpl").then((m) => ({ default: m.GuitarChord })));

/**
 * Render a single guitar chord diagram (fretboard "frame") with svguitar.
 *
 * svguitar draws imperatively into a DOM node, so we render into a ref'd div in
 * an effect and clear it on unmount — the same pattern the Verovio staff uses.
 * Colors come from the UI theme so the diagram stays visible in dark mode.
 */
export function GuitarChord(props: GuitarChordProps) {
  return <Suspense fallback={<GuitarLoading className={props.className} style={props.style} />}><Renderer {...props} /></Suspense>;
}
