import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  GuitarChord, PianoKeyboard, preloadInstruments, startPlayback,
  DEFAULT_WHITE_FILL, DEFAULT_BLACK_FILL, DEFAULT_PLAYBACK_HIGHLIGHT_COLOR,
  DEFAULT_ARPEGGIO_BPM, MIN_ARPEGGIO_BPM, MAX_ARPEGGIO_BPM,
} from "@pepperhorn/chordl-react";
import type { PlaybackController } from "@pepperhorn/chordl-react";
import { INSTRUMENTS } from "@pepperhorn/chordl-guitar";
import {
  faceNoteNames, handBracketsFor, requestFor,
  type CardFace, type FaceRequest, type FrettedShape, type GuitarFaceRequest, type KeyboardFaceRequest,
} from "./faces";
import { playbackFor, type FacePlayback } from "./playback";
import { ChordText } from "./ChordText";
import { fullChordName } from "./names";
import type { Theme } from "./theme";

export interface ChordCardPlayerProps {
  /** Chord symbol as the deck writes it: "C", "F#m7", "Ebmaj7", "C/E". */
  chord: string;
  /** The printed face to play. */
  face: CardFace;
  /** The same theme JSON print uses, parsed with `parseTheme`. */
  theme: Theme;
  className?: string;
}

type Mode = "block" | "arpeggio" | "hands";
type Status = "idle" | "loading" | "error";

const FACE_LABELS: Record<CardFace, string> = {
  keyboard: "keyboard",
  "keyboard-hands": "exploded triad, two hands",
  "guitar-top3": "guitar, top three strings",
  guitar: "guitar",
  ukulele: "ukulele",
  bass4: "four-string bass",
};

/**
 * Default look: crf-staff's "White / Tiles" — white surfaces, ink text, 1.5px
 * ink borders on controls, 10px control radius, no shadows, green fill for the
 * primary action, yellow for the selected one, ink text on every fill, 44px
 * targets. Every colour is a custom property declared at zero specificity
 * (`:where`), so a host's `.chord-card-player { --ccp-primary: … }` wins
 * without !important. The diagram's own colours come from the card theme.
 */
const CSS = `
:where(.chord-card-player) {
  --ccp-surface: #ffffff;
  --ccp-ink: #141210;
  --ccp-muted: #5a5651;
  --ccp-border: #141210;
  --ccp-hairline: #dcd9d3;
  --ccp-primary: #6bc6a0;
  --ccp-primary-hover: #81cfae;
  --ccp-selected: #fff56d;
  --ccp-hover: #f6f5f2;
  --ccp-radius: 10px;
  --ccp-border-width: 1.5px;
}
.chord-card-player {
  display: flex; flex-direction: column; gap: 12px;
  background: var(--ccp-surface); color: var(--ccp-ink);
  font-family: var(--ccp-font, Poppins, sans-serif);
}
.chord-card-player .ccp-diagram { width: 100%; }
.chord-card-player .ccp-diagram--guitar { display: flex; justify-content: center; }
.chord-card-player .bc-note-name,
.chord-card-player .bc-keyboard text { font-family: var(--ccp-font, Poppins, sans-serif) !important; }
.chord-card-player .ccp-controls {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px;
}
.chord-card-player .ccp-btn {
  min-height: 44px; min-width: 44px; padding: 0 16px;
  border: var(--ccp-border-width) solid var(--ccp-border); border-radius: var(--ccp-radius);
  background: var(--ccp-surface); color: var(--ccp-ink);
  font: 600 0.95rem/1 var(--ccp-font, Poppins, sans-serif);
  cursor: pointer; box-shadow: none;
}
.chord-card-player .ccp-btn:hover { background: var(--ccp-hover); }
.chord-card-player .ccp-btn--primary { background: var(--ccp-primary); }
.chord-card-player .ccp-btn--primary:hover { background: var(--ccp-primary-hover); }
.chord-card-player .ccp-btn[aria-pressed="true"] { background: var(--ccp-selected); }
.chord-card-player .ccp-btn:focus-visible,
.chord-card-player .ccp-tempo-slider:focus-visible {
  outline: 2px solid var(--ccp-ink); outline-offset: 2px;
}
.chord-card-player .ccp-tempo {
  display: inline-flex; align-items: center; gap: 8px; min-height: 44px;
  font: 600 0.95rem/1 var(--ccp-font, Poppins, sans-serif);
}
.chord-card-player .ccp-tempo-slider { min-height: 44px; width: 140px; accent-color: var(--ccp-primary); }
.chord-card-player .ccp-tempo-value { min-width: 4.5em; font-variant-numeric: tabular-nums; }
.chord-card-player .ccp-status { min-height: 1.2em; margin: 0; text-align: center; color: var(--ccp-muted); font-size: 0.85rem; }
.chord-card-player .ccp-badge { margin: 0; text-align: center; color: var(--ccp-muted); font-size: 0.85rem; }
.chord-card-player .ccp-badge--generated { font-style: italic; }
.chord-card-player .ccp-error { margin: 0; padding: 12px; border: var(--ccp-border-width) solid var(--ccp-border); border-radius: var(--ccp-radius); }
@media (prefers-reduced-motion: no-preference) {
  .chord-card-player .ccp-btn { transition: background-color 120ms ease; }
}
@media (prefers-reduced-motion: reduce) {
  .chord-card-player *, .chord-card-player *::before, .chord-card-player *::after {
    animation: none !important; transition: none !important;
  }
}
`;

/** chordl-react key fills from the request's per-pitch colours (as chordcards' render host does). */
function pitchTheme(pitchColors: Record<string, string>) {
  return {
    name: "chordl-cards-pitch",
    whiteKey: (note: string, highlighted: boolean) =>
      highlighted ? (pitchColors[note] ?? DEFAULT_WHITE_FILL) : DEFAULT_WHITE_FILL,
    blackKey: (note: string, highlighted: boolean) =>
      highlighted ? (pitchColors[note] ?? DEFAULT_BLACK_FILL) : DEFAULT_BLACK_FILL,
  };
}

/** Give each sounding string's marker the class GuitarChord paints during playback. */
function decorateForPlayback(shape: FrettedShape, strings: number): FrettedShape {
  const fingers = shape.fingers.map((finger) => {
    const [stringNo, fret, label] = finger as [number, number | string, unknown];
    if (typeof fret !== "number") return finger;
    const existing = typeof label === "object" && label !== null ? (label as Record<string, unknown>) : {};
    const text = typeof label === "string" ? label : existing.text;
    return [stringNo, fret, {
      ...existing,
      ...(text !== undefined ? { text } : {}),
      className: `${(existing.className as string | undefined) ?? ""} bc-playback-string-${strings - stringNo}`.trim(),
    }];
  });
  return { ...shape, fingers } as FrettedShape;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * One printed card face, playable: the static diagram renders immediately (no
 * audio is fetched until a control is used), and stays if the sound fails.
 * One audio timeline drives sound and key/string paint (chordl-react's
 * `startPlayback`); the diagrams are chordl-react's own, driven in controlled
 * mode with their built-in controls off.
 */
export function ChordCardPlayer({ chord, face, theme, className }: ChordCardPlayerProps) {
  const built = useMemo((): { req: FaceRequest; playback: FacePlayback } | { error: string } => {
    try {
      const req = requestFor(chord, face, theme);
      return { req, playback: playbackFor(req) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }, [chord, face, theme]);

  const [bpm, setBpm] = useState(theme.playback?.arpeggioBpm ?? DEFAULT_ARPEGGIO_BPM);
  const [active, setActive] = useState<number[]>([]);
  const [playing, setPlaying] = useState<Mode | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const run = useRef(0);
  const controllers = useRef<PlaybackController[]>([]);
  const tempoId = useId();
  const highlight = theme.playback?.highlightColor ?? DEFAULT_PLAYBACK_HIGHLIGHT_COLOR;

  const stop = useCallback(() => {
    run.current++;
    controllers.current.forEach((c) => c.cancel());
    controllers.current = [];
    setActive([]);
    setPlaying(null);
  }, []);
  // A new chord, face or unmount ends whatever was sounding.
  useEffect(() => stop, [chord, face, stop]);

  const play = useCallback(async (mode: Mode) => {
    if ("error" in built) return;
    const { playback } = built;
    stop();
    const id = ++run.current;
    const live = () => run.current === id;
    setPlaying(mode);
    setStatus("loading");

    // Start one block/arpeggio of `notes`, painting through `indexOf` (its
    // positions -> the face's note indices) while `current()` holds.
    const begin = async (notes: number[], indexOf: number[], m: "block" | "arpeggio", current: () => boolean) => {
      const c = await startPlayback(notes, {
        mode: m,
        instrument: playback.instrument,
        bpm,
        onActiveChange: (indices) => {
          if (live() && current()) setActive(indices.map((i) => indexOf[i]));
        },
      });
      if (!live()) { c.cancel(); return null; }
      controllers.current.push(c);
      setStatus("idle");
      return c;
    };

    try {
      let last: PlaybackController | null;
      if (mode === "hands" && playback.hands) {
        const { lh, rh } = playback.hands;
        let phase: "lh" | "rh" = "lh";
        if (!(await begin(lh.map((i) => playback.notes[i]), lh, "block", () => phase === "lh"))) return;
        await sleep(60000 / bpm); // one beat
        if (!live()) return;
        phase = "rh";
        last = await begin(rh.map((i) => playback.notes[i]), rh, "block", () => phase === "rh");
      } else {
        const order = playback.notes.map((_, i) => i);
        last = await begin(playback.notes, order, mode === "arpeggio" ? "arpeggio" : "block", () => true);
      }
      if (!last) return;
      await last.completion;
      if (live()) {
        controllers.current = [];
        setActive([]);
        setPlaying(null);
      }
    } catch {
      if (live()) {
        setStatus("error");
        setActive([]);
        setPlaying(null);
      }
    }
  }, [built, bpm, stop]);

  const preload = useCallback(() => {
    if (!("error" in built)) void preloadInstruments([built.playback.instrument]);
  }, [built]);

  const rootClass = `chord-card-player ${className ?? ""}`.trim();
  // Spoken, not spelled: "Ebmaj7" would be read "e b maj seven".
  const spoken = fullChordName(chord);
  const rootStyle = { "--ccp-font": theme.fonts.families.ui } as CSSProperties;

  if ("error" in built) {
    return (
      <section className={rootClass} data-face={face} style={rootStyle} aria-label={`${spoken}, ${FACE_LABELS[face]}`}>
        <style>{CSS}</style>
        <p className="ccp-error" role="alert">
          This card cannot show “{chord}” as {FACE_LABELS[face]}: {built.error}
        </p>
      </section>
    );
  }

  const { req, playback } = built;
  const pressed = (m: Mode) => String(playing === m) as "true" | "false";

  return (
    <section className={rootClass} data-face={face} style={rootStyle} aria-label={`${spoken}, ${FACE_LABELS[face]}`}>
      <style>{CSS}</style>
      <div className={`ccp-diagram ccp-diagram--${req.kind}`}>
        {req.kind === "keyboard"
          ? <KeyboardDiagram req={req} chord={chord} face={face} active={active} highlight={highlight} />
          : <GuitarDiagram req={req} playback={playback} active={active} highlight={highlight} />}
      </div>
      {req.kind === "guitar" && req.generated && (
        <p className="ccp-badge ccp-badge--generated" data-omitted={req.omitted?.join(" ") || undefined}>
          Generated voicing — pending teacher review
          {req.omitted && req.omitted.length > 0 && (
            <span className="ccp-badge-omitted"> (leaves out {req.omitted.join(", ")})</span>
          )}
        </p>
      )}
      <div
        className="ccp-controls"
        role="group"
        aria-label={`${spoken} playback`}
        aria-busy={status === "loading"}
        onPointerEnter={preload}
        onFocus={preload}
      >
        <button type="button" className="ccp-btn ccp-btn--primary btn-play-chord" aria-pressed={pressed("block")} onClick={() => play("block")}>
          Play chord
        </button>
        <button type="button" className="ccp-btn btn-play-arpeggio" aria-pressed={pressed("arpeggio")} onClick={() => play("arpeggio")}>
          Play arpeggio
        </button>
        {playback.hands && (
          <button type="button" className="ccp-btn btn-play-hands" aria-pressed={pressed("hands")} onClick={() => play("hands")}>
            L.H. then R.H.
          </button>
        )}
        <span className="ccp-tempo">
          <label className="ccp-tempo-label" htmlFor={tempoId}>Tempo</label>
          <input
            id={tempoId}
            className="ccp-tempo-slider"
            type="range"
            min={MIN_ARPEGGIO_BPM}
            max={MAX_ARPEGGIO_BPM}
            step={1}
            value={bpm}
            aria-valuetext={`${bpm} BPM`}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <output className="ccp-tempo-value" htmlFor={tempoId}>{bpm} BPM</output>
        </span>
      </div>
      <p className="ccp-status" role="status" aria-live="polite">
        {status === "loading" ? "Loading sound…" : status === "error" ? "Sound could not load. The diagram still shows the chord." : ""}
      </p>
    </section>
  );
}

/** Note names set like print's: Poppins SemiBold with drawn accidentals. */
const renderNoteName = (name: string) => <ChordText text={name} weight={600} />;

function KeyboardDiagram({ req, chord, face, active, highlight }: {
  req: KeyboardFaceRequest; chord: string; face: CardFace; active: number[]; highlight: string;
}) {
  return (
    <PianoKeyboard
      className="ccp-keyboard"
      size={req.size}
      startFrom={req.startFrom as never}
      format={req.format}
      highlightKeys={req.notes as never}
      {...(req.pitchColors
        ? { theme: pitchTheme(req.pitchColors) as never }
        : { highlightColor: req.highlightColor ?? undefined })}
      chordLabel={chord}
      handBrackets={handBracketsFor(req)}
      showPlayback={false}
      showNoteNames
      displayNoteNames={faceNoteNames(chord, face)}
      renderNoteName={renderNoteName}
      // One baseline under the keys, as print sets them: chordl-react's
      // default lifts sharps and flats a row above the naturals.
      staggerNoteNames={false}
      uiTheme="light"
      scale={1}
      activePlaybackIndices={active}
      playbackHighlightColor={highlight}
    />
  );
}

function GuitarDiagram({ req, playback, active, highlight }: {
  req: GuitarFaceRequest; playback: FacePlayback; active: number[]; highlight: string;
}) {
  const inst = INSTRUMENTS[req.instrument];
  const shape = useMemo(() => decorateForPlayback(req.shape, inst.strings), [req.shape, inst.strings]);
  const strings = playback.strings ?? [];
  // svguitar writes its <text> with no weight; the theme's weights go on here
  // (finger numbers from fretFingerText, the tuning row from stringLabel).
  const fontCss = `
.chord-card-player .ccp-guitar text { font-family: ${req.labelFontFamily}; font-weight: ${req.labelFontWeight}; }
.chord-card-player .ccp-guitar text.finger-text { font-family: ${req.fontFamily}; font-weight: ${req.fingerTextWeight}; }`;
  return (
    <>
      <style>{fontCss}</style>
      <GuitarChord
        className="ccp-guitar"
        chord={shape as never}
        frets={inst.frets}
        settings={{
          strings: inst.strings,
          tuning: inst.tuning,
          fingerColor: req.fingerColor,
          fingerTextColor: req.fingerTextColor,
          fingerTextSize: req.fingerTextSize,
          fingerStrokeColor: req.fingerStrokeColor,
          fingerStrokeWidth: req.fingerStrokeWidth,
          fontFamily: req.fontFamily,
          backgroundColor: "transparent",
          color: req.diagramColor,
        }}
        activeStrings={active.map((i) => strings[i]).filter((s) => s !== undefined)}
        playbackHighlightColor={highlight}
      />
    </>
  );
}
