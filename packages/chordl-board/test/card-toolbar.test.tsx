import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { ChordBoard, placeCardToolbar } from "../src";
import type { BoardItem, MeasureToolbar } from "../src";

// Deferred so a test can observe the board *mid-export*: `exporting` is
// internal state that only stands while the capture promise is pending.
let settleCapture: ((canvas: unknown) => void) | null = null;
vi.mock("html2canvas", () => ({
  default: vi.fn(
    () =>
      new Promise((resolve) => {
        settleCapture = resolve;
      }),
  ),
}));

const items: BoardItem[] = [{ id: "a", nl: "C" }, { id: "b", nl: "Am" }];

/*
 * The toolbar portals to <body>, so it is a sibling of Testing Library's
 * container rather than inside it — any `transform` on an ancestor (the host
 * app's fade-in wrapper has one) captures `position: fixed`, so it cannot stay
 * in the board's own tree. Queries for it go through the document.
 */
const toolbar = () =>
  document.body.querySelector<HTMLElement>(".chordl-board-card-toolbar");

const toolbars = () => document.body.querySelectorAll(".chordl-board-card-toolbar");

/** A board that owns its own selection, the way a host does. */
function Harness(props: {
  initial?: string | null;
  measureToolbar?: MeasureToolbar;
  onNew?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(props.initial ?? null);
  return (
    <ChordBoard
      items={items}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onClearSelection={() => setSelectedId(null)}
      onResize={() => {}}
      onNew={props.onNew}
      measureToolbar={props.measureToolbar}
    />
  );
}

/**
 * jsdom ships no ResizeObserver, so the toolbar's observer branch is dead there
 * unless a test supplies one. This one records what it was asked to watch and
 * lets a test fire it for a chosen element — which is the only way to say
 * "something reflowed above this card" without a real layout engine.
 */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  targets = new Set<Element>();
  constructor(private cb: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe(el: Element) { this.targets.add(el); }
  unobserve(el: Element) { this.targets.delete(el); }
  disconnect() { this.targets.clear(); }
  static reset() { FakeResizeObserver.instances = []; }
  static watches(el: Element) {
    return FakeResizeObserver.instances.some((i) => i.targets.has(el));
  }
  static fire(el: Element) {
    for (const i of FakeResizeObserver.instances) if (i.targets.has(el)) i.cb();
  }
}

/**
 * Eleven controls inside a card turned a small card into a control panel with a
 * diagram on top — 67% of a `sm` card's height at four columns. They live in
 * one floating toolbar now, anchored to whichever card is selected.
 */
describe("floating card toolbar", () => {
  it("shows no toolbar until a card is selected", () => {
    render(<ChordBoard items={items} onResize={() => {}} />);
    expect(toolbars()).toHaveLength(0);
  });

  it("shows exactly one toolbar, for the selected card", () => {
    render(
      <ChordBoard items={items} selectedId="a" onResize={() => {}} />,
    );
    expect(toolbars()).toHaveLength(1);
    expect(toolbar()!.getAttribute("data-toolbar-for")).toBe("a");
  });

  it("moves the toolbar when a different card is selected", () => {
    const { container } = render(<Harness initial="a" />);
    fireEvent.click(container.querySelector('[data-board-id="b"]')!);
    expect(toolbars()).toHaveLength(1);
    expect(toolbar()!.getAttribute("data-toolbar-for")).toBe("b");
  });

  it("dismisses on Escape", () => {
    render(<Harness initial="a" />);
    expect(toolbar()).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toolbars()).toHaveLength(0);
  });

  it("dismisses when the click lands on the board background", () => {
    const { container } = render(<Harness initial="a" />);
    fireEvent.click(container.querySelector(".chordl-board-export")!);
    expect(toolbars()).toHaveLength(0);
  });

  it("keeps a click inside the toolbar from dismissing it", () => {
    render(<Harness initial="a" />);
    fireEvent.click(document.body.querySelector(".chordl-board-action-break")!);
    expect(toolbars()).toHaveLength(1);
  });

  it("carries no toolbar for a selected card that is no longer on the board", () => {
    render(
      <ChordBoard items={items} selectedId="gone" onResize={() => {}} />,
    );
    expect(toolbars()).toHaveLength(0);
  });

  /**
   * The old row sat inside the card and was gated on `!isExporting` for exactly
   * this reason. A floating toolbar is one `position: fixed` element away from
   * landing in the middle of a PNG.
   */
  it("is gone while an export is running", async () => {
    const { container } = render(
      <ChordBoard items={items} selectedId="a" onResize={() => {}} />,
    );
    expect(toolbars()).toHaveLength(1);

    await act(async () => {
      fireEvent.click(container.querySelector(".chordl-board-export-png")!);
    });
    expect(toolbars()).toHaveLength(0);

    // The capture waits a frame before it even calls html2canvas, and jsdom's
    // requestAnimationFrame is a real timer.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });
    expect(settleCapture).toBeTruthy();

    await act(async () => {
      settleCapture!({ toBlob: (cb: (b: Blob | null) => void) => cb(null) });
      await new Promise((r) => setTimeout(r, 0));
    });
    // And back once the capture is done.
    expect(toolbars()).toHaveLength(1);
  });

  it("renders outside the exported region entirely", () => {
    const { container } = render(
      <ChordBoard items={items} selectedId="a" onResize={() => {}} />,
    );
    const exportRoot = container.querySelector(".chordl-board-export")!;
    expect(exportRoot.contains(toolbar()!)).toBe(false);
    // And not inside the card either — that is the whole point.
    expect(
      container.querySelector('[data-board-id="a"]')!.querySelector(".chordl-board-actions"),
    ).toBeNull();
  });

  it("names itself for assistive tech", () => {
    render(
      <ChordBoard items={items} selectedId="a" onResize={() => {}} />,
    );
    expect(toolbar()!.getAttribute("role")).toBe("toolbar");
    expect(toolbar()!.getAttribute("aria-label")).toMatch(/C/);
  });

  it("keeps every control on one row", () => {
    render(
      <ChordBoard items={items} selectedId="a" onResize={() => {}} />,
    );
    expect(toolbar()!.style.flexWrap).toBe("nowrap");
    expect(toolbar()!.querySelectorAll("button")).toHaveLength(11);
  });

  it("moves focus between its controls with the arrow keys", () => {
    render(
      <ChordBoard items={items} selectedId="a" onResize={() => {}} />,
    );
    const bar = toolbar()!;
    const buttons = [...bar.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
    buttons[0].focus();
    fireEvent.keyDown(bar, { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]);
    fireEvent.keyDown(bar, { key: "Home" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(bar, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it("is one tab stop, as a toolbar should be", () => {
    render(
      <ChordBoard items={items} selectedId="a" onResize={() => {}} />,
    );
    const tabbable = [...toolbar()!.querySelectorAll("button")]
      .filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });

  /**
   * The toolbar portals to <body>, so its z-index competes with the
   * host's *root* — `#root { position: relative; z-index: 1 }` in the dev host —
   * and not with anything inside it. A dialog at z-index 50 nested inside that
   * root therefore loses to a toolbar at 40 that sits outside it, and the
   * toolbar paints over a backdrop that claims to have made the page inert.
   *
   * No stacking trick fixes that from outside: the dialog lives inside the very
   * transformed subtree the toolbar has to escape. The toolbar leaves instead.
   */
  it("gets out of the way of the board's own modal dialog", () => {
    const { container } = render(<Harness initial="a" onNew={() => {}} />);
    expect(toolbars()).toHaveLength(1);

    fireEvent.click(container.querySelector(".chordl-board-new")!);
    expect(container.querySelector('[role="dialog"][aria-modal="true"]')).toBeTruthy();
    expect(toolbars()).toHaveLength(0);

    fireEvent.click(container.querySelector(".chordl-board-new-cancel")!);
    expect(toolbars()).toHaveLength(1);
  });

  /**
   * And the same for a modal the board never rendered and has no state for —
   * the host's listen and follow-along overlays are exactly this.
   */
  it("gets out of the way of a modal the host opened", async () => {
    render(<Harness initial="a" />);
    expect(toolbars()).toHaveLength(1);

    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    await act(async () => {
      document.body.appendChild(overlay);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(toolbars()).toHaveLength(0);

    await act(async () => {
      overlay.remove();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(toolbars()).toHaveLength(1);
  });

  /**
   * Before the controls floated, the eleven buttons sat inside each
   * card in DOM order, so Tab walked into them — `opacity: 0` hid them without
   * taking them out of the tab order. Moving them out took the keyboard's only
   * route in with them, because selection was a click and nothing else.
   */
  it("lets the keyboard select a card, which is what the toolbar hangs off", () => {
    const { container } = render(<Harness />);
    const card = container.querySelector<HTMLElement>('[data-board-id="a"]')!;

    expect(card.tabIndex).toBe(0);
    card.focus();
    expect(document.activeElement).toBe(card);

    fireEvent.keyDown(card, { key: "Enter" });
    expect(toolbars()).toHaveLength(1);
    expect(toolbar()!.getAttribute("data-toolbar-for")).toBe("a");
  });

  it("toggles the selection back off with Space, as the second click does", () => {
    const { container } = render(<Harness initial="a" />);
    const card = container.querySelector<HTMLElement>('[data-board-id="a"]')!;
    fireEvent.keyDown(card, { key: " " });
    expect(toolbars()).toHaveLength(0);
    fireEvent.keyDown(card, { key: " " });
    expect(toolbars()).toHaveLength(1);
  });

  it("hands the toolbar's controls a tab stop once a card is selected", () => {
    const { container } = render(<Harness />);
    const card = container.querySelector<HTMLElement>('[data-board-id="a"]')!;
    fireEvent.keyDown(card, { key: "Enter" });
    const tabbable = [...toolbar()!.querySelectorAll("button")].filter((b) => b.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
  });

  it("hands focus back to the card rather than stranding it on a removed node", () => {
    const { container } = render(<Harness initial="a" />);
    const editBtn = document.body.querySelector<HTMLButtonElement>(".chordl-board-action-edit")!;
    editBtn.focus();
    expect(toolbar()!.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(container.querySelector('[data-board-id="a"]'));
  });
});

/**
 * `ResizeObserver` fires on *size*. An anchor that moves without
 * resizing — a lazily-loaded diagram on the row above finishes and grows, so
 * this row shifts down — changes no rect the card or the toolbar owns, and
 * nothing scrolled, nothing resized, and the board never re-rendered.
 */
describe("toolbar re-measurement", () => {
  const realRO = globalThis.ResizeObserver;

  beforeEach(() => {
    FakeResizeObserver.reset();
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
  });
  afterEach(() => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = realRO;
    FakeResizeObserver.reset();
  });

  /** A measurement whose card top a test can move between renders. */
  const movingCard = (readTop: () => number): MeasureToolbar => () => ({
    card: { top: readTop(), left: 400, width: 200, height: 150 },
    toolbar: { width: 400, height: 60 },
    viewport: { width: 1000, height: 800 },
  });

  it("watches the container the card shares with its neighbours", () => {
    const { container } = render(<Harness initial="a" measureToolbar={movingCard(() => 100)} />);
    const card = container.querySelector<HTMLElement>('[data-board-id="a"]')!;
    expect(FakeResizeObserver.watches(card)).toBe(true);
    expect(FakeResizeObserver.watches(card.parentElement!)).toBe(true);
  });

  it("re-measures when a neighbour reflows and pushes the card down", () => {
    let top = 100;
    const { container } = render(<Harness initial="a" measureToolbar={movingCard(() => top)} />);
    expect(toolbar()!.style.top).toBe("260px");

    // The card's own box never changes; the grid around it gets taller.
    top = 300;
    act(() => {
      FakeResizeObserver.fire(container.querySelector('[data-board-id="a"]')!.parentElement!);
    });
    expect(toolbar()!.style.top).toBe("460px");
  });
});

/**
 * jsdom reports zeroes for every rect, so placement is driven through an
 * injected measurement rather than read off the layout inline.
 */
describe("toolbar placement", () => {
  const measured = (over: Partial<Parameters<typeof placeCardToolbar>[0]>) => ({
    card: { top: 100, left: 400, width: 200, height: 150 },
    toolbar: { width: 400, height: 60 },
    viewport: { width: 1000, height: 800 },
    ...over,
  });

  it("sits below the card when there is room", () => {
    const p = placeCardToolbar(measured({}))!;
    expect(p.placement).toBe("below");
    expect(p.top).toBe(100 + 150 + 10);
  });

  it("flips above when the card is too near the bottom", () => {
    const p = placeCardToolbar(measured({ card: { top: 700, left: 400, width: 200, height: 100 } }))!;
    expect(p.placement).toBe("above");
    expect(p.top).toBe(700 - 10 - 60);
  });

  it("stays below when there is no room either way, and still on screen", () => {
    // A card taller than the viewport: nothing fits above it or below it.
    // Unclamped, `top` would be 800 — the toolbar and all eleven of its
    // controls parked below the bottom of an 800px window, with the card still
    // selected and no way to reach any of them.
    const p = placeCardToolbar(measured({ card: { top: 0, left: 400, width: 200, height: 790 } }))!;
    expect(p.placement).toBe("below");
    expect(p.top).toBe(800 - 8 - 60);
    expect(p.top + 60).toBeLessThanOrEqual(800 - 8);
  });

  it("clamps a toolbar taller than the window to the top margin", () => {
    const p = placeCardToolbar(
      measured({
        card: { top: 0, left: 400, width: 200, height: 790 },
        toolbar: { width: 400, height: 900 },
      }),
    )!;
    expect(p.top).toBe(8);
  });

  it("leaves a placement that already fits exactly where it was", () => {
    const below = placeCardToolbar(measured({}))!;
    expect(below.top).toBe(260);
    const above = placeCardToolbar(
      measured({ card: { top: 700, left: 400, width: 200, height: 100 } }),
    )!;
    expect(above.top).toBe(630);
  });

  it("centres on the card", () => {
    const p = placeCardToolbar(measured({}))!;
    expect(p.left).toBe(500 - 200);
    expect(p.caretLeft).toBe(200);
  });

  it("clamps to the viewport rather than hanging off the edge", () => {
    const right = placeCardToolbar(measured({ card: { top: 100, left: 900, width: 90, height: 150 } }))!;
    expect(right.left).toBe(1000 - 8 - 400);
    const left = placeCardToolbar(measured({ card: { top: 100, left: 0, width: 90, height: 150 } }))!;
    expect(left.left).toBe(8);
    // The caret still points at the card, inside the toolbar's own width.
    expect(left.caretLeft).toBeGreaterThanOrEqual(7);
    expect(right.caretLeft).toBeLessThanOrEqual(400 - 7);
  });

  it("has nothing to place when the card is gone", () => {
    expect(placeCardToolbar(measured({ card: null }))).toBeNull();
  });

  it("flips the rendered toolbar above through the measurement seam", () => {
    const measureToolbar: MeasureToolbar = () => ({
      card: { top: 700, left: 400, width: 200, height: 100 },
      toolbar: { width: 400, height: 60 },
      viewport: { width: 1000, height: 800 },
    });
    render(<Harness initial="a" measureToolbar={measureToolbar} />);
    const bar = toolbar()!;
    expect(bar.getAttribute("data-placement")).toBe("above");
    expect(bar.style.top).toBe("630px");
    expect(bar.style.position).toBe("fixed");
  });

  it("places the rendered toolbar below when the card has room", () => {
    const measureToolbar: MeasureToolbar = () => ({
      card: { top: 100, left: 400, width: 200, height: 150 },
      toolbar: { width: 400, height: 60 },
      viewport: { width: 1000, height: 800 },
    });
    render(<Harness initial="a" measureToolbar={measureToolbar} />);
    const bar = toolbar()!;
    expect(bar.getAttribute("data-placement")).toBe("below");
    expect(bar.style.top).toBe("260px");
    expect(bar.style.left).toBe("300px");
  });
});
