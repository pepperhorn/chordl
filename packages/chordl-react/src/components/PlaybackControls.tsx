import { useState, useCallback, useEffect, useMemo } from "react";
import { noteToMidi, toAscendingNotes } from "../audio/playback";
import { usePlaybackTimeline } from "../audio/usePlaybackTimeline";
import type { PlaybackInstrument } from "@pepperhorn/chordl-core";
import { DEFAULT_ARPEGGIO_BPM } from "@pepperhorn/chordl-core";
import type { PlaybackSpecSnapshot } from "../types";
import { downloadMidi } from "@pepperhorn/chordl-core";
import { downloadSvg, downloadPng } from "../audio/svg-export";
import { copyDottlClip } from "../audio/dottl-export";
import { useUITheme } from "../ui-theme";

interface PlaybackControlsProps {
  /**
   * The notes to sound, in voicing order. Prefer names that already carry
   * their octave ("C4", "Bb3") — those pass through untouched, which is how
   * the staff and the keyboard guarantee the button sounds what they drew.
   * Bare pitch classes are stacked upward from the octaves below, and that
   * fallback can only ever guess at a placement the caller already knows.
   */
  notes: string[];
  /**
   * Which leading entries of `notes` belong to the left hand. Only the count
   * is read: it splits `notes` for the two MIDI-export tracks and for the
   * per-hand octave fallback.
   */
  lhNotes?: string[];
  /** Octave to stack bare right-hand pitch classes from (default 3). */
  rhOctave?: number;
  /** Octave to stack bare left-hand pitch classes from (default 2). */
  lhOctave?: number;
  chordName: string;
  x: number;
  y: number;
  arpeggioBpm?: number;
  instrument?: PlaybackInstrument;
  onActiveChange?: (indices: number[]) => void;
  onPlaybackSpecChange?: (spec: PlaybackSpecSnapshot) => void;
}

const ICON_SIZE = 16;
const BTN_SIZE = 22;
const GAP = 4;
const SECTION_GAP = 10;

export function PlaybackControls({
  notes, lhNotes, rhOctave, lhOctave, chordName, x, y,
  arpeggioBpm = DEFAULT_ARPEGGIO_BPM,
  instrument = "acoustic_grand_piano",
  onActiveChange,
  onPlaybackSpecChange,
}: PlaybackControlsProps) {
  const { tokens: ui } = useUITheme();
  const { play, playing } = usePlaybackTimeline(onActiveChange);

  const lhCount = lhNotes?.length ?? 0;
  const lhOct = lhOctave ?? 2;
  const rhOct = rhOctave ?? 3;
  // Strip octave-qualifier colon format ("C#:0" → "C#") to get pure pitch classes
  const cleanNotes = notes.map((n) => n.replace(/:.*$/, ""));
  // Build playable notes: assign ascending octaves per hand so notes rise properly
  // e.g. G#, B, E with base octave 4 → G#4, B4, E5 (not E4)
  const playableNotes = useMemo(() => {
    if (lhCount > 0) {
      const lhPCs = cleanNotes.slice(0, lhCount);
      const rhPCs = cleanNotes.slice(lhCount);
      return [...toAscendingNotes(lhPCs, lhOct), ...toAscendingNotes(rhPCs, rhOct)];
    }
    return toAscendingNotes(cleanNotes, rhOct);
  }, [cleanNotes.join("|"), lhCount, lhOct, rhOct]);

  useEffect(() => {
    onPlaybackSpecChange?.({
      notes: playableNotes.map(noteToMidi),
      instrument,
    });
  }, [instrument, onPlaybackSpecChange, playableNotes]);

  const handleBlock = useCallback(async () => {
    if (playing) return;
    await play(playableNotes, { mode: "block", instrument, bpm: arpeggioBpm });
  }, [arpeggioBpm, instrument, play, playableNotes, playing]);

  const handleArp = useCallback(async () => {
    if (playing) return;
    await play(playableNotes, { mode: "arpeggio", instrument, bpm: arpeggioBpm });
  }, [arpeggioBpm, instrument, play, playableNotes, playing]);

  // The exported file is a third rendering of the same chord, so it gets the
  // same resolved pitches the speaker does — not the raw prop with the hands
  // re-split by name, which wrote a slash chord's bass note into both tracks
  // and put the right hand at a default octave unrelated to the engraving.
  const handleMidi = useCallback(() => {
    downloadMidi(playableNotes, chordName, rhOct, playableNotes.slice(0, lhCount), lhOct);
  }, [playableNotes, chordName, rhOct, lhCount, lhOct]);

  const findParentSvg = useCallback((e: React.MouseEvent) => {
    return (e.currentTarget as SVGElement).closest("svg") as SVGSVGElement | null;
  }, []);

  const handleSvgDownload = useCallback((e: React.MouseEvent) => {
    const svg = findParentSvg(e);
    if (svg) downloadSvg(svg, chordName);
  }, [chordName, findParentSvg]);

  const handlePngDownload = useCallback((e: React.MouseEvent) => {
    const svg = findParentSvg(e);
    if (svg) downloadPng(svg, chordName);
  }, [chordName, findParentSvg]);

  const [dottlCopied, setDottlCopied] = useState(false);
  const handleDottlCopy = useCallback(async () => {
    const root = cleanNotes[0];
    const ok = await copyDottlClip(playableNotes, root);
    if (ok) {
      setDottlCopied(true);
      setTimeout(() => setDottlCopied(false), 1500);
    }
  }, [playableNotes, cleanNotes]);

  const btnStyle = {
    cursor: "pointer" as const,
    opacity: playing ? 0.5 : 1,
  };

  // Button positions
  const audioGroupW = 2 * BTN_SIZE + GAP;
  const downloadGroupW = 4 * BTN_SIZE + 3 * GAP;
  const totalW = audioGroupW + SECTION_GAP + downloadGroupW;

  const renderBtn = (
    bx: number,
    fill: string,
    onClick: (e: React.MouseEvent) => void,
    label: string,
    style: React.CSSProperties,
    children: React.ReactNode,
    isActive = false,
  ) => (
    <g
      transform={`translate(${bx}, ${y})`}
      onClick={onClick}
      style={style}
      role="button"
      aria-label={label}
    >
      {/* Base fill */}
      <rect
        width={BTN_SIZE}
        height={BTN_SIZE}
        rx={5}
        fill={fill}
        stroke={ui.playbackBtnBorder}
        strokeWidth={0.5}
      />
      {/* Glass gradient overlay */}
      <rect
        width={BTN_SIZE}
        height={BTN_SIZE}
        rx={5}
        fill={`url(#${isActive ? activeGlassId : glassId})`}
      />
      {/* Top edge shine */}
      <line
        x1={6}
        y1={1.5}
        x2={BTN_SIZE - 6}
        y2={1.5}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={0.5}
        strokeLinecap="round"
      />
      {children}
    </g>
  );

  const iconOffset = `translate(${(BTN_SIZE - ICON_SIZE) / 2}, ${(BTN_SIZE - ICON_SIZE) / 2})`;

  // Unique gradient IDs to avoid collisions when multiple chords render
  const glassId = `btn-glass-${x}-${y}`;
  const activeGlassId = `btn-glass-active-${x}-${y}`;

  return (
    <g className="bc-playback-controls">
      {/* Button glass gradients */}
      <defs>
        <linearGradient id={glassId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.02)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.06)" />
        </linearGradient>
        <linearGradient id={activeGlassId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.03)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.08)" />
        </linearGradient>
      </defs>


      {/* Block chord button */}
      {renderBtn(
        x,
        playing === "block" ? ui.playbackActive : ui.playbackBg,
        handleBlock,
        "Play block chord",
        btnStyle,
        <g transform={iconOffset}>
          <polygon points="2,5 5,5 9,2 9,14 5,11 2,11" fill={ui.iconFill} />
          <path d="M11,5.5 C12.5,6.5 12.5,9.5 11,10.5" stroke={ui.iconFill} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M12.5,3.5 C15,5.5 15,10.5 12.5,12.5" stroke={ui.iconFill} strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </g>,
        playing === "block",
      )}

      {/* Arpeggiate button */}
      {renderBtn(
        x + BTN_SIZE + GAP,
        playing === "arpeggio" ? ui.playbackActive : ui.playbackBg,
        handleArp,
        "Play arpeggiated",
        btnStyle,
        <g transform={iconOffset}>
          <path d="M8,14 C6,11 10,9 8,7 C6,5 10,3 8,1" stroke={ui.iconFill} strokeWidth="1.8" fill="none" strokeLinecap="round" />
          <polygon points="5,3 8,0 11,3" fill={ui.iconFill} />
        </g>,
        playing === "arpeggio",
      )}

      {/* MIDI download button */}
      {renderBtn(
        x + audioGroupW + SECTION_GAP,
        ui.playbackBg,
        handleMidi,
        "Download MIDI file",
        { cursor: "pointer" },
        <text x={BTN_SIZE / 2} y={BTN_SIZE / 2 + 3} textAnchor="middle" fontSize={6} fontWeight="bold" fill={ui.iconFill} fontFamily="system-ui, sans-serif">MIDI</text>,
      )}

      {/* SVG download button */}
      {renderBtn(
        x + audioGroupW + SECTION_GAP + BTN_SIZE + GAP,
        ui.playbackBg,
        handleSvgDownload,
        "Download SVG",
        { cursor: "pointer" },
        <text x={BTN_SIZE / 2} y={BTN_SIZE / 2 + 3} textAnchor="middle" fontSize={7} fontWeight="bold" fill={ui.iconFill} fontFamily="system-ui, sans-serif">SVG</text>,
      )}

      {/* PNG download button */}
      {renderBtn(
        x + audioGroupW + SECTION_GAP + 2 * (BTN_SIZE + GAP),
        ui.playbackBg,
        handlePngDownload,
        "Download PNG",
        { cursor: "pointer" },
        <text x={BTN_SIZE / 2} y={BTN_SIZE / 2 + 3} textAnchor="middle" fontSize={7} fontWeight="bold" fill={ui.iconFill} fontFamily="system-ui, sans-serif">PNG</text>,
      )}

      {/* Dottl clipboard copy button */}
      {renderBtn(
        x + audioGroupW + SECTION_GAP + 3 * (BTN_SIZE + GAP),
        dottlCopied ? ui.playbackActive : ui.playbackBg,
        handleDottlCopy,
        "Copy chord for dottl.app",
        { cursor: "pointer" },
        dottlCopied
          ? <text x={BTN_SIZE / 2} y={BTN_SIZE / 2 + 3} textAnchor="middle" fontSize={6} fontWeight="bold" fill={ui.iconFill} fontFamily="system-ui, sans-serif">OK!</text>
          : <g transform={`translate(${BTN_SIZE / 2 - 6}, ${BTN_SIZE / 2 - 6.5})`}>
              {/* Bold "D" outline */}
              <path d="M2,1 L2,12 L6.5,12 C10,12 12,9.5 12,6.5 C12,3.5 10,1 6.5,1 Z M4,3 L6,3 C8.5,3 10,4.5 10,6.5 C10,8.5 8.5,10 6,10 L4,10 Z" fill={ui.iconFill} />
              {/* Colorful dots inside the D */}
              <circle cx="6" cy="5" r="0.9" fill="#22c55e" />
              <circle cx="8" cy="5" r="0.9" fill="#3b82f6" />
              <circle cx="6" cy="7" r="0.9" fill="#f59e0b" />
              <circle cx="8" cy="7" r="0.9" fill="#a855f7" />
              <circle cx="6" cy="9" r="0.9" fill="#ef4444" />
              <circle cx="8" cy="9" r="0.9" fill="#06b6d4" />
            </g>,
      )}
    </g>
  );
}
