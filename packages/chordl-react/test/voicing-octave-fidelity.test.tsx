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
import { PianoChord, MAX_SPAN_SEMITONES } from "../src/components/PianoChord";
import { ascendingOctaves } from "../src/diatonic-step";

// Capture the MEI the staff builds, without loading the WASM toolkit.
const rendered: string[] = [];
vi.mock("../src/verovio", () => ({
  // The engine is warm in these tests: their renders resolve instantly, so
  // the slow-load path never applies. Stubbed so a future test that does hold
  // a render open does not fail on a missing export rather than on its point.
  isVerovioReady: () => true,
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
    // 64, not 63: the piano experience-levels plan's Task 3 added
    // "power-5-shell" ([0,7]) to VOICING_LIBRARY, a genuinely new entry
    // whose declared placement matches the ascending stack (root+fifth, no
    // octave surprise), so it lands in "everything else" rather than in the
    // `moved` list above.
    expect(VOICING_LIBRARY.length - moved.length).toBe(64);
  });

  // No test for "the other 63 entries draw exactly as the stack drew them":
  // `moved` above is *defined* as the entries where `stacked !== placed`, so
  // asserting `stacked === placed` for everything not in `moved` only restates
  // that definition back — it cannot fail. The "holds for every entry, in
  // every key" test up top (comparing `placed` against `declared`, not
  // `stacked`) is what actually protects the untouched entries.
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
    // PianoChord folds a note down an octave past MAX_SPAN_SEMITONES from the
    // bass. A tenth is 16 and the library's widest entry is 24, so no
    // declared placement is ever folded — the fold guards hand span, not
    // fidelity. Referencing the real constant (instead of a copied literal)
    // means lowering it can't silently start folding declared placements
    // without this test noticing.
    for (const entry of VOICING_LIBRARY) {
      const shape = declared(entry);
      expect(Math.max(...shape) - Math.min(...shape)).toBeLessThanOrEqual(MAX_SPAN_SEMITONES);
    }
  });
});

/**
 * `PianoChord` places notes twice — once for the keyboard, once for the staff
 * — deliberately, over the same spellings, so the two views cannot disagree.
 * Both now prefer the declared octaves, so both had to move together.
 *
 * Db7 (not C7) on purpose: main already drew C7's Rootless Type A voicing
 * consistently between the two views by accident — the letters happen not to
 * wrap for that root — so a C7 fixture only discriminates on the hardcoded
 * expected array, not on the invariant itself. On Db7, main's keyboard drew
 * only 2 note names (F4, Bb4 — B and Eb collapsed onto keys already used by
 * the fold-back-from-letters bug) while its staff engraved all 4. Reverting
 * either M1 or M3 below reintroduces that split.
 */
describe("keyboard and staff place the voicing identically", () => {
  // Db7 in the Rootless Type A voicing: M3, M13, m7, M9 = F4 Bb4 B4 Eb5, a
  // close grip. Read off the letters instead, the B and Eb wrap and the grip
  // becomes F4 Bb4 B5 Eb6 — an octave wider than the entry declares, and two
  // of the four keyboard highlights collide with keys already drawn.
  const CHORD = "Db7 rootless style";

  it("names the same octaves under the keys as it engraves", async () => {
    const { container } = render(<PianoChord chord={`${CHORD} with midi note names`} />);
    const names = [...container.querySelectorAll<HTMLElement>(".bc-note-name")]
      .map((el) => el.textContent);
    expect(names).toEqual(["F4", "Bb4", "B4", "Eb5"]);

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
 * The tests above exercise the pure functions (`voicingOctaveOffsets`,
 * `calculateLayout`) directly. Every one of them still passes against a
 * hybrid build of this branch's `chordl-voicings`/`chordl-core` with *main's*
 * `PianoChord.tsx` — the component never has to be told about the fix for the
 * pure-function tests to go green. These two render the actual component and
 * fail if either wire connecting it to those functions is cut.
 */
describe("PianoChord actually uses the declared octaves it computes", () => {
  it("draws a rotation of a moved voicing at its rotated declared octaves", () => {
    // C7 Rootless Type A ("rootless-dom7-a") is one of the nine entries the
    // declared placement moves (see "nothing else moves" above). Starting it
    // on A rotates the shape so A is lowest; `voicingOffsets` is cleared for
    // rotations (PianoChord.tsx ~538) and the ascending stack takes back over
    // — but only for the *rotated* notes, so the un-rotated pitch classes A,
    // A#, D, E still have to land at A4 A#5 D6 E6, not the plain ascending
    // stack from A4 (A4 A#4 D5 E5) that dropping this reset would produce.
    const { container } = render(
      <PianoChord chord="C7 rootless style starting on A with midi note names" />,
    );
    const names = [...container.querySelectorAll<HTMLElement>(".bc-note-name")]
      .map((el) => el.textContent);
    expect(names).toEqual(["A4", "A#5", "D6", "E6"]);
  });

  it("sizes the keyboard window for a moved voicing's real span", () => {
    // Fed only the pitch classes (as the ascending stack would read them),
    // C7 Rootless Type A looks like a close third-based grip and gets sized
    // for one. Its declared placement is a tenth-plus-ninth spanning almost
    // two octaves, and the keyboard has to be wide enough to hold it without
    // cropping the top note off the right edge.
    const { container } = render(<PianoChord chord="C7 rootless style" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe("11.5 0 219.5 97");
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
