import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DEFAULT_PLAYBACK_HIGHLIGHT_COLOR, parseChordDescription } from "@pepperhorn/chordl-core";
import {
  lookupGuitarChord,
  INSTRUMENTS,
  rootPitchClass,
  selectForResult,
  positionToSoundingStrings,
} from "@pepperhorn/chordl-guitar";
import type { InstrumentId, ExperienceLevel, SoundingString } from "@pepperhorn/chordl-guitar";
import type { UIThemeMode } from "../config";
import { resolveUITheme, UIThemeProvider } from "../ui-theme";
import { GuitarChord } from "./GuitarChord";
import { CardHeading, CardFooter } from "./CardHeading";
import { GuitarPlaybackControls } from "./GuitarPlaybackControls";
import type { PlaybackSpecSnapshot } from "../types";
import type { Chord } from "svguitar";

export interface GuitarChordPanelProps {
  /** NL chord string (same input the piano view takes). */
  chord: string;
  instrument?: InstrumentId;
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
   * Show the instrument and A/B/C position toggles. Default true; board cards
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

const POSITION_LABELS = "ABCDEFGH";

/**
 * Never draw fewer frets than this, however few the shape needs.
 *
 * A diagram cropped to exactly the frets it uses gives the eye nothing to
 * read the hand against. Most ukulele shapes reach no further than the first
 * fret and drew a single-fret sliver; #52's own measurement found 36 guitar
 * positions in the same state. That design sized the window to the shape on
 * the grounds that a one-fret shape "need not reserve four rows" — true about
 * the space, wrong about what the rows were for. They are the reference.
 *
 * Four is the smallest window that still reads as a piece of a neck, and it
 * is already the ukulele's own default width.
 */
const MIN_FRET_WINDOW = 4;

/**
 * Instruments that can actually return a shape, in the order a player is most
 * likely to reach for them. `bass4`/`bass5` are deliberately absent: chords-db
 * ships no bass library, so they can only ever answer "no shape found", and an
 * instrument that only disappoints is worse than an absent one.
 */
const INSTRUMENT_ORDER: InstrumentId[] = ["guitar", "guitar-top3", "ukulele"];

/** Add stable per-string SVG targets without changing the static diagram. */
function decorateForPlayback(chord: Chord, frets: number[], barres: number[], strings: number): Chord {
  const fingers = chord.fingers.map((finger) => {
    const [stringNumber, fret, label] = finger;
    const stringIndex = strings - stringNumber;
    if (frets[stringIndex] === -1) return finger;
    const existing = typeof label === "object" && label !== null ? label : {};
    const text = typeof label === "string" ? label : existing.text;
    return [stringNumber, fret, {
      ...existing,
      ...(text !== undefined ? { text } : {}),
      className: `${existing.className ?? ""} bc-playback-string-${stringIndex}`.trim(),
    }] as typeof finger;
  });
  // svguitar represents a barre as one shape. Invisible finger targets make
  // each sounding string/barre intersection independently highlightable.
  frets.forEach((fret, stringIndex) => {
    if (fret <= 0 || !barres.includes(fret)) return;
    fingers.push([
      strings - stringIndex,
      fret,
      {
        text: "",
        color: "rgba(0,0,0,0)",
        strokeColor: "rgba(0,0,0,0)",
        className: `bc-playback-string-${stringIndex} bc-playback-barre-target`,
      },
    ]);
  });
  return { ...chord, fingers };
}

/**
 * Note indices → physical string indices.
 *
 * A frame's playback order is its sounding strings low to high, so a note
 * index is a position in `soundingStrings` and the string it lights is that
 * entry's `stringIndex`. Muted strings are absent from `soundingStrings`, so
 * the two are not the same numbering — open C starts on physical string 1.
 *
 * Shared by the panel's own playback controls and by a host driving
 * `activePlaybackIndices`, so the two cannot drift apart. Indices with no
 * sounding string (a host over-counting the voicing) drop out rather than
 * painting string 0.
 */
function stringsForNoteIndices(indices: number[], sounding: SoundingString[]): number[] {
  return indices.flatMap((index) => {
    const physicalString = sounding[index]?.stringIndex;
    return physicalString === undefined ? [] : [physicalString];
  });
}

/**
 * Guitar view for a chord: resolves the chord label, looks up its shapes, and
 * renders the selected fret position with an A/B/C toggle for the alternate
 * placements. Chord-only (scales / note lists fall back to a hint).
 */
export function GuitarChordPanel({
  chord,
  instrument: instrumentProp = "guitar",
  onInstrumentChange,
  position: positionProp,
  onPositionChange,
  level: levelProp,
  showControls = true,
  frets,
  scale = 1,
  uiTheme,
  title,
  subheading,
  footerText,
  className,
  style,
  showPlayback,
  arpeggioBpm,
  playbackHighlightColor = DEFAULT_PLAYBACK_HIGHLIGHT_COLOR,
  activePlaybackIndices: controlledActiveIndices,
  onPlaybackSpecChange,
}: GuitarChordPanelProps) {
  const resolvedShowPlayback = showPlayback ?? showControls;
  const [internalActiveStrings, setInternalActiveStrings] = useState<number[]>([]);
  const uiCtx = resolveUITheme(uiTheme);
  const muted = uiCtx.tokens.textMuted ?? "#888";
  const text = uiCtx.tokens.text ?? "#111";

  const [instrument, setInstrument] = useState<InstrumentId>(instrumentProp);
  // Follow the prop if the host switches instruments.
  const [prevProp, setPrevProp] = useState(instrumentProp);
  if (instrumentProp !== prevProp) { setPrevProp(instrumentProp); setInstrument(instrumentProp); }

  // A persisted board card can name an instrument this build doesn't have (an
  // older export, a hand-edited file). Resolve it once here and use the
  // resolved id everywhere below, so an unknown id degrades to guitar instead
  // of throwing on `INSTRUMENTS[id].strings` or silently finding no shapes.
  const resolved: InstrumentId = Object.prototype.hasOwnProperty.call(INSTRUMENTS, instrument)
    ? instrument
    : "guitar";
  const cfg = INSTRUMENTS[resolved];

  const parsed = useMemo(() => {
    try { return parseChordDescription(chord); } catch { return null; }
  }, [chord]);

  const label = parsed?.chordName ?? "";
  const result = useMemo(
    () => (label ? lookupGuitarChord(label, resolved) : null),
    [label, resolved],
  );
  // Stable settings object so GuitarChord (which re-draws when `settings`
  // changes identity) only redraws when the instrument actually changes.
  const guitarSettings = useMemo(
    () => ({ strings: cfg.strings, tuning: cfg.tuning }),
    [cfg],
  );

  const [active, setActive] = useState(positionProp ?? 0);
  // Follow the prop if the host drives the position.
  const [prevPos, setPrevPos] = useState(positionProp);
  if (positionProp !== prevPos) {
    setPrevPos(positionProp);
    if (positionProp !== undefined) setActive(positionProp);
  }

  // Reset the selected position when the chord identity or instrument changes.
  const identity = `${label}|${resolved}`;
  const [prevKey, setPrevKey] = useState(identity);
  if (identity !== prevKey) { setPrevKey(identity); setActive(0); }

  // Tell the host about that reset, so a stored position can't drift from what
  // is on screen. In an effect because the setter belongs to the parent, and
  // ref-guarded so the mount render doesn't clobber a restored position.
  const notifiedIdentity = useRef(identity);
  useEffect(() => {
    if (notifiedIdentity.current === identity) return;
    notifiedIdentity.current = identity;
    onPositionChange?.(0);
  }, [identity, onPositionChange]);

  const selectPosition = (i: number) => { setActive(i); onPositionChange?.(i); };
  const selectInstrument = (id: InstrumentId) => { setInstrument(id); onInstrumentChange?.(id); };

  // Unlike `instrument`/`position`, the panel draws no control of its own
  // that could change this — it is derived straight from the prop rather than
  // seeded into state, because mirroring an unwritable value into state could
  // only let the two drift (a host that stops passing `level` would leave a
  // stateful mirror stuck on the last value instead of reverting to the
  // documented default).
  const level = levelProp ?? "established";

  // Root pitch class of the parsed label, needed to derive facts (inversion)
  // for every stored position below. null when the label can't be parsed to
  // a root — positionFacts degrades to inversion "other" rather than guessing.
  const rootPc = useMemo(() => (label ? rootPitchClass(label) : null), [label]);

  // Visible placements, each carrying its index into the full list so a click
  // reports the same number whether or not the filter is on. Indices stay
  // indices into the full list, so a host that persists one (a board card
  // stores `position`) is never handed a number that means something
  // different once the filter changes — `selectForExperience` is built to
  // return indices into whatever array it is handed, so it is always given
  // the full `result.positions`, never a pre-filtered slice.
  //
  // Computed here — above the early returns, so the hook order is stable —
  // rather than at the point of use, because `diagram` is handed to
  // GuitarChord. Rebuilding it on every render made it a new object each time,
  // which used to re-raise the diagram's "rendering" veil whenever anything
  // else re-rendered this panel (typing in the board's title field, say).
  const placements = useMemo(() => {
    if (!result) return null;
    // A board card (showControls false) pins one exact shape via `position`
    // and must keep showing exactly that shape — it must never be silently
    // swapped for a different one because whatever `level` the host happens
    // to be passing doesn't include it. (A board card's host can pass any
    // level: `dev/App.tsx`'s own default is "emerging", which would exclude
    // plenty of pinned shapes.) So the filter is interactive-only: it never
    // runs where there is no control to change its outcome.
    //
    // Only `indices`/`level`/`widenedFrom` are ever read below — the bypass
    // branch deliberately doesn't fabricate a full `ExperienceSelection`
    // (`droppedShapeClass` in particular is never read here: the panel never
    // sets a shape class, so it would always be a dead `false`).
    const allPositions = result.positions.map((_, i) => i);
    const selection: { indices: number[]; level: ExperienceLevel; widenedFrom?: ExperienceLevel } =
      showControls
        ? selectForResult(result, INSTRUMENTS[resolved].openMidi, rootPc, { level })
        : { indices: allPositions, level };
    const visible = selection.indices;
    const idx = visible.includes(active)
      ? active
      : visible[0] ?? Math.max(0, Math.min(active, result.shapes.length - 1));
    // chordLookup bakes the chord name into the shape as svguitar's diagram
    // title. The panel renders the name itself (in the same type as the
    // keyboard and staff cards), so drop the SVG's copy rather than showing it
    // twice in a font svguitar sizes independently of the DOM.
    const { title: _shapeTitle, ...diagram } = result.shapes[idx];
    // Floor for the fret window: the highest window-relative fret the
    // displayed shape actually uses. `-1` (muted) and `0` (open) are
    // sentinels, not frets — they're excluded rather than treated as 0-height
    // bars. These values are relative to `baseFret`, already windowed (see
    // instruments.ts / pitch.ts), so this is not an absolute fret number.
    const usedFrets = result.positions[idx].frets.filter((f) => f > 0);
    // All-open shapes (every string open or muted — ukulele Am7/C6, guitar
    // Em/D) have no fretted string to floor on. Fall back to the instrument's
    // own default width rather than 1, which drew a single-fret sliver.
    const needed = usedFrets.length > 0 ? Math.max(...usedFrets) : cfg.frets;
    const minFrets = Math.max(MIN_FRET_WINDOW, needed);
    return { selection, visible, idx, diagram, minFrets };
  }, [result, resolved, rootPc, level, active, showControls]);

  // Tell the host when the level filter puts a different shape on screen than
  // `active` names. Interactive-only (`showControls`), same as the filter
  // itself: a board card's `placements.idx` never diverges from `active`
  // because its bypass branch never drops anything, so this never fires
  // there. Previously silent — clicking a position stored it via
  // `selectPosition`, but the filter could ALSO move the displayed shape
  // (widening past `active`, or excluding it outright) without ever calling
  // `onPositionChange`, so a host that persists the callback's value (a
  // board's "Add to board" payload) could record a shape the screen wasn't
  // even showing. `active` itself is left untouched by this effect — but the
  // only shipped host (`dev/App.tsx`) is controlled, feeding the reported
  // index straight back in as `position`, which re-syncs `active` right back
  // to `displayedIdx`. So in practice widening the level back out does NOT
  // re-reveal the originally requested shape there; it keeps showing the
  // widened one, because the round trip already overwrote what "requested"
  // meant. Only an uncontrolled panel (no `onPositionChange`, or one that
  // doesn't feed the index back into `position`) preserves the original
  // `active` the way this comment used to claim for every host.
  //
  // Guarded the same way as the identity-notify effect above
  // (`notifiedIdentity`): a plain `[displayedIdx, active, onPositionChange]`
  // dependency re-fires on every render for a host passing an inline
  // callback (a new function identity each render) even when nothing about
  // the displayed shape changed — that was an infinite render loop, since
  // calling `onPositionChange` triggers the host to re-render with yet
  // another new callback identity. The ref instead remembers which
  // `displayedIdx` has already been reported, so once notified the effect is
  // a no-op regardless of how many times identity churns; it resets when the
  // shape converges back onto `active`, so a later, different divergence
  // still gets reported.
  const displayedIdx = placements?.idx;
  const notifiedDrift = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (displayedIdx === undefined) return;
    if (displayedIdx === active) {
      notifiedDrift.current = undefined;
      return;
    }
    if (notifiedDrift.current === displayedIdx) return;
    notifiedDrift.current = displayedIdx;
    onPositionChange?.(displayedIdx);
  }, [displayedIdx, active, onPositionChange]);

  const soundingStrings = useMemo(() => {
    if (!result || displayedIdx === undefined) return [];
    return positionToSoundingStrings(result.positions[displayedIdx], cfg.openMidi);
  }, [cfg.openMidi, displayedIdx, result]);
  const soundingMidis = soundingStrings.map(({ midi }) => midi);
  // Controlled value wins, the panel's own playback state is the fallback —
  // the same idiom as `PianoKeyboard`/`StaffNotation`.
  const activeStrings = controlledActiveIndices
    ? stringsForNoteIndices(controlledActiveIndices, soundingStrings)
    : internalActiveStrings;
  const playbackInstrument = resolved === "ukulele" ? "ukulele" : "electric_guitar_clean";
  const playbackDiagram = useMemo(() => {
    if (!placements || !result) return null;
    const position = result.positions[placements.idx];
    return decorateForPlayback(placements.diagram, position.frets, position.barres, cfg.strings);
  }, [cfg.strings, placements, result]);

  useEffect(() => {
    if (soundingMidis.length === 0) return;
    onPlaybackSpecChange?.({ notes: soundingMidis, instrument: playbackInstrument });
  }, [onPlaybackSpecChange, playbackInstrument, soundingMidis.join(",")]);

  const notice = (msg: string) => (
    <UIThemeProvider value={uiCtx}>
      <div className={`bc-guitar-panel bc-guitar-notice ${className ?? ""}`.trim()}
        style={{ textAlign: "center", color: muted, fontSize: "0.85rem", padding: "24px 0", ...style }}>
        {msg}
      </div>
    </UIThemeProvider>
  );

  const instrumentToggle = !showControls ? null : (
    <div className="bc-guitar-instrument-toggle" style={{ display: "flex", gap: 6, justifyContent: "center" }}>
      {INSTRUMENT_ORDER.map((id) => {
        const on = id === resolved;
        return (
          <button
            key={id}
            type="button"
            className="bc-guitar-instrument-btn"
            onClick={() => selectInstrument(id)}
            data-active={on}
            style={{
              padding: "4px 14px", borderRadius: 999, cursor: "pointer",
              border: on ? "1px solid transparent" : "1px solid var(--btn-border, #ddd)",
              background: on ? "var(--pill-active-bg, #0ea5e9)" : "var(--pill-bg, #f1f5f9)",
              color: on ? "var(--pill-active-text, #fff)" : "var(--text-muted, #64748b)",
              fontFamily: "system-ui, sans-serif", fontSize: "0.8rem", fontWeight: on ? 600 : 500,
            }}
          >
            {INSTRUMENTS[id].label}
          </button>
        );
      })}
    </div>
  );

  if (parsed?.isScale) return notice("Guitar view shows chords — switch off scale mode.");
  if (!label) return notice("Enter a chord to see its guitar shapes.");
  if (!result) {
    return (
      <UIThemeProvider value={uiCtx}>
        <div
          className={`bc-guitar-panel ${className ?? ""}`.trim()}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, ...style }}
        >
          {instrumentToggle}
          <div className="bc-guitar-notice" style={{ textAlign: "center", color: muted, fontSize: "0.85rem", padding: "12px 0" }}>
            No {cfg.label.toLowerCase()} shape found for “{label}”.
          </div>
        </div>
      </UIThemeProvider>
    );
  }

  // `result` is non-null past the guard above, so the memo above resolved too.
  const { selection, visible, idx, diagram, minFrets } = placements!;

  // Generalises the old `onlyBarres` notice: say so whenever the level
  // filter couldn't be honoured exactly, rather than silently serving
  // something else. (`droppedShapeClass` can't fire here — the panel never
  // sets a shape class, so `selectForExperience` always sees "any".)
  //
  // `selection.widenedFrom`, when present, is always a strictly easier rung
  // than `selection.level` — cumulative matching guarantees selectForExperience
  // never widens to the same level it started from (see its "3. widen" step),
  // so there is no second case here for "nothing at any level matched" the
  // way there was under the old exclusive matching. That branch used to
  // report a self-contradictory `level`/`widenedFrom` pair; it was deleted
  // from `selectForExperience` as dead code, and this string went with it.
  let filterNotice: string | null = null;
  if (selection.widenedFrom !== undefined) {
    filterNotice = `No ${selection.widenedFrom} shape for ${label} — showing ${selection.level} instead.`;
  }

  return (
    <UIThemeProvider value={uiCtx}>
      <div
        className={`bc-guitar-panel ${className ?? ""}`.trim()}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, ...style }}
      >
        {/* Shared with the keyboard and staff renderers so a mixed board agrees
            on type: the descriptive title leads, the chord name sits beneath.
            The wrapper is conditional: CardHeading returns null when it has
            nothing to say, but an empty div is still a flex item and was
            spending a `gap: 10` above the diagram on nothing. The condition
            mirrors CardHeading's own `title ?? chordName` — with `||` an empty
            string title would fall through to the label here while CardHeading
            still returned null, leaving the very gap this removes. */}
        {((title ?? label) || subheading) && (
          <div className="bc-guitar-titles" style={{ width: "100%" }}>
            <CardHeading
              title={title}
              chordName={label}
              subheading={subheading}
              tokens={uiCtx.tokens}
              variant="guitar"
            />
          </div>
        )}

        {instrumentToggle}

        {filterNotice && (
          <div className="bc-guitar-notice" style={{ textAlign: "center", color: muted, fontSize: "0.8rem" }}>
            {filterNotice}
          </div>
        )}

        <GuitarChord
          chord={playbackDiagram ?? diagram}
          scale={scale}
          frets={Math.max(frets ?? minFrets, minFrets)}
          settings={guitarSettings}
          activeStrings={activeStrings}
          playbackHighlightColor={playbackHighlightColor}
        />

        {resolvedShowPlayback && soundingStrings.length > 0 && (
          <GuitarPlaybackControls
            notes={soundingMidis}
            arpeggioBpm={arpeggioBpm}
            instrument={playbackInstrument}
            onActiveChange={(indices) => {
              setInternalActiveStrings(stringsForNoteIndices(indices, soundingStrings));
            }}
          />
        )}

        {/* Alternate placements. Labelled by visible order so the row reads
            A/B/C even when the level filter has removed shapes
            between them, while the click still reports the underlying index. */}
        {showControls && visible.length > 1 && (
          <div className="bc-guitar-position-toggle" style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {visible.map((i, shown) => {
              const baseFret = result.positions[i].baseFret;
              return (
                <button
                  key={i}
                  type="button"
                  className="bc-guitar-position-btn"
                  onClick={() => selectPosition(i)}
                  data-active={i === idx}
                  title={`Position ${shown + 1} (fret ${baseFret})`}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                    padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                    border: i === idx ? "1px solid transparent" : "1px solid var(--btn-border, #ddd)",
                    background: i === idx ? "var(--pill-active-bg, #0ea5e9)" : "var(--pill-bg, #f1f5f9)",
                    color: i === idx ? "var(--pill-active-text, #fff)" : "var(--text-muted, #64748b)",
                    fontFamily: "inherit", fontSize: "0.9rem", fontWeight: i === idx ? 600 : 500,
                    minWidth: 40,
                  }}
                >
                  <span>{POSITION_LABELS[shown] ?? shown + 1}</span>
                  <span style={{ fontSize: "0.65rem", fontWeight: 400 }}>fret {baseFret}</span>
                </button>
              );
            })}
          </div>
        )}

        <CardFooter text={footerText} tokens={uiCtx.tokens} variant="guitar" />
      </div>
    </UIThemeProvider>
  );
}
