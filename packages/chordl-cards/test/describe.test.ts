// describeShape: the plain-English "how to play" text for a card face. Golden
// strings are the wording the chord site shows and reads aloud, so a change to
// one is a decision, not a fix.
import { describe, expect, it } from "vitest";
import assert from "node:assert/strict";
import { INSTRUMENTS } from "@pepperhorn/chordl-guitar";
import { CHORD_TYPES, ROOTS } from "../src/catalogue";
import { describeShape } from "../src/describe";
import { requestFor, type CardFace, type GuitarFaceRequest } from "../src/faces";
import * as model from "../src/model";
import { playbackFor } from "../src/playback";
import { positionsFor } from "../src/positions";
import { slashChordsForBass } from "../src/slash";
import { tokenizeChordSymbol } from "../src/accidentals";
import { loadTheme } from "./theme-fixture";

const THEME = loadTheme();
const d = (chord: string, face: CardFace) => describeShape(chord, face, { theme: THEME });

const FRETBOARD_READ = [
  "Each vertical line is a string. Each horizontal line is a fret.",
  "The string on the left is the one closest to your face.",
  "The thick line at the top is the nut.",
  "A numbered dot is a finger: 1 is your pointing finger, 2 is your middle finger, 3 is your ring finger and 4 is your little finger.",
  "An O above a string means play it open, with no finger. An X means don't play that string.",
];
const KEYBOARD_READ = [
  "The coloured dots are the keys to press.",
  "The root dot is the same colour as the card.",
];

describe("describeShape: fretted faces", () => {
  it("Am on ukulele: the 2nd finger on the G string, everything else open", () => {
    const out = d("Am", "ukulele");
    expect(out.play).toEqual([
      "Place your 2nd finger on the 2nd fret of the G string (the one closest to you).",
      "All the other strings are open (the O).",
    ]);
    expect(out.read).toEqual(FRETBOARD_READ);
    expect(out.text).toBe([...out.play, ...out.read].join(" "));
    expect(out.spoken).toContain(
      "Place your second finger on the second fret of the G string (the one closest to you). All the other strings are open (the O).",
    );
  });

  it("C on guitar: open strings, a muted low E, fingers in order", () => {
    expect(d("C", "guitar").play).toEqual([
      "Place your 1st finger on the 1st fret of the B string.",
      "Place your 2nd finger on the 2nd fret of the D string.",
      "Place your 3rd finger on the 3rd fret of the A string.",
      "Play the G and high E strings open (the O).",
      "Don't play the low E string (the X).",
    ]);
  });

  it("names the low E as the thickest string when a finger goes on it", () => {
    const out = d("G", "guitar");
    expect(out.play.some((s) => s.endsWith("fret of the low E string (the thickest string, the one closest to you)."))).toBe(true);
  });

  it("F on guitar: a full barre", () => {
    expect(d("F", "guitar").play).toEqual([
      "Lay your 1st finger flat across all 6 strings at fret 1.",
      "Place your 2nd finger on the 2nd fret of the G string.",
      "Place your 3rd finger on the 3rd fret of the A string.",
      "Place your 4th finger on the 3rd fret of the D string.",
    ]);
  });

  it("a barre that stops short names its strings, and the muted one", () => {
    expect(d("Bb", "guitar").play).toEqual([
      "Lay your 1st finger flat across the A, D, G, B and high E strings at fret 1.",
      "Place your 2nd finger on the 3rd fret of the D string.",
      "Place your 3rd finger on the 3rd fret of the G string.",
      "Place your 4th finger on the 3rd fret of the B string.",
      "Don't play the low E string (the X).",
    ]);
  });

  it("a shape above the nut says where it starts, with absolute frets", () => {
    // Bm on guitar is the barre at the 7th fret.
    expect(d("Bm", "guitar").play).toEqual([
      "This shape starts at fret 7 (the number beside the diagram).",
      "Lay your 1st finger flat across all 6 strings at fret 7.",
      "Place your 3rd finger on the 9th fret of the A string.",
      "Place your 4th finger on the 9th fret of the D string.",
    ]);
    expect(d("Bm", "guitar").spoken).toContain("This shape starts at the seventh fret (the number beside the diagram).");
    expect(d("Bm", "guitar").spoken).toContain("at the seventh fret.");
  });

  it("a shape above the nut does not call the top line the nut", () => {
    // svguitar draws the thick nut only when the window starts at fret 1.
    const read = d("Bm", "guitar").read;
    expect(read).not.toContain("The thick line at the top is the nut.");
    expect(read).toContain("The top line is not the nut. The number beside the diagram is the fret it starts at.");
    expect(read.filter((s) => !s.includes("nut"))).toEqual(FRETBOARD_READ.filter((s) => !s.includes("nut")));
  });

  it("the top-3 guitar mutes the three low strings", () => {
    expect(d("C", "guitar-top3").play).toEqual([
      "Place your 1st finger on the 1st fret of the B string.",
      "Play the G and high E strings open (the O).",
      "Don't play the low E, A and D strings (the X).",
    ]);
  });

  it("the bass pattern starts at its fret and mutes the thinnest string", () => {
    expect(d("C", "bass4").play).toEqual([
      "This shape starts at fret 8 (the number beside the diagram).",
      "Place your 1st finger on the 8th fret of the E string (the thickest string, the one closest to you).",
      "Place your 3rd finger on the 10th fret of the A string.",
      "Place your 4th finger on the 10th fret of the D string.",
      "Don't play the G string (the X).",
    ]);
  });

  it("says 'any finger' where the shape has no finger data, and never invents one", () => {
    const alt = positionsFor("C", "guitar", THEME).find((p) => p.id === "x-x-x-5-5-3")!;
    const out = describeShape("C", "guitar", { theme: THEME, request: alt.request });
    expect(out.play).toEqual([
      "Place any finger on the 5th fret of the G string.",
      "Place any finger on the 5th fret of the B string.",
      "Place any finger on the 3rd fret of the high E string (the thinnest string, the one closest to the floor).",
      "Don't play the low E, A and D strings (the X).",
    ]);
    expect(out.text).not.toMatch(/\b[1-4](st|nd|rd|th) finger/);
  });
});

describe("describeShape: keyboard faces", () => {
  it("C major on keyboard: three keys in the right hand, fingers 1-3-5", () => {
    const out = d("C", "keyboard");
    expect(out.play).toEqual([
      "Press these keys with your right hand, from low to high: C, E and G.",
      "Use your thumb (1) on C, your middle finger (3) on E and your little finger (5) on G.",
      "The root is C.",
    ]);
    expect(out.read).toEqual(KEYBOARD_READ);
    expect(out.spoken).toContain("Use your thumb on C, your middle finger on E and your little finger on G.");
  });

  it("C major on keyboard-hands: the left hand has the root, the right hand the rest, no fingers", () => {
    const out = d("C", "keyboard-hands");
    expect(out.play).toEqual([
      "Your left hand plays the root, C.",
      "Your right hand plays the other keys, from low to high: E and G.",
    ]);
    expect(out.read).toEqual([...KEYBOARD_READ, "L.H. means left hand and R.H. means right hand."]);
    expect(out.text).not.toMatch(/thumb|finger/);
  });

  it("Bb: the text keeps the glyph-ready name, the speech says 'B flat'", () => {
    const out = d("Bb", "keyboard");
    expect(out.text).toContain("from low to high: Bb, D and F.");
    expect(out.text).toContain("The root is Bb.");
    expect(out.spoken).toContain("from low to high: B flat, D and F.");
    expect(out.spoken).toContain("The root is B flat.");
    expect(out.spoken).toContain("Use your thumb on B flat, your middle finger on D and your little finger on F.");
    // The glyph-ready name tokenises to a flat, as the card's own title does:
    // once in the key list, the finger line and the root line.
    expect(tokenizeChordSymbol(out.text).filter((t) => t.kind === "flat")).toHaveLength(3);
  });

  it("a seventh chord gives the keys only, with no fingers", () => {
    const out = d("C7", "keyboard");
    expect(out.play[0]).toBe("Press these keys with your right hand, from low to high: C, E, G and Bb.");
    expect(out.text).not.toMatch(/thumb|finger/);
  });

  it("a slash chord's bass goes in the left hand", () => {
    expect(d("D7/C", "keyboard").play).toEqual([
      "Your left hand plays the bass note, C.",
      "Your right hand plays the other keys, from low to high: D, F#, A and C.",
      "The root is D.",
    ]);
  });
});

describe("describeShape: contract", () => {
  it("is deterministic and pure", () => {
    const a = d("Am7", "guitar");
    expect(d("Am7", "guitar")).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it("describes the position the player shows when given its request", () => {
    const alt = positionsFor("G", "ukulele", THEME)[1];
    const out = describeShape("G", "ukulele", { theme: THEME, request: alt.request });
    expect(out.text).not.toBe(d("G", "ukulele").text);
  });

  it("refuses a request from a different face", () => {
    const uke = requestFor("C", "ukulele", THEME);
    expect(() => describeShape("C", "guitar", { theme: THEME, request: uke })).toThrow(/ukulele/);
    expect(() => describeShape("C", "keyboard", { theme: THEME, request: uke })).toThrow(/keyboard/);
  });

  it("throws, as requestFor does, for a chord the face cannot print", () => {
    expect(() => d("Cfoo", "guitar")).toThrow(/unsupported/);
    expect(() => d("C/E", "ukulele")).toThrow(/slash/);
  });

  it("is exported from the model entry", () => {
    expect(model.describeShape).toBe(describeShape);
  });
});

// ── Every face the model can build ───────────────────────────────────────────

const FACES: CardFace[] = ["keyboard", "keyboard-hands", "guitar-top3", "guitar", "ukulele", "bass4"];
const CHORDS = [
  ...ROOTS.flatMap((root) => CHORD_TYPES.map((t) => root + t.symbol)),
  ...ROOTS.flatMap((bass) => slashChordsForBass(bass)).map((c) => c.symbol),
];

function tryRequest(chord: string, face: CardFace) {
  try { return requestFor(chord, face, THEME); } catch { return null; }
}

/** What a face's request says about its strings, via playback: sounding, open, muted. */
function stringFacts(req: GuitarFaceRequest) {
  const { openMidi, strings } = INSTRUMENTS[req.instrument];
  const pb = playbackFor(req);
  const sounding = new Set(pb.strings);
  const open = pb.notes.some((n, k) => n === openMidi[pb.strings![k]]);
  return { open, muted: sounding.size < strings };
}

// Native strict assertions keep the exhaustive text checks cheap.
function checkText(chord: string, face: CardFace, out: ReturnType<typeof d>) {
  const label = `${chord} on ${face}`;
  assert.ok(out.play.length > 0, label);
  assert.ok(out.read.length > 0, label);
  assert.notEqual(out.text.trim(), "", label);
  assert.equal(out.text, [...out.play, ...out.read].join(" "), label);
  // Text is for the screen: ASCII accidentals ("Bb"), no glyphs, no "undefined".
  assert.doesNotMatch(out.text, /[♭♯♮]|undefined|NaN/, label);
  // Speech is for text-to-speech: ordinals and names in words, no symbols.
  assert.doesNotMatch(out.spoken, /[#♭♯♮0-9]|undefined|NaN/, label);
  assert.notEqual(out.spoken.trim(), "", label);
}

describe("describeShape: every face the model can build", () => {
  it("describes each catalogue face, or is omitted exactly where requestFor is", () => {
    let described = 0;
    let omitted = 0;
    for (const chord of CHORDS) {
      for (const face of FACES) {
        const req = tryRequest(chord, face);
        if (!req) {
          expect(() => d(chord, face), `${chord} on ${face}`).toThrow();
          omitted++;
          continue;
        }
        const out = d(chord, face);
        checkText(chord, face, out);
        if (req.kind === "guitar") {
          const facts = stringFacts(req);
          expect(out.text.includes("(the O)"), `${chord} on ${face}: open`).toBe(facts.open);
          expect(out.text.includes("(the X)"), `${chord} on ${face}: muted`).toBe(facts.muted);
          const shape = req.shape as { barres?: unknown[]; position?: number };
          expect(out.play.some((s) => s.startsWith("Lay ")), `${chord} on ${face}: barre`).toBe((shape.barres ?? []).length > 0);
          expect(out.play[0].startsWith("This shape starts at fret "), `${chord} on ${face}: base fret`).toBe((shape.position ?? 1) > 1);
        }
        described++;
      }
    }
    expect(described).toBeGreaterThan(5000);
    expect(omitted).toBeGreaterThan(0);
  }, 120_000);

  it("describes every alternative position the player offers", () => {
    const sweep = ["C", "G", "Am", "Bb", "F#m7", "Ebmaj7", "D7", "E", "Cdim", "Gsus4"];
    let count = 0;
    for (const chord of sweep) {
      for (const face of ["guitar", "guitar-top3", "ukulele", "bass4"] as const) {
        if (!tryRequest(chord, face)) continue;
        for (const p of positionsFor(chord, face, THEME)) {
          const out = describeShape(chord, face, { theme: THEME, request: p.request });
          checkText(chord, face, out);
          const facts = stringFacts(p.request);
          expect(out.text.includes("(the O)"), `${chord} ${p.id}: open`).toBe(facts.open);
          expect(out.text.includes("(the X)"), `${chord} ${p.id}: muted`).toBe(facts.muted);
          count++;
        }
      }
    }
    expect(count).toBeGreaterThan(60);
  }, 60_000);
});
