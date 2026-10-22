// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChordCardPlayer } from "../src/ChordCardPlayer";
import { parseTheme } from "../src/theme";
import { RAW_THEME, loadTheme } from "./theme-fixture";

// The audio layer: chordl-react's startPlayback loads smplr lazily. Stubbed the
// way chordl-react's own playback tests do, recording every patch built and
// every note started.
const { created, started } = vi.hoisted(() => ({
  created: [] as string[],
  started: [] as Array<{ instrument: string; note: number }>,
}));

vi.mock("smplr", () => ({
  Soundfont: class {
    load: Promise<unknown>;
    instrument: string;
    constructor(_ctx: unknown, opts: { instrument: string }) {
      this.instrument = opts.instrument;
      created.push(opts.instrument);
      this.load = Promise.resolve(this);
    }
    start = (e: { note: number }) => {
      started.push({ instrument: this.instrument, note: e.note });
      return () => {};
    };
  },
  Soundfont2Sampler: class {
    load = Promise.reject(new Error("unused"));
  },
}));
vi.mock("soundfont2", () => ({ SoundFont2: class {} }));

// A clock that moves, so the timeline actually reaches its events and paints.
const t0 = performance.now();
class StubAudioContext {
  state = "running";
  destination = {};
  get currentTime() { return (performance.now() - t0) / 1000; }
  resume() { return Promise.resolve(); }
}
vi.stubGlobal("AudioContext", StubAudioContext);

const THEME = loadTheme();
const notesOf = (instrument: string) => started.filter((s) => s.instrument === instrument).map((s) => s.note);

beforeEach(() => { started.length = 0; });

describe("ChordCardPlayer — keyboard", () => {
  it("renders the keyboard, note names under the keys, and the controls", () => {
    const { container } = render(<ChordCardPlayer chord="C" face="keyboard" theme={THEME} />);
    const root = container.querySelector(".chord-card-player")!;
    expect(root).toBeTruthy();
    expect(root.getAttribute("data-face")).toBe("keyboard");
    expect(root.querySelector("svg.bc-keyboard")).toBeTruthy();
    expect([...root.querySelectorAll(".bc-note-name")].map((n) => n.textContent)).toEqual(["C", "E", "G"]);

    expect(screen.getByRole("button", { name: /play chord/i }).className).toContain("btn-play-chord");
    expect(screen.getByRole("button", { name: /play arpeggio/i }).className).toContain("btn-play-arpeggio");
    expect(screen.queryByRole("button", { name: /l\.h\. then r\.h\./i })).toBeNull();

    const tempo = screen.getByRole("slider", { name: /tempo/i }) as HTMLInputElement;
    expect([tempo.min, tempo.max, tempo.value]).toEqual(["40", "300", "120"]);
    expect(tempo.getAttribute("aria-valuetext")).toBe("120 BPM");
  });

  it("spells note names for display", () => {
    const { container } = render(<ChordCardPlayer chord="Ebmaj7" face="keyboard" theme={THEME} />);
    expect([...container.querySelectorAll(".bc-note-name")].map((n) => n.textContent))
      .toEqual(["Eb", "G", "Bb", "D"]);
  });

  it("plays the block chord through the audio layer and paints the sounding keys", async () => {
    const { container } = render(<ChordCardPlayer chord="C" face="keyboard" theme={THEME} />);
    fireEvent.click(screen.getByRole("button", { name: /play chord/i }));
    await waitFor(() => expect(notesOf("acoustic_grand_piano")).toEqual([48, 52, 55]));
    await waitFor(() => expect(container.querySelectorAll(".bc-playback-note-active")).toHaveLength(3));
    expect(created).toContain("acoustic_grand_piano");
  });

  it("marks the playing control as selected while it plays", async () => {
    render(<ChordCardPlayer chord="C" face="keyboard" theme={THEME} />);
    const arp = screen.getByRole("button", { name: /play arpeggio/i });
    expect(arp.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(arp);
    await waitFor(() => expect(arp.getAttribute("aria-pressed")).toBe("true"));
  });

  it("takes its default tempo from the theme, and the slider changes it", () => {
    const theme = parseTheme({ ...RAW_THEME, playback: { arpeggioBpm: 90 } });
    render(<ChordCardPlayer chord="C" face="keyboard" theme={theme} />);
    const tempo = screen.getByRole("slider", { name: /tempo/i }) as HTMLInputElement;
    expect(tempo.value).toBe("90");
    fireEvent.change(tempo, { target: { value: "200" } });
    expect(tempo.value).toBe("200");
    expect(screen.getByText("200 BPM").className).toContain("ccp-tempo-value");
  });
});

describe("ChordCardPlayer — keyboard-hands", () => {
  it("draws two brackets, L.H. and R.H., and offers L.H. then R.H.", () => {
    const { container } = render(<ChordCardPlayer chord="F#m7" face="keyboard-hands" theme={THEME} />);
    const svgText = [...container.querySelectorAll("svg.bc-keyboard text")].map((t) => t.textContent);
    expect(svgText.filter((t) => t === "L.H." || t === "R.H.")).toEqual(["L.H.", "R.H."]);
    expect([...container.querySelectorAll(".bc-note-name")].map((n) => n.textContent)).toEqual(["F#", "A", "E"]);
    expect(screen.getByRole("button", { name: /l\.h\. then r\.h\./i }).className).toContain("btn-play-hands");
  });

  it("plays the bass, then the right-hand pair", async () => {
    render(<ChordCardPlayer chord="C7" face="keyboard-hands" theme={THEME} />);
    fireEvent.change(screen.getByRole("slider", { name: /tempo/i }), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: /l\.h\. then r\.h\./i }));
    await waitFor(() => expect(notesOf("acoustic_grand_piano")).toEqual([48]));
    await waitFor(() => expect(notesOf("acoustic_grand_piano")).toEqual([48, 52, 58]));
  });
});

describe("ChordCardPlayer — guitar-top3", () => {
  it("renders the frame and the chord/arpeggio controls", () => {
    const { container } = render(<ChordCardPlayer chord="C" face="guitar-top3" theme={THEME} />);
    expect(container.querySelector(".chord-card-player .bc-guitar-chord")).toBeTruthy();
    expect(screen.getByRole("button", { name: /play chord/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /play arpeggio/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /l\.h\./i })).toBeNull();
  });

  it("strums the sounding strings low to high on the guitar patch", async () => {
    render(<ChordCardPlayer chord="C" face="guitar-top3" theme={THEME} />);
    fireEvent.click(screen.getByRole("button", { name: /play arpeggio/i }));
    await waitFor(() => expect(notesOf("electric_guitar_clean")).toEqual([55, 60, 64]));
  });
});

describe("ChordCardPlayer — guitar (six strings)", () => {
  it("renders a chords-db shape with no generated badge", () => {
    const { container } = render(<ChordCardPlayer chord="C" face="guitar" theme={THEME} />);
    expect(container.querySelector(".chord-card-player[data-face='guitar'] .bc-guitar-chord")).toBeTruthy();
    expect(container.querySelector(".ccp-badge--generated")).toBeNull();
  });

  it("badges a generated voicing as pending teacher review", () => {
    const { container } = render(<ChordCardPlayer chord="C13(#11)" face="guitar" theme={THEME} />);
    const badge = container.querySelector(".ccp-badge--generated");
    expect(badge?.textContent).toMatch(/generated voicing — pending teacher review/i);
  });

  it("strums all six strings' sounding notes low to high", async () => {
    render(<ChordCardPlayer chord="C" face="guitar" theme={THEME} />);
    fireEvent.click(screen.getByRole("button", { name: /play arpeggio/i }));
    await waitFor(() => expect(notesOf("electric_guitar_clean")).toEqual([48, 52, 55, 60, 64]));
  });

  it("explains a chord with no position instead of drawing one", () => {
    render(<ChordCardPlayer chord="C13(b9,b5)" face="guitar" theme={THEME} />);
    expect(screen.getByRole("alert").textContent).toMatch(/no six-string guitar position/);
  });
});

describe("ChordCardPlayer — shell", () => {
  it("carries contextual classes, the caller's className and the theme's UI font", () => {
    const { container } = render(
      <ChordCardPlayer chord="C" face="keyboard" theme={THEME} className="my-card" />,
    );
    const root = container.querySelector(".chord-card-player") as HTMLElement;
    expect(root.classList.contains("my-card")).toBe(true);
    expect(root.style.getPropertyValue("--ccp-font")).toBe(THEME.fonts.families.ui);
    for (const cls of ["ccp-diagram", "ccp-controls", "ccp-tempo", "ccp-tempo-slider", "ccp-status"]) {
      expect(root.querySelector(`.${cls}`), cls).toBeTruthy();
    }
  });

  it("exposes its colours as overridable custom properties and honours reduced motion", () => {
    const { container } = render(<ChordCardPlayer chord="C" face="keyboard" theme={THEME} />);
    const css = [...container.querySelectorAll("style")].map((s) => s.textContent).join("\n");
    for (const v of ["--ccp-primary", "--ccp-selected", "--ccp-ink", "--ccp-border", "--ccp-radius", "--ccp-surface"]) {
      expect(css).toContain(`${v}:`);
    }
    expect(css).toContain("prefers-reduced-motion");
  });

  it("says so, rather than crashing, for a chord the face cannot print", () => {
    render(<ChordCardPlayer chord="C9" face="keyboard-hands" theme={THEME} />);
    expect(screen.getByRole("alert").textContent).toMatch(/C9/);
    expect(screen.queryByRole("button", { name: /play chord/i })).toBeNull();
  });
});
