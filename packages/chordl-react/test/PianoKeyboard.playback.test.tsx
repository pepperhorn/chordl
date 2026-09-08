// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../src/audio/usePlaybackTimeline", () => ({
  usePlaybackTimeline: (onActiveChange?: (indices: number[]) => void) => ({
    playing: null,
    stop: vi.fn(),
    play: async (_notes: unknown[], options: { mode: string }) => {
      onActiveChange?.(options.mode === "block" ? [0, 1, 2] : [1]);
    },
  }),
}));

import { PianoKeyboard } from "../src/components/PianoKeyboard";

describe("PianoKeyboard playback paint", () => {
  it("adds transient paint to the specifically attacked key", async () => {
    const { container, getByLabelText } = render(
      <PianoKeyboard highlightKeys={["C", "E", "G"]} />,
    );
    fireEvent.click(getByLabelText("Play arpeggiated"));
    await waitFor(() => {
      const active = container.querySelectorAll(".bc-playback-note-active");
      expect(active).toHaveLength(1);
      expect(active[0].getAttribute("fill")).toBe("#f59e0b");
    });
  });

  it("reports the exact ordered MIDI voicing", async () => {
    const report = vi.fn();
    render(<PianoKeyboard highlightKeys={["C", "E", "G"]} onPlaybackSpecChange={report} />);
    await waitFor(() => expect(report).toHaveBeenCalledWith({
      notes: [48, 52, 55],
      instrument: "acoustic_grand_piano",
    }));
  });
});
