import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { BoardItem } from "../src/types";

/**
 * What each card handed its chord renderer, in render order. The prop under
 * test has no DOM signature of its own at this layer — a board card either
 * passes it down or drops it — so the renderer is mocked and the call
 * recorded, rather than asserting on pixels a stub would not draw anyway.
 */
type Seen = { chord: string; display?: string; activePlaybackIndices?: number[] };
const seen: Seen[] = [];

vi.mock("@pepperhorn/chordl-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@pepperhorn/chordl-react")>();
  return {
    ...actual,
    PianoChord: (props: { chord: string; display?: string; activePlaybackIndices?: number[] }) => {
      seen.push({ chord: props.chord, display: props.display, activePlaybackIndices: props.activePlaybackIndices });
      return <div data-testid="chord" data-chord={props.chord} />;
    },
  };
});

const { ChordBoard } = await import("../src/ChordBoard");

const chordCard = (id: string, display?: BoardItem["display"]): BoardItem =>
  ({ id, kind: "chord", nl: "Cmaj7", display });

describe("BoardCardContent playback highlighting", () => {
  beforeEach(() => {
    seen.length = 0;
  });

  it("forwards activePlaybackIndices to the chord renderer", () => {
    render(<ChordBoard items={[chordCard("a", "keyboard")]} activePlaybackIndices={{ a: [1, 2] }} />);
    expect(seen.map((s) => s.activePlaybackIndices)).toContainEqual([1, 2]);
  });

  it.each(["keyboard", "staff", "both"] as const)("forwards on the %s display", (display) => {
    render(<ChordBoard items={[chordCard("a", display)]} activePlaybackIndices={{ a: [0] }} />);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ display, activePlaybackIndices: [0] });
  });

  it("defaults to a card with no display set, which renders as a keyboard", () => {
    render(<ChordBoard items={[chordCard("a")]} activePlaybackIndices={{ a: [3] }} />);
    expect(seen[0]?.activePlaybackIndices).toEqual([3]);
  });

  /**
   * The map is keyed by item id, not position. A board reorders, so an
   * index-keyed map would light whichever card happened to move into the slot.
   */
  it("lights the card whose id is in the map, not the one in that position", () => {
    render(
      <ChordBoard items={[chordCard("a"), chordCard("b")]} activePlaybackIndices={{ b: [4] }} />,
    );
    expect(seen).toHaveLength(2);
    expect(seen[0].activePlaybackIndices).toBeUndefined();
    expect(seen[1].activePlaybackIndices).toEqual([4]);
  });

  it("passes nothing when the board is given no map at all", () => {
    render(<ChordBoard items={[chordCard("a")]} />);
    expect(seen[0]?.activePlaybackIndices).toBeUndefined();
  });

  /** A text card has no notes to sound, so an entry for it is simply ignored. */
  it("ignores an entry aimed at a text card", () => {
    const { container } = render(
      <ChordBoard
        items={[{ id: "t", kind: "text", title: "Verse" }]}
        activePlaybackIndices={{ t: [1] }}
      />,
    );
    expect(seen).toHaveLength(0);
    expect(container.textContent).toContain("Verse");
  });
});
