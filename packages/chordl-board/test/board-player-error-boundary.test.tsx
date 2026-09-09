import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import type { BoardItem } from "../src/types";

/**
 * The card that refuses to draw, rendered by the *real* renderer.
 *
 * `board-player.test.tsx` mocks `PianoChord` wholesale, which is right for
 * asserting which notes reach the audio layer — and is exactly why it could
 * never catch this: a stub returns a `<div>` for every chord, including the
 * ones the real component throws over. `PianoChord` throws during render for a
 * chord it will not draw ("C starting on the 7th" — C major has no 7th), and a
 * throw out of render with no boundary above it unmounts the whole React root.
 * `ChordBoard` wraps every card in `CardErrorBoundary` for precisely this
 * reason; the player has to do the same or pressing Play blanks the page.
 *
 * So only the audio layer is stubbed here — jsdom has no AudioContext — and
 * the chord renderers are the shipping ones.
 */
const startPlayback = vi.fn(async () => ({ events: [], completion: Promise.resolve(), cancel: vi.fn() }));
const preloadInstruments = vi.fn(async () => {});

vi.mock("@pepperhorn/chordl-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pepperhorn/chordl-react")>();
  return { ...actual, startPlayback, preloadInstruments };
});

const { BoardPlayer } = await import("../src/BoardPlayer");
const { ChordBoard } = await import("../src/ChordBoard");

const noop = () => {};

/** A chord card naming a degree its chord does not have. */
const bad: BoardItem = { id: "x", kind: "chord", nl: "C starting on the 7th" };
const good: BoardItem = { id: "a", kind: "chord", nl: "C", display: "keyboard" };

describe("BoardPlayer — a card that throws during render", () => {
  /* React logs every boundary-caught error; the noise is not the assertion. */
  let error: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    error.mockRestore();
  });

  it("is the same card ChordBoard already survives", () => {
    const { container } = render(<ChordBoard items={[bad, good]} />);
    expect(container.textContent).toContain("doesn't have a");
  });

  it("shows an inline message instead of unmounting the board", () => {
    const { container } = render(
      <BoardPlayer items={[bad, good]} playing={false} onPlayingChange={noop} />,
    );
    // The board is still on screen…
    expect(container.querySelector(".board-player")).not.toBeNull();
    // …the bad card says why it is not drawn…
    expect(container.textContent).toContain("doesn't have a");
    // …and the card beside it drew anyway.
    expect(container.querySelectorAll("[data-board-id]")).toHaveLength(2);
  });

  it("survives it in play mode too", () => {
    const { container } = render(
      <BoardPlayer items={[bad, good]} playing onPlayingChange={noop} />,
    );
    expect(container.querySelector(".board-player")).not.toBeNull();
    expect(container.textContent).toContain("doesn't have a");
  });
});
