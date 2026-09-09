// @vitest-environment jsdom
import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Note } from "tonal";
import { generateMidiFile } from "@pepperhorn/chordl-core";

/**
 * The staff and the play button must describe the same chord.
 *
 * The staff is the reference: whatever pitches the MEI carries are the pitches
 * that have to reach the audio layer, the MIDI labels under the keys, and the
 * downloaded MIDI file. Every earlier bug in this area was some view
 * re-deriving octaves with a rule of its own — `toAscendingNotes` stepping on
 * semitones while the staff stepped on diatonic letters, a keyboard numbering
 * its octaves from the drawn window while the staff numbered them absolutely,
 * a slash chord's right hand raised above the bass on the staff but not in
 * playback. Asserting engraved-equals-played catches all of them as one class.
 */

const rendered: string[] = [];
vi.mock("../src/verovio", () => ({
  renderMeiToSvg: (mei: string) => {
    rendered.push(mei);
    return Promise.resolve(`<svg viewBox="0 0 140 120"><g class="staff"></g></svg>`);
  },
}));

import { PianoChord } from "../src/components/PianoChord";
import { StaffNotation } from "../src/components/StaffNotation";
import type { PlaybackSpecSnapshot } from "../src/types";

/** Every engraved note, in playback-index order, as a MIDI number. */
function engravedMidi(mei: string): number[] {
  return [...mei.matchAll(/<note[^>]*?\/>/g)]
    .map((match) => {
      const tag = match[0];
      const index = Number(/chordl-playback-note-(\d+)/.exec(tag)![1]);
      const letter = /pname="([a-g])"/.exec(tag)![1].toUpperCase();
      const accid = /accid(?:\.ges)?="([a-z]+)"/.exec(tag)?.[1];
      const octave = Number(/oct="(-?\d+)"/.exec(tag)![1]);
      const suffix = accid === "s" ? "#" : accid === "f" ? "b" : "";
      return { index, midi: Note.midi(`${letter}${suffix}${octave}`)! };
    })
    .sort((a, b) => a.index - b.index)
    .map((n) => n.midi);
}

/** Which staff (1 = treble, 2 = bass) each engraved note landed on. */
function engravedStaves(mei: string): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [, n, body] of mei.matchAll(/<staff n="(\d)">([\s\S]*?)<\/staff>/g)) {
    for (const [, index] of body.matchAll(/chordl-playback-note-(\d+)/g)) out[Number(index)] = Number(n);
  }
  return out;
}

const midiNames = (midi: number[]) => midi.map((m) => Note.fromMidi(m));

beforeEach(() => { rendered.length = 0; });

/** Render a chord card and return the MEI it engraved plus the spec it plays. */
async function renderCard(chord: string, display: "staff" | "both") {
  const specs: PlaybackSpecSnapshot[] = [];
  const { container } = render(
    <PianoChord chord={chord} display={display} onPlaybackSpecChange={(spec) => specs.push(spec)} />,
  );
  await waitFor(() => expect(rendered.length).toBeGreaterThan(0));
  await waitFor(() => expect(specs.length).toBeGreaterThan(0));
  return {
    container,
    mei: rendered[rendered.length - 1],
    played: specs[specs.length - 1].notes,
  };
}

/**
 * Plain triads, seventh chords, a flat-spelled chord, a library voicing whose
 * declared octaves are a tenth, an inversion, an octave shift, and two slash
 * chords. Each is a different route through PianoChord's octave arithmetic.
 */
const CHORDS = [
  "C",
  "Cmaj7",
  "Bbm",
  "Db7 rootless style",
  "Cmaj7 starting on E",
  "C7 rootless style starting on A",
  "Cm7 chord up",
  "C over G",
  "Am7 over D",
];

describe("a chord card plays the notes it engraves", () => {
  for (const chord of CHORDS) {
    it(`sounds the staff's own pitches for "${chord}" (staff card)`, async () => {
      const { mei, played } = await renderCard(chord, "staff");
      expect(midiNames(played)).toEqual(midiNames(engravedMidi(mei)));
    });

    it(`sounds the staff's own pitches for "${chord}" (keyboard button, both mode)`, async () => {
      const { mei, played } = await renderCard(chord, "both");
      expect(midiNames(played)).toEqual(midiNames(engravedMidi(mei)));
    });
  }
});

describe("the MIDI note names under the keys agree with the staff", () => {
  for (const chord of CHORDS) {
    it(`labels "${chord}" at the engraved octaves`, async () => {
      const { container, mei } = await renderCard(`${chord} with midi note names`, "both");
      const labels = [...container.querySelectorAll<HTMLElement>(".bc-note-name")]
        .map((el) => el.textContent);
      // Labels are drawn in keyboard order (left to right); the MEI is in
      // playback order. Compare as pitch multisets, enharmonics normalised.
      const asMidi = (name: string) => Note.midi(name)!;
      expect([...labels.map((l) => asMidi(l!))].sort((a, b) => a - b))
        .toEqual([...engravedMidi(mei)].sort((a, b) => a - b));
    });
  }
});

/**
 * D1 — a bare `StaffNotation` with no octave props. `buildMei` defaults the
 * right hand to octave 4 and engraves C4-E4-G4; playback used to default it to
 * 3 and sound C3-E3-G3, an octave below the picture beside the button.
 */
describe("StaffNotation's own defaults", () => {
  it("plays the octave it engraves", async () => {
    const specs: PlaybackSpecSnapshot[] = [];
    render(<StaffNotation notes={["C", "E", "G"]} onPlaybackSpecChange={(s) => specs.push(s)} />);
    await waitFor(() => expect(rendered.length).toBeGreaterThan(0));
    await waitFor(() => expect(specs.length).toBeGreaterThan(0));
    expect(specs[specs.length - 1].notes).toEqual([60, 64, 67]);
    expect(engravedMidi(rendered[rendered.length - 1])).toEqual([60, 64, 67]);
  });

  /**
   * The staff steps octaves on the diatonic letter, `toAscendingNotes` stepped
   * on the semitone. G# and Ab are the same semitone but different letters, so
   * the two rules parted company on any chromatic pair.
   */
  it("agrees with the staff on a chromatic pair", async () => {
    const specs: PlaybackSpecSnapshot[] = [];
    render(<StaffNotation notes={["C", "G#", "Ab"]} onPlaybackSpecChange={(s) => specs.push(s)} />);
    await waitFor(() => expect(rendered.length).toBeGreaterThan(0));
    await waitFor(() => expect(specs.length).toBeGreaterThan(0));
    expect(specs[specs.length - 1].notes)
      .toEqual(engravedMidi(rendered[rendered.length - 1]));
  });

  /** Cb4 is B3, not B4 — the engraver knows that, the player has to as well. */
  it("agrees with the staff on notes whose letter and pitch octaves part", async () => {
    const specs: PlaybackSpecSnapshot[] = [];
    render(
      <StaffNotation
        notes={["Cb", "E"]}
        octaveQualifiedNotes={["Cb:4", "E:4"]}
        onPlaybackSpecChange={(s) => specs.push(s)}
      />,
    );
    await waitFor(() => expect(rendered.length).toBeGreaterThan(0));
    await waitFor(() => expect(specs.length).toBeGreaterThan(0));
    expect(specs[specs.length - 1].notes)
      .toEqual(engravedMidi(rendered[rendered.length - 1]));
  });

  /**
   * D4 — a declared voicing octave (a tenth) reaches the staff through
   * `octaveQualifiedNotes` and has to reach the audio layer intact.
   */
  it("plays a declared tenth as a tenth", async () => {
    const specs: PlaybackSpecSnapshot[] = [];
    render(
      <StaffNotation
        notes={["C", "E"]}
        octaveQualifiedNotes={["C:4", "E:5"]}
        onPlaybackSpecChange={(s) => specs.push(s)}
      />,
    );
    await waitFor(() => expect(specs.length).toBeGreaterThan(0));
    expect(specs[specs.length - 1].notes).toEqual([60, 76]);
  });
});

/**
 * D3, second half — the grand staff split notes between clefs by pitch class,
 * so a C/G chord's own G (two octaves above the bass) was dragged down beside
 * the bass note on the bass staff. The left hand is the notes the caller
 * declared as left hand, not every note that happens to share their chroma.
 */
describe("a slash chord's clefs follow the hands, not the chroma", () => {
  it("keeps the chord's own octave doubling on the treble staff", async () => {
    const { mei } = await renderCard("C over G", "staff");
    const staves = engravedStaves(mei);
    expect(staves[0]).toBe(2);          // the bass note
    expect([staves[1], staves[2], staves[3]]).toEqual([1, 1, 1]);
  });
});

/**
 * The MIDI file is a third rendering of the same chord, and it was built from
 * the raw note prop with the hands re-split by name — so a slash chord wrote
 * its bass note into both tracks and the right hand at a default octave that
 * had nothing to do with the engraving.
 */
describe("the downloaded MIDI file carries the engraved pitches", () => {
  const captured: ArrayBuffer[] = [];
  const RealBlob = globalThis.Blob;

  beforeEach(() => {
    captured.length = 0;
    // @ts-expect-error - test double for capture
    globalThis.Blob = class extends RealBlob {
      constructor(parts: BlobPart[], options?: BlobPropertyBag) {
        captured.push(parts[0] as ArrayBuffer);
        super(parts, options);
      }
    };
    globalThis.URL.createObjectURL = vi.fn(() => "blob:midi");
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => { globalThis.Blob = RealBlob; });

  for (const chord of ["C", "C over G", "Db7 rootless style"]) {
    it(`writes "${chord}" exactly as engraved`, async () => {
      const { container, mei } = await renderCard(chord, "staff");
      const button = container.querySelector<SVGGElement>('[aria-label="Download MIDI file"]')!;
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(captured.length).toBe(1);
      const engraved = engravedMidi(mei);
      const staves = engravedStaves(mei);
      const lh = engraved.filter((_, i) => staves[i] === 2).map((m) => Note.fromMidi(m));
      const rh = engraved.filter((_, i) => staves[i] !== 2).map((m) => Note.fromMidi(m));
      const expected = generateMidiFile(
        lh.length > 0
          ? { notes: [...lh, ...rh], lhNotes: lh }
          : { notes: rh },
      );
      expect(new Uint8Array(captured[0])).toEqual(expected);
    });
  }
});
