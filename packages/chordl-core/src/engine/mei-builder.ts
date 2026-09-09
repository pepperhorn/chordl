/**
 * MEI builder — turns a chordl note list into an MEI document that Verovio
 * engraves. This keeps pitch/octave/clef decisions in the core (theory) layer,
 * mirroring the semantics the legacy hand-rolled `computeStaffLayout` used so
 * the switch to Verovio doesn't change which clef a chord lands on.
 *
 * A single whole-note "measure" is produced: RH notes stack into one chord on
 * the treble staff, LH notes into a chord on the bass staff. When notes aren't
 * explicitly split, a treble/bass-predominance test picks a single staff.
 *
 * Unlike the keyboard (which needs sharp positions), MEI spells notes as given
 * — a "Bb" chord engraves with flats, "C#" with sharps — so the notation matches
 * the chord's own spelling instead of forcing everything to sharps.
 */

export interface MeiBuildOptions {
  lhNotes?: string[];
  rhOctave?: number;
  lhOctave?: number;
  /** Pre-resolved octave-qualified notes ("C:4", "G#:5") — bypasses
   *  internal octave assignment for exact pitch matching. */
  octaveQualifiedNotes?: string[];
}

export interface MeiBuildResult {
  mei: string;
  staffMode: "treble" | "bass" | "grand";
  /**
   * The pitches the MEI actually carries, in playback-index order, spelled
   * with an absolute octave ("C4", "Bb3", "Cb4").
   *
   * This is the single resolution of the chord. Every other view of it — the
   * play button, the MIDI names under the keys, the exported MIDI file — reads
   * this rather than re-deriving octaves from bare pitch classes with a rule
   * of its own, which is what let the staff and the speaker disagree.
   */
  playbackNotes: string[];
}

const DIATONIC_INDEX: Record<string, number> = {
  C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6,
};

const CHROMATIC_BASE: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

interface PitchedNote {
  letter: string; // "C".."B"
  accid: "s" | "f" | null;
  octave: number;
  playbackIndex: number;
}

function toPitched(note: string, octave: number, playbackIndex = 0): PitchedNote {
  const letter = note.charAt(0).toUpperCase();
  const accid = note.includes("#") ? "s" : note.slice(1).includes("b") ? "f" : null;
  return { letter, accid, octave, playbackIndex };
}

/** "C4", "Bb3", "Cb4" — the spelling the staff engraves, with its octave. */
function pitchName(n: PitchedNote): string {
  return `${n.letter}${n.accid === "s" ? "#" : n.accid === "f" ? "b" : ""}${n.octave}`;
}

function noteToMidi(n: PitchedNote): number {
  const base = CHROMATIC_BASE[n.letter] ?? 0;
  const acc = n.accid === "s" ? 1 : n.accid === "f" ? -1 : 0;
  return (n.octave + 1) * 12 + base + acc;
}

/** Ascending octave assignment: a note that doesn't rise diatonically bumps up. */
function assignOctaves(notes: string[], baseOctave: number, indexOffset = 0): PitchedNote[] {
  const result: PitchedNote[] = [];
  let octave = baseOctave;
  let prevDiatonic = -1;
  for (const note of notes) {
    const letter = note.charAt(0).toUpperCase();
    const diatonic = DIATONIC_INDEX[letter] ?? 0;
    if (prevDiatonic >= 0 && diatonic <= prevDiatonic) octave++;
    prevDiatonic = diatonic;
    result.push(toPitched(note, octave, indexOffset + result.length));
  }
  return result;
}

function parseOctaveQualified(notes: string[]): PitchedNote[] {
  return notes.map((n, playbackIndex) => {
    const [pc, oct] = n.split(":");
    return toPitched(pc, parseInt(oct, 10), playbackIndex);
  });
}

function noteXml(n: PitchedNote): string {
  const accid = n.accid ? ` accid="${n.accid}"` : "";
  return `<note xml:id="chordl-playback-note-${n.playbackIndex}" pname="${n.letter.toLowerCase()}" oct="${n.octave}"${accid}/>`;
}

/** Wrap one staff's notes as a chord / single note / whole rest. */
function layerXml(notes: PitchedNote[]): string {
  if (notes.length === 0) return `<layer n="1"><mRest/></layer>`;
  if (notes.length === 1) {
    const n = notes[0];
    const accid = n.accid ? ` accid="${n.accid}"` : "";
    return `<layer n="1"><note xml:id="chordl-playback-note-${n.playbackIndex}" dur="1" pname="${n.letter.toLowerCase()}" oct="${n.octave}"${accid}/></layer>`;
  }
  return `<layer n="1"><chord dur="1">${notes.map(noteXml).join("")}</chord></layer>`;
}

export function buildMei(notes: string[], options: MeiBuildOptions = {}): MeiBuildResult {
  const { lhNotes, rhOctave = 4, lhOctave = 3, octaveQualifiedNotes } = options;
  const hasExplicitSplit = Boolean(lhNotes && lhNotes.length > 0);
  const lhCount = lhNotes?.length ?? 0;

  let all: PitchedNote[];
  let lhResolved: PitchedNote[];
  let rhResolved: PitchedNote[];

  if (octaveQualifiedNotes) {
    all = parseOctaveQualified(octaveQualifiedNotes);
    // The octave-qualified list carries LH+RH together, LH first, so the hands
    // split by position. Splitting by pitch class instead put every note that
    // merely *shared a chroma* with a left-hand note onto the bass staff: a
    // C/G chord's own G, two octaves above the bass, was engraved down beside
    // the bass note it was doubling.
    lhResolved = all.slice(0, lhCount);
    rhResolved = all.slice(lhCount);
  } else {
    const rhInput = lhNotes ? notes.filter((n) => !lhNotes.includes(n)) : notes;
    lhResolved = assignOctaves(lhNotes ?? [], lhOctave);
    rhResolved = assignOctaves(rhInput, rhOctave, lhResolved.length);
    all = [...lhResolved, ...rhResolved];
  }

  // Clef mode: explicit split → grand; otherwise treble/bass predominance
  // around A3 (MIDI 57), matching the legacy layout engine.
  const midpoint = 57;
  const trebleCount = all.filter((n) => noteToMidi(n) > midpoint).length;
  const bassCount = all.filter((n) => noteToMidi(n) <= midpoint).length;

  let staffMode: "treble" | "bass" | "grand";
  if (hasExplicitSplit) staffMode = "grand";
  else if (trebleCount > 0 && bassCount > 0) staffMode = trebleCount >= bassCount ? "treble" : "bass";
  else if (trebleCount > 0) staffMode = "treble";
  else staffMode = "bass";

  let scoreDef: string;
  let staves: string;

  if (staffMode === "grand") {
    scoreDef =
      `<scoreDef><staffGrp symbol="brace" bar.thru="true">` +
      `<staffDef n="1" lines="5" clef.shape="G" clef.line="2"/>` +
      `<staffDef n="2" lines="5" clef.shape="F" clef.line="4"/>` +
      `</staffGrp></scoreDef>`;
    // Grand staff is only chosen for an explicit LH/RH split, so RH → treble,
    // LH → bass.
    staves =
      `<staff n="1">${layerXml(rhResolved)}</staff>` +
      `<staff n="2">${layerXml(lhResolved)}</staff>`;
  } else {
    const clef = staffMode === "treble"
      ? `clef.shape="G" clef.line="2"`
      : `clef.shape="F" clef.line="4"`;
    scoreDef =
      `<scoreDef><staffGrp><staffDef n="1" lines="5" ${clef}/></staffGrp></scoreDef>`;
    staves = `<staff n="1">${layerXml(all)}</staff>`;
  }

  const mei =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">` +
    `<music><body><mdiv><score>` +
    scoreDef +
    `<section><measure n="1" right="invis">${staves}</measure></section>` +
    `</score></mdiv></body></music></mei>`;

  const playbackNotes = [...all]
    .sort((a, b) => a.playbackIndex - b.playbackIndex)
    .map(pitchName);

  return { mei, staffMode, playbackNotes };
}
