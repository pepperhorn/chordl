import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { parseChordDescription } from "@pepperhorn/chordl-core";
import {
  lookupGuitarChord,
  INSTRUMENTS,
  rootPitchClass,
  selectForResult,
} from "@pepperhorn/chordl-guitar";
import type { InstrumentId, ExperienceLevel } from "@pepperhorn/chordl-guitar";
import type { UIThemeMode } from "../config";
import { resolveUITheme, UIThemeProvider } from "../ui-theme";
import { GuitarChord } from "./GuitarChord";
import { CardHeading, CardFooter } from "./CardHeading";

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
   * yet". Like `instrument`/`position`, this seeds internal state and
   * re-syncs whenever the prop changes. Default "established". The panel
   * itself draws no level control — a host drives this prop (and reads
   * `onLevelChange`) to offer one. Only affects rendering when `showControls`
   * is true — a board card pins one exact shape via `position` and must keep
   * showing exactly that shape, so it never runs the filter, even if this
   * prop is set.
   */
  level?: ExperienceLevel;
  /** Fires when the user picks a different level, so hosts can persist it. */
  onLevelChange?: (level: ExperienceLevel) => void;
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
}

const POSITION_LABELS = "ABCDEFGH";

/**
 * Instruments that can actually return a shape, in the order a player is most
 * likely to reach for them. `bass4`/`bass5` are deliberately absent: chords-db
 * ships no bass library, so they can only ever answer "no shape found", and an
 * instrument that only disappoints is worse than an absent one.
 */
const INSTRUMENT_ORDER: InstrumentId[] = ["guitar", "guitar-top3", "ukulele"];

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
  onLevelChange,
  showControls = true,
  frets,
  scale = 1,
  uiTheme,
  title,
  subheading,
  footerText,
  className,
  style,
}: GuitarChordPanelProps) {
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

  const [level, setLevel] = useState<ExperienceLevel>(levelProp ?? "established");
  // Follow the prop if the host drives the level, same pattern as `position`.
  const [prevLevelProp, setPrevLevelProp] = useState(levelProp);
  if (levelProp !== prevLevelProp) {
    setPrevLevelProp(levelProp);
    if (levelProp !== undefined) setLevel(levelProp);
  }
  const selectLevel = (l: ExperienceLevel) => { setLevel(l); onLevelChange?.(l); };

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
    // A board card (showControls false) has no level toggle to override the
    // default, and pins one exact shape via `position` — it must keep
    // showing exactly that shape, not have it silently swapped for a
    // different one because "established" (the interactive default) isn't
    // what that shape happens to be. So the filter is interactive-only: it
    // never runs where there is no control to change its outcome.
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
    const minFrets = usedFrets.length > 0 ? Math.max(...usedFrets) : cfg.frets;
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
          chord={diagram}
          scale={scale}
          frets={Math.max(frets ?? minFrets, minFrets)}
          settings={guitarSettings}
        />

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
