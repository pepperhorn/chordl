// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/audio/usePlaybackTimeline", () => ({
  usePlaybackTimeline: (onActiveChange?: (indices: number[]) => void) => ({
    playing: null,
    stop: vi.fn(),
    play: async (_notes: unknown[], options: { mode: string }) => {
      onActiveChange?.(options.mode === "block" ? [0, 1, 2, 3, 4] : [0]);
    },
  }),
}));

import { GuitarChordPanel } from "../src/components/GuitarChordPanel";

describe("GuitarChordPanel playback", () => {
  it("plays low to high and targets the first sounding physical string", async () => {
    const { container, getByLabelText } = render(<GuitarChordPanel chord="C" />);
    fireEvent.click(getByLabelText("Play guitar chord low to high"));
    await waitFor(() => {
      // Open C mutes low E, so the first sounding note is physical index 1 (A string).
      expect(container.querySelector(".bc-guitar-chord")?.getAttribute("data-active-strings")).toBe("1");
      expect(container.querySelector(".bc-playback-string-1")).not.toBeNull();
    });
  });

  it("paints every sounding string for block playback", async () => {
    const { container, getByLabelText } = render(<GuitarChordPanel chord="C" />);
    fireEvent.click(getByLabelText("Play block guitar chord"));
    await waitFor(() => {
      expect(container.querySelector(".bc-guitar-chord")?.getAttribute("data-active-strings"))
        .toBe("1 2 3 4 5");
    });
  });

  it("reports ordered MIDI notes and clean electric guitar", async () => {
    const report = vi.fn();
    render(<GuitarChordPanel chord="C" onPlaybackSpecChange={report} />);
    await waitFor(() => expect(report).toHaveBeenCalledWith({
      notes: [48, 52, 55, 60, 64],
      instrument: "electric_guitar_clean",
    }));
  });

  it("uses the dedicated ukulele soundfont for ukulele frames", async () => {
    const report = vi.fn();
    render(<GuitarChordPanel chord="C" instrument="ukulele" onPlaybackSpecChange={report} />);
    await waitFor(() => expect(report).toHaveBeenCalledWith(expect.objectContaining({
      instrument: "ukulele",
    })));
  });

  it("keeps playback controls out of static frames", () => {
    const { queryByLabelText } = render(<GuitarChordPanel chord="C" showPlayback={false} />);
    expect(queryByLabelText("Play block guitar chord")).toBeNull();
    expect(queryByLabelText("Play guitar chord low to high")).toBeNull();
  });
});
