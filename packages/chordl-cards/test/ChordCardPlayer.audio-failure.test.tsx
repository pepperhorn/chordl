// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChordCardPlayer } from "../src/ChordCardPlayer";
import { loadTheme } from "./theme-fixture";

// Its own file: chordl-react caches a loaded patch for the module's lifetime,
// so a failing load has to be the first load this module registry sees.
vi.mock("smplr", () => ({
  Soundfont: class {
    load = Promise.reject(new Error("soundfont fetch failed"));
    start = vi.fn();
  },
  Soundfont2Sampler: class {},
}));
vi.mock("soundfont2", () => ({ SoundFont2: class {} }));
vi.stubGlobal("AudioContext", class {
  state = "running";
  currentTime = 0;
  destination = {};
});

describe("ChordCardPlayer when the sound cannot load", () => {
  it("keeps the static diagram, says the sound failed, and re-enables the controls", async () => {
    const { container } = render(<ChordCardPlayer chord="C" face="keyboard" theme={loadTheme()} />);
    const play = screen.getByRole("button", { name: /play chord/i });
    fireEvent.click(play);
    await waitFor(() => expect(container.querySelector(".ccp-status")!.textContent).toMatch(/could not load/i));
    expect(container.querySelector("svg.bc-keyboard")).toBeTruthy();
    expect(container.querySelectorAll(".bc-playback-note-active")).toHaveLength(0);
    expect(play.getAttribute("aria-pressed")).toBe("false");
    expect((play as HTMLButtonElement).disabled).toBe(false);
  });
});
