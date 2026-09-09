// @vitest-environment jsdom
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GuitarChordPanel } from "../src/components/GuitarChordPanel";

/**
 * The host drives note indices — positions in the frame's own playback order
 * (`onPlaybackSpecChange`'s `notes`, low string to high) — and the fretboard
 * paints physical strings. Open C mutes the low E, so note index 0 is the A
 * string (physical index 1) and the five sounding notes map to strings 1-5.
 */
describe("GuitarChordPanel controlled activePlaybackIndices", () => {
  it("maps note indices onto the sounding physical strings", () => {
    const { container } = render(
      <GuitarChordPanel chord="C" showControls={false} showPlayback={false} activePlaybackIndices={[0, 2]} />,
    );
    expect(container.querySelector(".bc-guitar-chord")?.getAttribute("data-active-strings"))
      .toBe("1 3");
  });

  it("paints the whole voicing for a block attack", () => {
    const { container } = render(
      <GuitarChordPanel chord="C" showControls={false} showPlayback={false}
        activePlaybackIndices={[0, 1, 2, 3, 4]} />,
    );
    expect(container.querySelector(".bc-guitar-chord")?.getAttribute("data-active-strings"))
      .toBe("1 2 3 4 5");
  });

  it("ignores an index past the end of the voicing rather than painting string 0", () => {
    const { container } = render(
      <GuitarChordPanel chord="C" showControls={false} showPlayback={false} activePlaybackIndices={[9]} />,
    );
    expect(container.querySelector(".bc-guitar-chord")?.getAttribute("data-active-strings"))
      .toBe("");
  });

  it("paints nothing when the host reports nothing sounding", () => {
    const { container } = render(
      <GuitarChordPanel chord="C" showControls={false} showPlayback={false} activePlaybackIndices={[]} />,
    );
    expect(container.querySelector(".bc-guitar-chord")?.getAttribute("data-active-strings"))
      .toBe("");
  });
});
