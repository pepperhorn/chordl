import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { Note } from "tonal";
import {
  VOICING_LIBRARY,
  voicingPitchClasses,
  voicingOctaveOffsets,
  generateVariants,
} from "@pepperhorn/chordl-voicings";
import type { VoicingEntry } from "@pepperhorn/chordl-voicings";
import { calculateLayout, computeKeyboard, normalizeNote } from "@pepperhorn/chordl-core";
import { PianoChord } from "../src/components/PianoChord";
import { ascendingOctaves } from "../src/diatonic-step";

// Capture the MEI the staff builds, without loading the WASM toolkit.
const rendered: string[] = [];
vi.mock("../src/verovio", () => ({
  renderMeiToSvg: (mei: string) => {
    rendered.push(mei);
    return Promise.resolve(`<svg viewBox="0 0 140 120"><g class="staff"></g></svg>`);
  },
}));
beforeEach(() => { rendered.length = 0; });

const ROOTS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

/** Semitones above the voicing's first note, as the entry declares them. */
const declared = (entry: VoicingEntry) =>
  entry.intervals.map((i) => i - entry.intervals[0]);

/** Semitones above the first note, as a renderer given the offsets draws it. */
function placed(root: string, entry: VoicingEntry): number[] {
  const names = voicingPitchClasses(root, entry);
  const offsets = voicingOctaveOffsets(root, entry);
  const midis = names.map((n, i) => Note.midi(`${n}${4 + offsets[i]}`)!);
  return midis.map((m) => m - midis[0]);
}

/**
 * Semitones above the first note under the ascending-stack rule — bump an
 * octave whenever the note's letter fails to rise. It is the only thing bare
 * pitch classes can support, and it is what every view used to do.
 */
function stacked(root: string, entry: VoicingEntry): number[] {
  const names = voicingPitchClasses(root, entry);
  const octaves = ascendingOctaves(names, 4);
  const midis = names.map((n, i) => Note.midi(`${n}${octaves[i]}`)!);
  return midis.map((m) => m - midis[0]);
}

/**
 * A library entry's `intervals` say where each of its notes sits, octave
 * included, and that placement *is* the voicing — it is what makes a Drop 2 a
 * Drop 2 and a "tenth" shell a tenth. The renderer used to reduce an entry to
 * bare pitch classes and rebuild the octaves from the note letters, so the
 * shape it drew was a function of spelling rather than of the declared
 * intervals. Where the two disagreed the diagram showed a different chord from
 * the one the library holds.
 */
describe("a library voicing is drawn where it is declared", () => {
  it("holds for every entry, in every key", () => {
    for (const entry of VOICING_LIBRARY) {
      for (const root of ROOTS) {
        expect({ id: entry.id, root, shape: placed(root, entry) })
          .toEqual({ id: entry.id, root, shape: declared(entry) });
      }
    }
  });

  it("draws a tenth as a tenth, not as the third inside it", () => {
    const byId = (id: string) => VOICING_LIBRARY.find((e) => e.id === id)!;
    // These three are named for the interval that defines them.
    expect(placed("C", byId("shell-maj7-tenth"))).toEqual([0, 16]);
    expect(placed("C", byId("shell-dom7-tenth"))).toEqual([0, 16]);
    expect(placed("C", byId("shell-min7-tenth"))).toEqual([0, 15]);
    // And the shell that really is a third stays one, so the two are not the
    // same picture with a different name.
    expect(placed("C", byId("shell-maj7-r3"))).toEqual([0, 4]);
  });

  it("keeps a close four-note grip inside one hand", () => {
    const alt = VOICING_LIBRARY.find((e) => e.id === "rootless-alt-b")!;
    // Bb Eb E Ab across two octaves is a reach no hand has.
    expect(stacked("D", alt).at(-1)).toBe(22);
    expect(placed("D", alt).at(-1)).toBe(10);
  });
});

/**
 * The blast radius. Honouring the declared octaves can only move an entry
 * whose declared octaves disagreed with the ascending stack; every other entry
 * is drawn exactly where it always was. Pinning the list keeps that promise
 * checkable — a future edit that moves a 69th entry has to say so here.
 */
describe("nothing else moves", () => {
  const moved = VOICING_LIBRARY.filter((entry) =>
    ROOTS.some((root) => stacked(root, entry).join() !== placed(root, entry).join()),
  ).map((e) => e.id);

  it("moves nine entries and no others", () => {
    expect([...moved].sort()).toEqual([
      "4close-dom7",
      "rootless-alt-b",
      "rootless-dom7-a",
      "rootless-m7b5-b",
      "rootless-min7-b",
      "shell-dom7-tenth",
      "shell-maj7-tenth",
      "shell-min7-tenth",
      "spread-madd9",
    ]);
    expect(VOICING_LIBRARY.length - moved.length).toBe(63);
  });

  it("leaves the other entries drawn exactly as the stack drew them", () => {
    for (const entry of VOICING_LIBRARY) {
      if (moved.includes(entry.id)) continue;
      for (const root of ROOTS) {
        expect({ id: entry.id, root, shape: stacked(root, entry) })
          .toEqual({ id: entry.id, root, shape: placed(root, entry) });
      }
    }
  });
});

/**
 * A wider voicing needs a wider window. The keyboard is sized by
 * `calculateLayout` from the same octaves the highlights use, so a declared
 * tenth gets two octaves of keys to sit on rather than being sized for a third
 * and cropped off the right-hand edge.
 */
describe("every declared note lands on a drawn key", () => {
  it("holds for every entry, in every key", () => {
    for (const entry of VOICING_LIBRARY) {
      for (const root of ROOTS) {
        const notes = voicingPitchClasses(root, entry);
        const offsets = voicingOctaveOffsets(root, entry);
        const keyboardNotes = notes.map(normalizeNote);
        const layout = calculateLayout(keyboardNotes, { padding: 1, octaveOffsets: offsets });
        const keys = computeKeyboard(layout.startFrom, layout.size, "compact");
        const base = Math.max(layout.chordOctave, 0);

        for (let i = 0; i < keyboardNotes.length; i++) {
          const wanted = `${keyboardNotes[i]}:${base + offsets[i]}`;
          const hit = keys.some((k) => `${normalizeNote(k.note)}:${k.octave}` === wanted);
          expect({ id: entry.id, root, wanted, hit }).toEqual({ id: entry.id, root, wanted, hit: true });
        }
      }
    }
  });

  it("stays inside the span that would trigger the compaction fold", () => {
    // PianoChord folds a note down an octave past 28 semitones from the bass.
    // A tenth is 16 and the library's widest entry is 24, so no declared
    // placement is ever folded — the fold guards hand span, not fidelity.
    for (const entry of VOICING_LIBRARY) {
      const shape = declared(entry);
      expect(Math.max(...shape) - Math.min(...shape)).toBeLessThanOrEqual(28);
    }
  });
});

/**
 * `PianoChord` places notes twice — once for the keyboard, once for the staff
 * — deliberately, over the same spellings, so the two views cannot disagree.
 * Both now prefer the declared octaves, so both had to move together.
 */
describe("keyboard and staff place the voicing identically", () => {
  // C7 in the Rootless Type A voicing: M3, M13, m7, M9 = E4 A4 Bb4 D5, a
  // close grip. Read off the letters instead, the Bb and D wrap and the grip
  // becomes E4 A4 Bb5 D6 — an octave wider than the entry declares.
  const CHORD = "C7 rootless style";

  it("names the same octaves under the keys as it engraves", async () => {
    const { container } = render(<PianoChord chord={`${CHORD} with midi note names`} />);
    const names = [...container.querySelectorAll<HTMLElement>(".bc-note-name")]
      .map((el) => el.textContent);
    expect(names).toEqual(["E4", "A4", "A#4", "D5"]);

    render(<PianoChord chord={CHORD} display="staff" />);
    await waitFor(() => expect(rendered.length).toBeGreaterThan(0));
    const mei = rendered[rendered.length - 1];
    const staff = [...mei.matchAll(/<note[^>]*\/?>/g)].map((m) => {
      const tag = m[0];
      const pname = /pname="([a-g])"/.exec(tag)![1].toUpperCase();
      const accid = /accid(?:\.ges)?="([a-z]+)"/.exec(tag)?.[1];
      const oct = /oct="(\d)"/.exec(tag)![1];
      return `${pname}${accid === "s" ? "#" : accid === "f" ? "b" : ""}${oct}`;
    });
    expect(staff).toEqual(names);
  });

  it("sounds the notes the entry declares", async () => {
    render(<PianoChord chord={CHORD} display="staff" />);
    await waitFor(() => expect(rendered.length).toBeGreaterThan(0));
    const midis = [...rendered[rendered.length - 1].matchAll(/<note[^>]*\/?>/g)].map((m) => {
      const tag = m[0];
      const pname = /pname="([a-g])"/.exec(tag)![1].toUpperCase();
      const accid = /accid(?:\.ges)?="([a-z]+)"/.exec(tag)?.[1];
      const oct = /oct="(\d)"/.exec(tag)![1];
      return Note.midi(`${pname}${accid === "s" ? "#" : accid === "f" ? "b" : ""}${oct}`)!;
    });
    const entry = VOICING_LIBRARY.find((e) => e.id === "rootless-dom7-a")!;
    expect(midis.map((m) => m - midis[0])).toEqual(declared(entry));
  });
});

/**
 * The other two variant sources have no octave information to preserve —
 * their ordered pitch classes *are* the voicing — so they keep the ascending
 * stack, and nothing about them changes.
 */
describe("inversions and algorithmic variants keep the ascending stack", () => {
  it("declares octaves only for library variants", () => {
    const variants = generateVariants("C", "maj7", ["C", "E", "G", "B"], 30);
    expect(variants.length).toBeGreaterThan(3);
    for (const v of variants) {
      if (v.source === "library") expect(v.octaveOffsets).toHaveLength(v.notes.length);
      else expect(v.octaveOffsets).toBeUndefined();
    }
  });

  it("draws an inversion where it always drew it", () => {
    const { container } = render(<PianoChord chord="Cmaj7 starting on E with midi note names" />);
    const names = [...container.querySelectorAll<HTMLElement>(".bc-note-name")]
      .map((el) => el.textContent);
    expect(names).toEqual(["E4", "G4", "B4", "C5"]);
  });
});
