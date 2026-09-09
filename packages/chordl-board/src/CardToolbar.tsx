import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

/**
 * The board's per-card controls, as one floating toolbar anchored to whichever
 * card is selected.
 *
 * Why they left the card: eleven controls do not fit across a card, and the
 * wrapping row that kept them inside the border only turned the overflow into
 * height. Measured at four columns, the row was 191px of a 287px `sm` card —
 * 67% control panel, with the diagram as a hat on top — and every card ended up
 * a different height depending on how many controls happened to wrap. One
 * toolbar outside the grid costs a card nothing, fits all eleven on one row at
 * every size, and only exists while a card is selected.
 */

/** Space between the card's edge and the toolbar. Also what the caret sits in. */
export const TOOLBAR_GAP = 10;
/** Closest the toolbar comes to any viewport edge. */
export const TOOLBAR_MARGIN = 8;
/** Half the caret's width — how far its tip must stay from a rounded corner. */
export const TOOLBAR_CARET = 7;

/** A rectangle in viewport coordinates, as `getBoundingClientRect` reports it. */
export interface ToolbarRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Everything placement needs, in one value.
 *
 * A single struct rather than three reads inside the positioning code is what
 * makes this testable: jsdom reports zeroes for every rect, so a test drives
 * placement by handing over the numbers instead of trying to lay a page out.
 */
export interface ToolbarMeasurements {
  /** The anchor card. Null once it has gone — a delete, or an import. */
  card: ToolbarRect | null;
  /** The toolbar's own rendered size. */
  toolbar: { width: number; height: number };
  /** The visible viewport, in the same coordinate space as `card`. */
  viewport: { width: number; height: number };
}

export type ToolbarPlacement = "below" | "above";

export interface ToolbarPosition {
  top: number;
  left: number;
  placement: ToolbarPlacement;
  /** Caret offset from the toolbar's left edge — it points at the card's centre. */
  caretLeft: number;
}

/**
 * How the measurements are taken. Swapped out in tests; in the app it is
 * `domMeasureToolbar` below.
 */
export type MeasureToolbar = (
  card: HTMLElement | null,
  toolbar: HTMLElement,
) => ToolbarMeasurements;

export const domMeasureToolbar: MeasureToolbar = (card, toolbar) => {
  const rect = card?.getBoundingClientRect();
  return {
    card: rect
      ? { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
      : null,
    // offsetWidth/Height rather than a rect: the toolbar animates in with a
    // transform, and a transformed rect would measure the animation frame
    // rather than the box, so the first placement would land short.
    toolbar: { width: toolbar.offsetWidth, height: toolbar.offsetHeight },
    viewport: {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight,
    },
  };
};

/**
 * Where the toolbar goes, given what was measured. Pure — no DOM, no globals.
 *
 * Below the card by default, because that is where the eye already is after
 * clicking one. It flips above when the toolbar would not clear the bottom of
 * the viewport; a card near the bottom of a long board is otherwise handed a
 * toolbar sitting on top of the card underneath it. When neither side has room
 * (a card taller than the window), below wins and the clamp keeps it on screen.
 */
export function placeCardToolbar(m: ToolbarMeasurements): ToolbarPosition | null {
  const { card, toolbar, viewport } = m;
  if (!card) return null;

  const belowTop = card.top + card.height + TOOLBAR_GAP;
  const aboveTop = card.top - TOOLBAR_GAP - toolbar.height;
  const fitsBelow = belowTop + toolbar.height <= viewport.height - TOOLBAR_MARGIN;
  const fitsAbove = aboveTop >= TOOLBAR_MARGIN;
  const placement: ToolbarPlacement = fitsBelow || !fitsAbove ? "below" : "above";

  const centre = card.left + card.width / 2;
  // Math.max last, so a toolbar wider than the viewport pins to the left margin
  // rather than being pushed off the left edge by a negative maximum.
  const left = Math.max(
    TOOLBAR_MARGIN,
    Math.min(centre - toolbar.width / 2, viewport.width - TOOLBAR_MARGIN - toolbar.width),
  );

  // The caret keeps pointing at the card once the toolbar has been clamped,
  // but never past its own rounded ends.
  const caretLeft = Math.max(
    TOOLBAR_CARET,
    Math.min(centre - left, Math.max(TOOLBAR_CARET, toolbar.width - TOOLBAR_CARET)),
  );

  return { top: placement === "below" ? belowTop : aboveTop, left, placement, caretLeft };
}

const samePosition = (a: ToolbarPosition | null, b: ToolbarPosition | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.top === b.top &&
    a.left === b.left &&
    a.placement === b.placement &&
    a.caretLeft === b.caretLeft);

export const CARD_TOOLBAR_CSS = `
@keyframes chordl-board-toolbar-in {
  from { opacity: 0; transform: translateY(-2px); }
  to   { opacity: 1; transform: translateY(0); }
}
.chordl-board-card-toolbar { animation: chordl-board-toolbar-in 0.12s ease-out; }
.chordl-board-card-toolbar button:hover:not(:disabled) { background: rgba(56,189,248,0.14); }
.chordl-board-card-toolbar button:focus-visible { outline: 2px solid rgba(56,189,248,0.9); outline-offset: 1px; }
/* Focused only when the toolbar hands focus back on dismissal — a ring there
   would be a selection ring the board already draws, twice. */
.chordl-board-card:focus { outline: none; }
`;

export interface CardToolbarProps {
  /** Card the toolbar belongs to. Changing it re-anchors and re-measures. */
  anchorId: string;
  /** Resolves `anchorId` to its live DOM node. Must be stable across renders. */
  resolveAnchor: (id: string) => HTMLElement | null;
  /** Accessible name — a toolbar with no name is an unlabelled group of verbs. */
  label: string;
  measure?: MeasureToolbar;
  children: ReactNode;
}

/**
 * Positioned chrome, and nothing about what the buttons do — the board passes
 * those in as children so every existing per-card behaviour (the break toggle's
 * pressed state, the size buttons' fit rules) stays where it was written.
 */
export function CardToolbar({
  anchorId,
  resolveAnchor,
  label,
  measure,
  children,
}: CardToolbarProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<ToolbarPosition | null>(null);

  // Read through a ref so swapping the measurement function does not tear down
  // the scroll/resize listeners below.
  const measureRef = useRef<MeasureToolbar | undefined>(measure);
  measureRef.current = measure;

  // Remembered so dismissal can hand focus back even after the card is gone
  // from the board's own lookup. Read through refs because the unmount path
  // below is a cleanup with no dependencies of its own.
  const anchorRef = useRef<HTMLElement | null>(null);
  const lookupRef = useRef({ resolve: resolveAnchor, id: anchorId });
  lookupRef.current = { resolve: resolveAnchor, id: anchorId };

  const reposition = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const anchor = resolveAnchor(anchorId);
    if (anchor) anchorRef.current = anchor;
    const take = measureRef.current ?? domMeasureToolbar;
    const next = placeCardToolbar(take(anchor, el));
    // Identity-stable when nothing moved: a scroll fires per frame, and a fresh
    // object each time would re-render the toolbar all the way down a page.
    setPos((prev) => (samePosition(prev, next) ? prev : next));
  }, [anchorId, resolveAnchor]);

  useLayoutEffect(() => {
    reposition();
  }, [reposition, children]);

  /**
   * And again after paint. React attaches a parent's ref *after* its children's
   * layout effects run, so on the very first commit the board root — which is
   * how the anchor is found — is not attached yet and the measurement above has
   * no card to measure. The toolbar starts hidden until it has a position, so
   * this catches up before anything is painted at the wrong place.
   */
  useEffect(() => {
    reposition();
  }, [reposition]);

  useEffect(() => {
    const onChange = () => reposition();
    window.addEventListener("resize", onChange);
    // Capture phase: the board may sit in a scrolling panel rather than on the
    // page itself, and a scroll event from one of those does not bubble.
    window.addEventListener("scroll", onChange, true);

    // The card's own geometry changes under the toolbar — picking a size is the
    // obvious one, and it resizes the very thing the toolbar is pinned to.
    // Guarded because jsdom ships no ResizeObserver.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(onChange);
      const anchor = resolveAnchor(anchorId);
      if (anchor) observer.observe(anchor);
      if (ref.current) observer.observe(ref.current);
    }
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
      observer?.disconnect();
    };
  }, [anchorId, reposition, resolveAnchor]);

  /**
   * One tab stop, the ARIA toolbar pattern: Tab reaches the toolbar, arrows
   * move within it. Applied to the live DOM rather than to props because the
   * buttons are the board's, passed in as children.
   */
  const enabledButtons = () =>
    Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? []).filter(
      (b) => !b.disabled,
    );

  const normaliseTabStops = () => {
    const el = ref.current;
    if (!el) return;
    const buttons = Array.from(el.querySelectorAll<HTMLButtonElement>("button"));
    const enabled = buttons.filter((b) => !b.disabled);
    const active = enabled.find((b) => b === document.activeElement) ?? enabled[0];
    for (const b of buttons) b.tabIndex = b === active ? 0 : -1;
  };

  // No dependency list on purpose: the enabled set changes with the card's row
  // (a size that no longer fits becomes disabled), and the tab stop has to move
  // off a button that just went away.
  useLayoutEffect(() => {
    normaliseTabStops();
  });

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    const buttons = enabledButtons();
    if (buttons.length === 0) return;
    e.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = e.key === "ArrowRight" ? 1 : -1;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? buttons.length - 1
          : current < 0
            ? 0
            : (current + step + buttons.length) % buttons.length;
    buttons[next].focus();
    normaliseTabStops();
  };

  /**
   * Dismissing must not leave focus on a node that is about to be removed.
   * The anchor card takes it back — it carries `tabIndex={-1}` for exactly
   * this — unless the card went with the toolbar, as it does on delete.
   *
   * Captured at mount and read at unmount: layout-effect cleanup runs before
   * React detaches the DOM, so the toolbar still owns focus at that point.
   */
  useLayoutEffect(() => {
    const el = ref.current;
    return () => {
      if (!el || !el.contains(document.activeElement)) return;
      const { resolve, id } = lookupRef.current;
      const anchor = resolve(id) ?? anchorRef.current;
      // Not connected means the card went with the toolbar — a delete or a cut.
      // There is nothing left to hand focus to, so let the browser do its thing.
      if (anchor?.isConnected) anchor.focus();
    };
  }, []);

  const style: CSSProperties = {
    position: "fixed",
    top: pos?.top ?? 0,
    left: pos?.left ?? 0,
    // Hidden until measured, so it never paints once at the origin and jumps.
    visibility: pos ? "visible" : "hidden",
    zIndex: 40,
    display: "flex",
    // The whole point: eleven controls on one line, outside the card, where
    // there is room for them.
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 4,
    padding: "5px 8px",
    borderRadius: 999,
    border: "1px solid var(--btn-border, #ddd)",
    background: "#fff",
    boxShadow: "0 8px 24px rgba(15,23,42,0.16)",
    whiteSpace: "nowrap",
  };

  const caretStyle: CSSProperties = {
    position: "absolute",
    width: 10,
    height: 10,
    left: (pos?.caretLeft ?? 0) - 5,
    background: "#fff",
    transform: "rotate(45deg)",
    ...(pos?.placement === "above"
      ? {
          bottom: -6,
          borderRight: "1px solid var(--btn-border, #ddd)",
          borderBottom: "1px solid var(--btn-border, #ddd)",
        }
      : {
          top: -6,
          borderLeft: "1px solid var(--btn-border, #ddd)",
          borderTop: "1px solid var(--btn-border, #ddd)",
        }),
  };

  /*
   * Portalled to <body> rather than left in the board's own tree.
   *
   * `position: fixed` is only viewport-relative while no ancestor establishes a
   * containing block, and *any* `transform` does — including the identity
   * matrix a finished CSS fade-in leaves behind, which is exactly what the host
   * app wraps the board in. Measured there, the toolbar rendered 416px above
   * and 264px right of where it was told to sit. Nothing the board can style
   * fixes that from the inside, so it goes out.
   *
   * The board's <style> block is document-wide, so the class rules still apply,
   * and the theme's custom properties are defined on :root, so `var(--btn-border)`
   * resolves to the same value out here as it did in the card.
   */
  return createPortal(
    <div
      ref={ref}
      // `chordl-board-actions` rides along so host styling and anything that
      // already knew where the per-card controls live keeps working.
      className="chordl-board-card-toolbar chordl-board-actions"
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      data-toolbar-for={anchorId}
      data-placement={pos?.placement ?? "below"}
      style={style}
      onKeyDown={onKeyDown}
      onFocus={normaliseTabStops}
      // Kept from the in-card row: a click in here is not a click on the card,
      // and must not toggle the selection back off underneath itself.
      onClick={(e) => e.stopPropagation()}
    >
      <span className="chordl-board-card-toolbar-caret" aria-hidden="true" style={caretStyle} />
      {children}
    </div>,
    document.body,
  );
}
