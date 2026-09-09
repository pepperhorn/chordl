import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, TouchEvent as ReactTouchEvent } from "react";
import { startPlayback, preloadInstruments } from "@pepperhorn/chordl-react";
import type { PlaybackController, UIThemeMode } from "@pepperhorn/chordl-react";
import { BoardCardContent } from "./ChordBoard.js";
import { GRID_TRACKS, computeRowSpans } from "./layout.js";
import { resolveCardPlayback } from "./cardPlayback.js";
import { BOARD_CARD_SIZE_FACTORS, MAX_COLUMNS, isTextCard } from "./types.js";
import type { BoardItem, BoardMeta } from "./types.js";

/** Same gutter the editing board puts on its cards. See ChordBoard. */
const CARD_GUTTER = 6;

/**
 * How far a finger has to travel across the board before it counts as a step.
 *
 * A board scrolls vertically, so the gesture has to be unambiguous in the
 * other axis or an ordinary scroll would skip chords under the user's thumb.
 * The distance is paired with a dominance check (`|dx| > |dy|`): a long
 * diagonal is a scroll that drifted, not a swipe.
 */
const SWIPE_THRESHOLD = 40;

const CURSOR_RING = "rgba(56, 189, 248, 0.85)";
const CURSOR_GLOW = "rgba(56, 189, 248, 0.35)";

/*
 * The cursor wears the same ring a selected card wears in the editor. Play
 * mode has exactly one "this one" at a time, and a reader who has used the
 * board already knows what that ring means — a second visual language for the
 * same idea would only be a second thing to learn.
 */
const PLAYER_STYLES = `
.board-player { outline: none; }
.board-player-card { transition: box-shadow 0.15s ease, border-color 0.15s ease; }
.board-player-card--cursor {
  border-color: ${CURSOR_RING} !important;
  box-shadow: 0 0 0 2px ${CURSOR_GLOW};
}
.board-player-more {
  border: none;
  background: transparent;
  font: inherit;
  font-size: 0.78rem;
  color: var(--text-muted, #666);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  align-self: center;
}
.board-player-more:hover { color: inherit; background: rgba(56,189,248,0.12); }
`;

export interface BoardPlayerProps {
  /**
   * Cards to draw, in reading order. Separate from `meta` rather than one
   * `BoardState`, to match `ChordBoardProps` — the two components take the
   * same board and a host should not have to reshape it between them.
   */
  items: BoardItem[];
  /** Board-level metadata: title/subtitle/footer/columns. */
  meta?: BoardMeta;
  /** Render scale forwarded to each card's diagram. */
  scale?: number;
  uiTheme?: UIThemeMode;
  /** Play mode is the host's state, so a page can put the toggle where it likes. */
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  /**
   * Draw the "more" affordance on each chord card. The host owns entitlement;
   * this package must not — it is published MIT and has no business knowing
   * what a given reader has paid for, or which service would be asked.
   */
  canShowMore?: boolean;
  onShowMore?: (item: BoardItem) => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * Index of the next card the cursor may land on, walking from `from` in
 * `direction`, or -1 when there is none.
 *
 * Text cards are stepped over rather than stopped on: a section heading has
 * nothing to sound, so landing on it would be a press of the arrow key that
 * produced silence and looked like a dropped input. A board with nothing but
 * text cards therefore has no cursor at all, which is the -1 case.
 */
function nextPlayable(items: BoardItem[], from: number, direction: 1 | -1): number {
  for (let i = from + direction; i >= 0 && i < items.length; i += direction) {
    if (!isTextCard(items[i])) return i;
  }
  return -1;
}

/**
 * A board you read and listen to rather than edit.
 *
 * The grid is `ChordBoard`'s, drawn from the same `computeRowSpans` maths and
 * the same `BoardCardContent`, so a board looks identical in both — play mode
 * is a different set of controls over one layout, not a second layout.
 *
 * A cursor walks the chord cards and each one sounds in its own patch. Every
 * move cancels the chord before it: holding an arrow down otherwise stacks a
 * voice per repeat, and a second of that is a cluster rather than a
 * progression.
 */
export function BoardPlayer({
  items,
  meta,
  scale,
  uiTheme,
  playing,
  onPlayingChange,
  canShowMore,
  onShowMore,
  className,
  style,
}: BoardPlayerProps) {
  const [cursor, setCursor] = useState(() => nextPlayable(items, -1, 1));
  /** Sounding notes of the card under the cursor, by position in its voicing. */
  const [active, setActive] = useState<number[] | null>(null);
  const controllerRef = useRef<PlaybackController | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  /**
   * Bumped by every cancel. `startPlayback` is async, so a chord started before
   * a move can still resolve after it — this is how such a controller learns it
   * is stale, and stops itself instead of ringing under the next chord.
   */
  const tokenRef = useRef(0);

  /** The cursor's card, or -1 if the board has none it may sit on. */
  const cursorIndex = cursor >= 0 && cursor < items.length && !isTextCard(items[cursor])
    ? cursor
    : -1;

  const cancelCurrent = useCallback(() => {
    tokenRef.current += 1;
    controllerRef.current?.cancel();
    controllerRef.current = null;
    // Guarded so a cancel with nothing ringing is not a state update, which
    // would re-render every card on each keypress that changes nothing.
    setActive((previous) => (previous === null ? previous : null));
  }, []);

  const play = useCallback((index: number) => {
    cancelCurrent();
    const item = items[index];
    if (!item) return;
    const playback = resolveCardPlayback(item);
    // A chord card whose voicing cannot be resolved sounds nothing. The
    // alternative — leaving the previous chord ringing — would say the cursor
    // had not moved, which is the one thing that is definitely false.
    if (!playback) return;
    const token = tokenRef.current;
    void startPlayback(playback.midi, {
      mode: "block",
      instrument: playback.instrument,
      onActiveChange: (indices) => {
        if (tokenRef.current !== token) return;
        setActive(indices.length ? indices : null);
      },
    })
      .then((controller) => {
        if (tokenRef.current !== token) {
          controller.cancel();
          return;
        }
        controllerRef.current = controller;
      })
      // A patch that will not load is the audio layer's problem to report; a
      // rejected promise here would only be an unhandled rejection in the host.
      .catch(() => undefined);
  }, [items, cancelCurrent]);

  /**
   * Move one card and sound where we land. At either end the cursor stays put
   * and the current chord sounds again — the board has no more chords that way,
   * and wrapping to the far end would be a jump the user did not ask for.
   */
  const step = useCallback((direction: 1 | -1) => {
    if (cursorIndex < 0) return;
    const next = nextPlayable(items, cursorIndex, direction);
    const target = next >= 0 ? next : cursorIndex;
    setCursor(target);
    play(target);
  }, [cursorIndex, items, play]);

  const replay = useCallback(() => {
    if (cursorIndex < 0) return;
    play(cursorIndex);
  }, [cursorIndex, play]);

  /*
   * Keep the cursor on a card that still exists and is still playable — a host
   * may hand over a different board while play mode is on.
   */
  useEffect(() => {
    setCursor((current) =>
      current >= 0 && current < items.length && !isTextCard(items[current])
        ? current
        : nextPlayable(items, -1, 1),
    );
  }, [items]);

  /*
   * Warm every patch the board will ask for, once, when play mode opens. A
   * soundfont takes long enough to fetch that loading one on the first arrow
   * press is heard as the first chord being late, and it happens again on each
   * new instrument the cursor reaches.
   */
  useEffect(() => {
    if (!playing) {
      cancelCurrent();
      return;
    }
    const wanted = items
      .map((item) => resolveCardPlayback(item)?.instrument)
      .filter((instrument) => instrument !== undefined);
    void preloadInstruments([...new Set(wanted)]);
  }, [playing, items, cancelCurrent]);

  /*
   * Take the keyboard when play mode opens.
   *
   * Whatever turned play mode on keeps the focus — a host's Play button, say —
   * so without this the player mounts deaf: every arrow key goes to the button
   * and the cursor never moves, until the user guesses that a click or a Tab is
   * the missing step. Grabbing focus is usually rude; here the user has just
   * asked for a mode whose entire transport is arrow keys.
   *
   * Keyed on `playing` alone, so it fires on the way in and not on every
   * render, and it stands down when the focus is already inside the player —
   * once the mode is open the focus is the user's, and pulling it back to the
   * root would undo a Tab they had just made.
   */
  useEffect(() => {
    if (!playing) return;
    const root = rootRef.current;
    if (!root || root.contains(document.activeElement)) return;
    root.focus();
  }, [playing]);

  /* Nothing may go on sounding after the component is gone. */
  useEffect(() => () => cancelCurrent(), [cancelCurrent]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // A key pressed on the "more" button is that button's, not the transport's
    // — Space there means "press me", and Enter likewise.
    if (event.target !== event.currentTarget) return;

    if (event.key === "p" || event.key === "P") {
      event.preventDefault();
      // This press is ours and stops here. A host has to listen for `p`
      // somewhere outside the player to *enter* the mode — the player cannot
      // hear its own entrance, because it is not mounted yet — and React
      // flushes the state change, and that listener, synchronously inside this
      // dispatch. Left to bubble, the press that just left play mode would be
      // caught by the listener it had itself brought back, and the board would
      // never leave.
      event.stopPropagation();
      onPlayingChange(!playing);
      return;
    }
    // Outside play mode the arrows and Space are the page's: this is a board
    // someone is reading, and a display component that swallowed the scroll
    // keys would trap them in it.
    if (!playing) return;

    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        step(1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        step(-1);
        break;
      // Space scrolls the page on a focusable div, which would move the card
      // out from under the cursor the user is watching.
      case "ArrowDown":
      case " ":
        event.preventDefault();
        replay();
        break;
      default:
        break;
    }
  };

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  /*
   * A horizontal swipe steps in reading order, and that is the whole gesture
   * set. Deliberately no vertical or per-row gesture: the board wraps, so
   * "the row above" is not a stable place — it changes with the column count
   * and with any card that is more than one column wide.
   */
  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!playing || !start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
    step(dx < 0 ? 1 : -1);
  };

  const columns = meta?.columns;
  /* Same guard as ChordBoard: a count outside 1–MAX_COLUMNS gives fractional
     spans, which CSS drops entirely. The wrapping layout handles those. */
  const useGrid = typeof columns === "number" && Number.isInteger(columns)
    && columns >= 1 && columns <= MAX_COLUMNS;

  const { spans, rowStarts } = useGrid
    ? computeRowSpans(items, columns as number)
    : { spans: [] as number[], rowStarts: {} as Record<number, number> };

  const gridStyle: CSSProperties = useGrid
    ? {
        display: "grid",
        gridTemplateColumns: `repeat(${GRID_TRACKS}, minmax(0, 1fr))`,
        columnGap: 0,
        rowGap: 12,
        alignItems: "flex-start",
      }
    : { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start", justifyContent: "center" };

  const cardStyle: CSSProperties = {
    position: "relative",
    border: "1px solid var(--btn-border, #ddd)",
    borderRadius: 12,
    padding: 12,
    background: "#fff",
    minWidth: useGrid ? 0 : 240,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    cursor: "default",
    userSelect: "none",
  };

  const breakStyle: CSSProperties = useGrid
    ? { gridColumn: "1 / -1", height: 0 }
    : { flexBasis: "100%", height: 0 };

  return (
    <div
      ref={rootRef}
      className={`board-player ${className ?? ""}`.trim()}
      style={style}
      // A real tab stop: the transport is keyboard-first, so the board itself
      // has to be reachable by Tab before any of it works.
      tabIndex={0}
      role="group"
      aria-label="Chord board player"
      data-playing={playing ? "true" : "false"}
      onKeyDown={handleKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <style>{PLAYER_STYLES}</style>

      {(meta?.title || meta?.subtitle) && (
        <div className="board-player-heading" style={{ textAlign: "center", marginBottom: 16 }}>
          {meta.title && <h1 className="chordl-board-title">{meta.title}</h1>}
          {meta.subtitle && <h3 className="chordl-board-subtitle">{meta.subtitle}</h3>}
        </div>
      )}

      <div className="board-player-grid" style={gridStyle}>
        {items.map((item, index) => {
          const isCursor = playing && index === cursorIndex;
          return (
            <Fragment key={item.id}>
              <div
                data-board-id={item.id}
                className={`board-player-card${isCursor ? " board-player-card--cursor board-player-cursor" : ""}`}
                style={{
                  ...cardStyle,
                  ...(useGrid
                    ? {
                        gridColumn: rowStarts[index] !== undefined
                          ? `${rowStarts[index]} / span ${spans[index]}`
                          : `span ${spans[index]}`,
                        marginLeft: CARD_GUTTER,
                        marginRight: CARD_GUTTER,
                      }
                    : null),
                }}
                // Tapping a card is the pointer's version of walking to it.
                onClick={() => {
                  if (!playing || isTextCard(item)) return;
                  setCursor(index);
                  play(index);
                }}
              >
                <BoardCardContent
                  item={item}
                  scale={(scale ?? 1) * BOARD_CARD_SIZE_FACTORS[item.size ?? "rg"]}
                  uiTheme={uiTheme}
                  // Only the card that is sounding: every other card falls back
                  // to its own renderer's state, which is "nothing lit".
                  activePlaybackIndices={isCursor && active ? active : undefined}
                />
                {canShowMore && !isTextCard(item) && (
                  <button
                    type="button"
                    className="board-player-more"
                    // The card carries the chord's name; the button beside it
                    // needs its own, or a screen reader hears "more" repeated
                    // once per card with nothing to tell them apart.
                    aria-label={`More about ${item.nl ?? item.title ?? "this chord"}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onShowMore?.(item);
                    }}
                  >
                    more
                  </button>
                )}
              </div>
              {item.breakAfter && (
                <div className="board-player-break" aria-hidden="true" style={breakStyle} />
              )}
            </Fragment>
          );
        })}
      </div>

      {meta?.footer && (
        <div
          className="board-player-footer"
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: "0.95rem",
            color: "#555",
            fontFamily: "Poppins, system-ui, sans-serif",
            fontStyle: "italic",
            whiteSpace: "pre-wrap",
          }}
        >
          {meta.footer}
        </div>
      )}
    </div>
  );
}
