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
  isVerovioReady: () => true,
  renderMeiToSvg: () => Promise.resolve(
    `<svg viewBox="0 0 140 120">` +
    `<g class="note" id="chordl-playback-note-0"><path/></g>` +
    `<g class="note" id="chordl-playback-note-1"><path/></g>` +
    `<g class="note" id="chordl-playback-note-2"><path/></g>` +
    `</svg>`,
  ),
}));

import { PianoChord } from "../src/components/PianoChord";

/**
 * A host that owns playback (the board's player) drives every card's
 * highlighting from one timeline, so the chord renderer has to accept the
 * sounding indices rather than only produce them. Absent the prop the
 * component's own playback still drives itself — same idiom as
 * `StaffNotation`/`PianoKeyboard`, where a controlled value wins and internal
 * state is the fallback.
 */
describe("PianoChord controlled activePlaybackIndices", () => {
  it("lights the keyboard for display=keyboard", () => {
    const { container } = render(
      <PianoChord chord="C" display="keyboard" showPlayback={false} activePlaybackIndices={[1]} />,
    );
    expect(container.querySelectorAll(".bc-playback-note-active")).toHaveLength(1);
  });

  it("lights the staff for display=staff", async () => {
    const { container } = render(
      <PianoChord chord="C" display="staff" showPlayback={false} activePlaybackIndices={[1]} />,
    );
    await waitFor(() => expect(container.querySelector(".bc-staff__engraving svg")).toBeTruthy());
    await waitFor(() => {
      expect(container.querySelector("#chordl-playback-note-1")?.classList.contains("bc-staff-note-active"))
        .toBe(true);
      expect(container.querySelector("#chordl-playback-note-0")?.classList.contains("bc-staff-note-active"))
        .toBe(false);
    });
  });

  it("lights both diagrams for display=both", async () => {
    const { container } = render(
      <PianoChord chord="C" display="both" showPlayback={false} activePlaybackIndices={[1]} />,
    );
    await waitFor(() => expect(container.querySelector(".bc-staff__engraving svg")).toBeTruthy());
    await waitFor(() => {
      expect(container.querySelectorAll(".bc-playback-note-active")).toHaveLength(1);
      expect(container.querySelector("#chordl-playback-note-1")?.classList.contains("bc-staff-note-active"))
        .toBe(true);
    });
  });

  it("lights a slash-chord voicing's keyboard (the separate bass-note branch)", () => {
    const { container } = render(
      <PianoChord chord="C/G" display="keyboard" showPlayback={false} activePlaybackIndices={[0]} />,
    );
    expect(container.querySelectorAll(".bc-playback-note-active")).toHaveLength(1);
  });

  it("clears the highlight when the host reports nothing sounding", () => {
    const { container } = render(
      <PianoChord chord="C" display="keyboard" showPlayback={false} activePlaybackIndices={[]} />,
    );
    expect(container.querySelectorAll(".bc-playback-note-active")).toHaveLength(0);
  });

  it("still drives its own highlighting from its own playback when uncontrolled", async () => {
    const { container, getByLabelText } = render(<PianoChord chord="C" display="keyboard" />);
    expect(container.querySelectorAll(".bc-playback-note-active")).toHaveLength(0);
    fireEvent.click(getByLabelText("Play arpeggiated"));
    await waitFor(() => {
      expect(container.querySelectorAll(".bc-playback-note-active")).toHaveLength(1);
    });
  });

  it("still drives both diagrams from its own playback when uncontrolled", async () => {
    const { container, getByLabelText } = render(<PianoChord chord="C" display="both" />);
    await waitFor(() => expect(container.querySelector(".bc-staff__engraving svg")).toBeTruthy());
    fireEvent.click(getByLabelText("Play arpeggiated"));
    await waitFor(() => {
      expect(container.querySelectorAll(".bc-playback-note-active")).toHaveLength(1);
      expect(container.querySelector("#chordl-playback-note-1")?.classList.contains("bc-staff-note-active"))
        .toBe(true);
    });
  });
});
