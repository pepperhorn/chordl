// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChordCardPlayer } from "../src/ChordCardPlayer";
import { parseTheme } from "../src/theme";
import { positionsFor } from "../src/positions";
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
  // The ukulele's .sf2 sampler, recorded under "ukulele".
  Soundfont2Sampler: class {
    load = Promise.resolve();
    instrumentNames = ["Ukulele"];
    loadInstrument() { created.push("ukulele"); return Promise.resolve(); }
    start = (e: { note: number }) => {
      started.push({ instrument: "ukulele", note: e.note });
      return () => {};
    };
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

/** Each note name as a screen reader hears it. */
const names = (root: Element) =>
  [...root.querySelectorAll(".bc-note-name .chord-text-sr")].map((n) => n.textContent);

/** svguitar's tuning row, low string first. */
const tuningRow = (root: Element) =>
  [...root.querySelectorAll("text.tuning")].map((t) => t.textContent);
/** GuitarChord classes one frame line per fret plus the nut. */
const fretCount = (root: Element) => root.querySelectorAll(".bc-frame-fret").length - 1;

describe("ChordCardPlayer — keyboard", () => {
  it("renders the keyboard, note names under the keys, and the controls", () => {
    const { container } = render(<ChordCardPlayer chord="C" face="keyboard" theme={THEME} />);
    const root = container.querySelector(".chord-card-player")!;
    expect(root).toBeTruthy();
    expect(root.getAttribute("data-face")).toBe("keyboard");
    expect(root.querySelector("svg.bc-keyboard")).toBeTruthy();
    expect(names(root)).toEqual(["C", "E", "G"]);

    expect(screen.getByRole("button", { name: /play chord/i }).className).toContain("btn-play-chord");
    expect(screen.getByRole("button", { name: /play arpeggio/i }).className).toContain("btn-play-arpeggio");
    expect(screen.queryByRole("button", { name: /l\.h\. then r\.h\./i })).toBeNull();

    const tempo = screen.getByRole("slider", { name: /tempo/i }) as HTMLInputElement;
    expect([tempo.min, tempo.max, tempo.value]).toEqual(["40", "300", "120"]);
    expect(tempo.getAttribute("aria-valuetext")).toBe("120 BPM");
  });

  it("spells note names for display, flats drawn as glyphs and spoken as words", () => {
    const { container } = render(<ChordCardPlayer chord="Ebmaj7" face="keyboard" theme={THEME} />);
    expect(names(container)).toEqual(["E flat", "G", "B flat", "D"]);
    const visual = [...container.querySelectorAll(".bc-note-name .chord-text-visual")];
    expect(visual.map((n) => n.textContent)).toEqual(["E", "G", "B", "D"]);
    expect(container.querySelectorAll(".bc-note-name svg.chord-accidental-flat")).toHaveLength(2);
  });

  it("names the chord in words for assistive tech", () => {
    const { container } = render(<ChordCardPlayer chord="Ebmaj7" face="keyboard" theme={THEME} />);
    expect(container.querySelector(".chord-card-player")!.getAttribute("aria-label"))
      .toBe("e flat major seventh, keyboard");
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
    expect(names(container)).toEqual(["F sharp", "A", "E"]);
    expect(container.querySelectorAll(".bc-note-name svg.chord-accidental-sharp")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /l\.h\. then r\.h\./i }).className).toContain("btn-play-hands");
  });

  it("sets every note name on one baseline, like the printed card", () => {
    // chordl-react staggers sharps above naturals by default; F#, A and E
    // stepped up and down under the keys (v9 F#m7 review).
    const { container } = render(<ChordCardPlayer chord="F#m7" face="keyboard-hands" theme={THEME} />);
    const tops = [...container.querySelectorAll<HTMLElement>(".bc-annotation-cell")].map((c) => c.style.top);
    expect(tops).toHaveLength(3);
    expect(new Set(tops)).toEqual(new Set(["0px"]));
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

describe("ChordCardPlayer — ukulele", () => {
  it("draws four strings labelled G C E A, named for assistive tech", () => {
    const { container } = render(<ChordCardPlayer chord="C" face="ukulele" theme={THEME} />);
    const player = container.querySelector(".chord-card-player[data-face='ukulele']")!;
    expect(player.getAttribute("aria-label")).toMatch(/ukulele$/);
    expect(player.querySelector(".bc-guitar-chord")).toBeTruthy();
    expect(tuningRow(player)).toEqual(["G", "C", "E", "A"]);
    expect(player.querySelector(".ccp-badge--generated")).toBeNull();
  });

  it("strums G C E C on the ukulele patch, reentrant G first", async () => {
    render(<ChordCardPlayer chord="C" face="ukulele" theme={THEME} />);
    fireEvent.click(screen.getByRole("button", { name: /play arpeggio/i }));
    await waitFor(() => expect(notesOf("ukulele")).toEqual([67, 60, 64, 72]));
  });

  it("explains a chord chords-db has no ukulele shape for", () => {
    render(<ChordCardPlayer chord="C7(#9,#5)" face="ukulele" theme={THEME} />);
    expect(screen.getByRole("alert").textContent).toMatch(/as ukulele: no ukulele shape/);
  });
});

describe("ChordCardPlayer — bass4", () => {
  it("draws four strings labelled E A D G over six frets", () => {
    const { container } = render(<ChordCardPlayer chord="C" face="bass4" theme={THEME} />);
    const player = container.querySelector(".chord-card-player[data-face='bass4']")!;
    expect(player.getAttribute("aria-label")).toMatch(/four-string bass$/);
    expect(tuningRow(player)).toEqual(["E", "A", "D", "G"]);
    expect(fretCount(player)).toBe(6);
  });

  it("plays C-G-C on the bass patch", async () => {
    render(<ChordCardPlayer chord="C" face="bass4" theme={THEME} />);
    fireEvent.click(screen.getByRole("button", { name: /play arpeggio/i }));
    await waitFor(() => expect(notesOf("electric_bass_finger")).toEqual([36, 43, 48]));
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
    render(<ChordCardPlayer chord="C13(b9,#5)" face="guitar" theme={THEME} />);
    expect(screen.getByRole("alert").textContent).toMatch(/no six-string guitar position/);
  });
});

describe("ChordCardPlayer — a position elsewhere on the neck", () => {
  it("draws and plays the request it is given instead of the card shape", async () => {
    const octave = positionsFor("C", "guitar-top3", THEME).find((p) => p.kind === "octave")!;
    const { container } = render(<ChordCardPlayer chord="C" face="guitar-top3" theme={THEME} request={octave.request} />);
    // svguitar prints the window's first fret beside a slid diagram.
    expect(container.querySelector(".bc-guitar-chord text.fret-position")?.textContent).toBe("12fr");
    fireEvent.click(screen.getByRole("button", { name: /play arpeggio/i }));
    await waitFor(() => expect(notesOf("electric_guitar_clean")).toEqual([67, 72, 76]));
  });

  it("badges a generated alternative as pending teacher review", () => {
    const generated = positionsFor("C", "guitar-top3", THEME).find((p) => p.generated)!;
    const { container } = render(<ChordCardPlayer chord="C" face="guitar-top3" theme={THEME} request={generated.request} />);
    expect(container.querySelector(".ccp-badge--generated")).toBeTruthy();
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
