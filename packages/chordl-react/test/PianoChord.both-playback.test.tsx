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

vi.mock("../src/verovio", () => ({
  renderMeiToSvg: () => Promise.resolve(
    `<svg viewBox="0 0 140 120">` +
    `<g class="note" id="chordl-playback-note-0"><path/></g>` +
    `<g class="note" id="chordl-playback-note-1"><path/></g>` +
    `<g class="note" id="chordl-playback-note-2"><path/></g>` +
    `</svg>`,
  ),
}));

import { PianoChord } from "../src/components/PianoChord";

describe("PianoChord both-mode playback", () => {
  it("drives keyboard and notation paint from the same attack", async () => {
    const { container, getByLabelText } = render(<PianoChord chord="C" display="both" />);
    await waitFor(() => expect(container.querySelector(".bc-staff__engraving svg")).toBeTruthy());

    fireEvent.click(getByLabelText("Play arpeggiated"));

    await waitFor(() => {
      expect(container.querySelectorAll(".bc-playback-note-active")).toHaveLength(1);
      expect(container.querySelector("#chordl-playback-note-1")?.classList.contains("bc-staff-note-active"))
        .toBe(true);
    });
    expect(container.querySelectorAll("[data-controls]")).toHaveLength(1);
  });
});
