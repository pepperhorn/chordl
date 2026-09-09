import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import type { BoardItem } from "../src/types";

/**
 * The audio layer, stubbed at the package boundary.
 *
 * jsdom has no AudioContext and smplr fetches soundfonts over the network, so
 * the real `startPlayback` cannot run here at all. What these tests are about
 * is *which* notes reach it, in which patch, and when the previous chord gets
 * cut — all of which is visible in the call log. `importOriginal` is spread
 * back in because BoardPlayer reaches the same package for the card renderers
 * and the theme helpers, and only the named exports below are replaced.
 */
const cancel = vi.fn();
const controller = { events: [], completion: Promise.resolve(), cancel };
const startPlayback = vi.fn(async () => controller);
const preloadInstruments = vi.fn(async () => {});

/** What each card was handed, in render order. See the last two tests. */
const lit: Array<number[] | undefined> = [];
const litGuitar: Array<number[] | undefined> = [];
/** Scales handed to each card, for the default-scale test. */
const scales: Array<number | undefined> = [];

vi.mock("@pepperhorn/chordl-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pepperhorn/chordl-react")>();
  return {
    ...actual,
    startPlayback,
    preloadInstruments,
    // Stubbed for the highlight assertion only: whether a note is lit is
    // PianoChord's own business and has its own tests, so what this asserts is
    // that the right card was handed the right indices — which the real
    // component renders as SVG geometry rather than anything queryable.
    PianoChord: (props: { chord: string; scale?: number; activePlaybackIndices?: number[] }) => {
      lit.push(props.activePlaybackIndices);
      scales.push(props.scale);
      return <div data-testid="piano" data-chord={props.chord} />;
    },
    GuitarChordPanel: (props: { chord: string; activePlaybackIndices?: number[] }) => {
      litGuitar.push(props.activePlaybackIndices);
      return <div data-testid="guitar" data-chord={props.chord} />;
    },
  };
});

// Dynamic, not a static `import`: vi.mock is hoisted above the whole module
// body, so a static import of BoardPlayer would run the mock factory before
// the consts above are initialised and die in the temporal dead zone.
const { BoardPlayer } = await import("../src/BoardPlayer");

const items: BoardItem[] = [
  { id: "a", kind: "chord", nl: "C", display: "keyboard", playbackNotes: [60, 64, 67] },
  { id: "t", kind: "text", title: "Verse" },
  { id: "b", kind: "chord", nl: "G", display: "guitar", playbackNotes: [55, 59, 62] },
];

const player = () => document.querySelector(".board-player") as HTMLElement;

const noop = () => {};

describe("BoardPlayer", () => {
  beforeEach(() => {
    startPlayback.mockClear();
    cancel.mockClear();
    preloadInstruments.mockClear();
  });

  it("sounds nothing until play mode is on", () => {
    render(<BoardPlayer items={items} playing={false} onPlayingChange={noop} />);
    fireEvent.keyDown(player(), { key: "ArrowRight" });
    expect(startPlayback).not.toHaveBeenCalled();
  });

  it("preloads the board's distinct instruments when play mode starts", async () => {
    render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    await waitFor(() => expect(preloadInstruments).toHaveBeenCalled());
    expect([...preloadInstruments.mock.calls[0][0]].sort())
      .toEqual(["acoustic_grand_piano", "electric_guitar_clean"]);
  });

  it("steps to the next chord and sounds it", async () => {
    render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    fireEvent.keyDown(player(), { key: "ArrowRight" });
    await waitFor(() => expect(startPlayback).toHaveBeenCalled());
    expect(startPlayback.mock.calls.at(-1)![0]).toEqual([55, 59, 62]); // skipped the text card
  });

  it("cuts the previous chord on every move", async () => {
    render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    fireEvent.keyDown(player(), { key: "ArrowRight" });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(player(), { key: "ArrowLeft" });
    await waitFor(() => expect(cancel).toHaveBeenCalled());
  });

  it("replays the current chord on Space and ArrowDown without moving", async () => {
    render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    fireEvent.keyDown(player(), { key: " " });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(1));
    fireEvent.keyDown(player(), { key: "ArrowDown" });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(2));
    expect(startPlayback.mock.calls[0][0]).toEqual(startPlayback.mock.calls[1][0]);
  });

  it("stops at the ends rather than wrapping", async () => {
    render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    fireEvent.keyDown(player(), { key: "ArrowLeft" });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(1));
    expect(startPlayback.mock.calls[0][0]).toEqual([60, 64, 67]); // still the first chord
  });

  it("toggles play mode with p", () => {
    const onPlayingChange = vi.fn();
    render(<BoardPlayer items={items} playing={false} onPlayingChange={onPlayingChange} />);
    fireEvent.keyDown(player(), { key: "p" });
    expect(onPlayingChange).toHaveBeenCalledWith(true);
  });

  /**
   * The press that leaves play mode must not travel any further.
   *
   * A host has to listen for `p` somewhere outside the player to *enter* the
   * mode — the player is not mounted to hear its own entrance. React flushes
   * the state change, and the host's listener, synchronously inside this
   * dispatch, so a `p` that kept bubbling would be caught by the listener its
   * own handler had just brought back and put the board straight into play
   * mode again. Which is exactly what it did.
   */
  it("keeps the p that leaves play mode from reaching the page", () => {
    const onDocument = vi.fn();
    document.addEventListener("keydown", onDocument);
    try {
      render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
      fireEvent.keyDown(player(), { key: "p", bubbles: true });
      expect(onDocument).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener("keydown", onDocument);
    }
  });

  /**
   * Entering play mode has to hand the board the keyboard.
   *
   * The transport is keyboard-first and the host's Play button keeps focus
   * after the click, so without this the player mounts deaf: ArrowRight goes
   * to the button, nothing moves, and the user has to guess that a click or a
   * Tab is the missing step. Taking focus is right here precisely because the
   * user asked for a mode whose whole purpose is arrow keys.
   */
  it("takes focus when play mode is entered", () => {
    const { rerender } = render(
      <BoardPlayer items={items} playing={false} onPlayingChange={noop} />,
    );
    expect(document.activeElement).not.toBe(player());

    rerender(<BoardPlayer items={items} playing onPlayingChange={noop} />);

    expect(document.activeElement).toBe(player());
  });

  /**
   * ...and only on that transition. Focus is the user's once the mode is open:
   * if they have tabbed to a card's "more" button, a re-render that pulled
   * focus back to the root would undo the move they just made.
   */
  it("does not steal focus back on a later re-render", () => {
    const { rerender } = render(
      <BoardPlayer items={items} playing={false} onPlayingChange={noop} canShowMore />,
    );
    rerender(<BoardPlayer items={items} playing onPlayingChange={noop} canShowMore />);

    const more = document.querySelector<HTMLButtonElement>(".board-player-more")!;
    more.focus();
    expect(document.activeElement).toBe(more);

    rerender(<BoardPlayer items={items} playing onPlayingChange={noop} canShowMore scale={0.9} />);

    expect(document.activeElement).toBe(more);
  });

  it("draws the more affordance only when the host allows it", () => {
    const onShowMore = vi.fn();
    const { rerender } = render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    expect(document.querySelector(".board-player-more")).toBeNull();
    rerender(
      <BoardPlayer items={items} playing onPlayingChange={noop} canShowMore onShowMore={onShowMore} />,
    );
    fireEvent.click(document.querySelector(".board-player-more")!);
    expect(onShowMore).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }));
  });

  /**
   * Space on a focusable div scrolls the page. The board is exactly as tall as
   * a page of chords, so a replay that also jumped the viewport would move the
   * card out from under the cursor the user is following.
   */
  it("keeps Space from scrolling the page", () => {
    render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    const prevented = !fireEvent.keyDown(player(), { key: " ", cancelable: true });
    expect(prevented).toBe(true);
  });

  /**
   * Outside play mode the arrows belong to the page — a display-only board
   * that swallowed them would trap a reader who is scrolling past it.
   */
  it("leaves the arrows to the page when play mode is off", () => {
    render(<BoardPlayer items={items} playing={false} onPlayingChange={noop} />);
    const prevented = !fireEvent.keyDown(player(), { key: "ArrowRight", cancelable: true });
    expect(prevented).toBe(false);
  });

  it("steps forward on a horizontal swipe", async () => {
    render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    const el = player();
    fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(el, { changedTouches: [{ clientX: 80, clientY: 104 }] });
    await waitFor(() => expect(startPlayback).toHaveBeenCalled());
    expect(startPlayback.mock.calls.at(-1)![0]).toEqual([55, 59, 62]);
  });

  it("ignores a swipe that never passes the threshold", () => {
    render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    const el = player();
    fireEvent.touchStart(el, { touches: [{ clientX: 200, clientY: 100 }] });
    fireEvent.touchEnd(el, { changedTouches: [{ clientX: 190, clientY: 100 }] });
    expect(startPlayback).not.toHaveBeenCalled();
  });

  it("cuts the ringing chord when play mode ends", async () => {
    const { rerender } = render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    fireEvent.keyDown(player(), { key: " " });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(1));
    rerender(<BoardPlayer items={items} playing={false} onPlayingChange={noop} />);
    expect(cancel).toHaveBeenCalled();
  });

  it("cuts the ringing chord on unmount", async () => {
    const { unmount } = render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    fireEvent.keyDown(player(), { key: " " });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(1));
    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  /**
   * A board with nothing playable on it. There is no card for the cursor to
   * sit on, so every transport key has to be a no-op rather than an index
   * error — the board still has to draw, because its text is its content.
   */
  it("has no cursor on a board of only text cards", async () => {
    const textOnly: BoardItem[] = [
      { id: "t1", kind: "text", title: "Verse" },
      { id: "t2", kind: "text", title: "Chorus" },
    ];
    const { container } = render(<BoardPlayer items={textOnly} playing onPlayingChange={noop} />);
    for (const key of ["ArrowRight", "ArrowLeft", "ArrowDown", " "]) {
      fireEvent.keyDown(player(), { key });
    }
    expect(startPlayback).not.toHaveBeenCalled();
    expect(container.querySelector(".board-player-cursor")).toBeNull();
    expect(container.textContent).toContain("Chorus");
    await waitFor(() => expect(preloadInstruments).toHaveBeenCalledWith([]));
  });

  /**
   * A chord card `resolveCardPlayback` cannot resolve — a shape hint no
   * parser accepts, and no stored voicing to fall back on. The cursor still
   * lands on it (it is a chord card, and it draws as one), the previous chord
   * still gets cut, and nothing new sounds. Silence is the honest outcome:
   * sounding the chord *before* it would be worse than sounding nothing.
   */
  it("cuts the previous chord and sounds nothing on an unresolvable card", async () => {
    const withGap: BoardItem[] = [
      { id: "a", kind: "chord", nl: "C", playbackNotes: [60, 64, 67] },
      // A degree the chord does not have: `PianoChord` refuses to draw this
      // card, so `resolveCardPlayback` refuses to sound it. (A merely
      // misspelled chord name is not the case to use here — the NL parser is
      // lenient enough to resolve most garbage to *something*.)
      { id: "x", kind: "chord", nl: "C starting on the 7th" },
      { id: "c", kind: "chord", nl: "F", playbackNotes: [65, 69, 72] },
    ];
    render(<BoardPlayer items={withGap} playing onPlayingChange={noop} />);
    fireEvent.keyDown(player(), { key: " " });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(player(), { key: "ArrowRight" });
    await waitFor(() => expect(cancel).toHaveBeenCalled());
    expect(startPlayback).toHaveBeenCalledTimes(1); // the gap card sounds nothing

    // …and the cursor really did move onto it, so one more step reaches "F".
    fireEvent.keyDown(player(), { key: "ArrowRight" });
    await waitFor(() => expect(startPlayback).toHaveBeenCalledTimes(2));
    expect(startPlayback.mock.calls.at(-1)![0]).toEqual([65, 69, 72]);
  });

  /** Only the sounding card lights up; the rest are left to their own state. */
  it("lights the sounding card and no other", async () => {
    startPlayback.mockImplementationOnce(async (
      _notes: Array<string | number>,
      options: { onActiveChange?: (indices: number[]) => void },
    ) => {
      options.onActiveChange?.([0, 2]);
      return controller;
    });
    const twoPianos: BoardItem[] = [
      { id: "a", kind: "chord", nl: "C", playbackNotes: [60, 64, 67] },
      { id: "c", kind: "chord", nl: "F", playbackNotes: [65, 69, 72] },
    ];
    render(<BoardPlayer items={twoPianos} playing onPlayingChange={noop} />);
    lit.length = 0;
    fireEvent.keyDown(player(), { key: " " });
    // The last render pass is what counts — earlier ones ran before the
    // controller reported anything sounding.
    await waitFor(() => expect(lit.slice(-2)).toEqual([[0, 2], undefined]));
  });

  /**
   * A guitar card lights up too. The panel takes the same note-index array and
   * maps it onto strings itself, so the board hands both renderers the one
   * thing it actually knows: which notes of this voicing are sounding.
   */
  it("lights a guitar card's strings", async () => {
    startPlayback.mockImplementationOnce(async (
      _notes: Array<string | number>,
      options: { onActiveChange?: (indices: number[]) => void },
    ) => {
      options.onActiveChange?.([1]);
      return controller;
    });
    render(<BoardPlayer items={items} playing onPlayingChange={noop} />);
    litGuitar.length = 0;
    fireEvent.keyDown(player(), { key: "ArrowRight" }); // onto the guitar card
    await waitFor(() => expect(litGuitar.at(-1)).toEqual([1]));
  });

  /**
   * ...but only when the indices mean what the fretboard thinks they mean.
   *
   * A guitar card with no stored voicing is sounded off the *piano* stack
   * `buildMei` derives — three or four pitches that have nothing to do with
   * the five or six sounding strings of the shape on screen. The panel maps a
   * note index onto `soundingStrings[index]`, so index 0 lights the lowest
   * sounding string whatever pitch was actually heard: the highlight and the
   * audio disagree, and the highlight is the half that looks authoritative.
   * No highlight is the honest answer until the legacy path can derive its
   * pitches from the frame.
   */
  it("does not light a guitar card whose pitches did not come from the fretboard", async () => {
    startPlayback.mockImplementationOnce(async (
      _notes: Array<string | number>,
      options: { onActiveChange?: (indices: number[]) => void },
    ) => {
      options.onActiveChange?.([0]);
      return controller;
    });
    const legacy: BoardItem[] = [
      // No `playbackNotes`: a card saved before the editor stored them.
      { id: "g", kind: "chord", nl: "G", display: "guitar" },
    ];
    litGuitar.length = 0;
    render(<BoardPlayer items={legacy} playing onPlayingChange={noop} />);
    // The card drew, so the assertion below is about what it was handed rather
    // than about a card that never rendered. (With the highlight suppressed
    // there is no second render to wait for: `active` stays null, and React
    // bails out of a state update that changes nothing.)
    expect(litGuitar.length).toBeGreaterThan(0);

    fireEvent.keyDown(player(), { key: " " });
    await waitFor(() => expect(startPlayback).toHaveBeenCalled());

    expect(litGuitar.filter((indices) => indices !== undefined)).toEqual([]);
  });

  /**
   * The suppression is the guitar's alone. A legacy *keyboard* card sounds the
   * same ascending stack `PianoChord` draws, so its indices do line up, and
   * turning its highlight off would be a regression dressed as a fix.
   */
  it("still lights a keyboard card with no stored voicing", async () => {
    startPlayback.mockImplementationOnce(async (
      _notes: Array<string | number>,
      options: { onActiveChange?: (indices: number[]) => void },
    ) => {
      options.onActiveChange?.([0]);
      return controller;
    });
    const legacy: BoardItem[] = [{ id: "k", kind: "chord", nl: "C", display: "keyboard" }];
    render(<BoardPlayer items={legacy} playing onPlayingChange={noop} />);
    lit.length = 0;
    fireEvent.keyDown(player(), { key: " " });
    await waitFor(() => expect(lit.at(-1)).toEqual([0]));
  });

  /**
   * A consumer that omits `scale` must get the same card size it gets from
   * `ChordBoard`, whose default is 0.6. At 1 the same board's cards jump ~1.7x
   * the moment play mode opens — invisible in the dev app only because it
   * passes an explicit scale to both.
   */
  it("defaults scale to the same value ChordBoard does", () => {
    scales.length = 0;
    render(<BoardPlayer items={[items[0]]} playing={false} onPlayingChange={noop} />);
    // `rg` is the default size, whose factor is 1, so this is the raw default.
    expect(scales[0]).toBeCloseTo(0.6);
  });
});
