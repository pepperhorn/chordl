import { Note } from "tonal";
import type { ChordProps, KeyboardProps, HandBracket, WhiteNote, DisplayMode } from "../types";
import { PianoKeyboard } from "./PianoKeyboard";
import { StaffNotation } from "./StaffNotation";
import {
  parseChordDescription, resolveChord, resolveScale, calculateLayout, whiteIdxHasSharp,
  computeKeyboard, normalizeNote, autoFingering, assignFingering,
  scaleAutoFingering, degreesForIntervals,
  FLAT_TO_SHARP, WHITE_NOTE_ORDER,
} from "@better-chord/core";
import type { ProgressionChord } from "@better-chord/core";
import { findVoicing, voicingPitchClasses, mapToVoicingQuality, realizeVoicingFull } from "@better-chord/voicings";
import type { Hand as VoicingHand } from "@better-chord/voicings";
import { ChordGroup } from "./ChordGroup";
import { resolveUITheme, UIThemeProvider } from "../ui-theme";

/**
 * Map semitones (mod 12) from root to a scale degree number.
 * Handles both major and minor variants of each degree.
 * Note: does not distinguish quality (e.g. b9 vs M9 both map to degree 2).
 * This means degree-based lookups may match the wrong quality in altered chords.
 */
function semitonesToDegree(semitones: number): number {
  const s = ((semitones % 12) + 12) % 12;
  if (s === 0) return 1;
  if (s <= 2) return 2;   // m2=1, M2=2 (also 9th)
  if (s <= 4) return 3;   // m3=3, M3=4
  if (s === 5) return 4;  // P4=5 (also 11th)
  if (s <= 7) return 5;   // d5=6, P5=7
  if (s <= 9) return 6;   // m6=8, M6=9 (also 13th)
  return 7;               // m7=10, M7=11
}

const DEGREE_NAMES: Record<number, string> = {
  1: "root", 2: "2nd", 3: "3rd", 4: "4th", 5: "5th", 6: "6th", 7: "7th",
  9: "9th", 11: "11th", 13: "13th",
};

/**
 * Find the chord tone matching a musical degree, regardless of quality.
 * e.g. degree 3 finds Eb in Cm7 and E in Cmaj7.
 */
function degreeToNote(root: string, degree: number, notes: string[]): string | undefined {
  const rootMidi = Note.midi(`${root}4`);
  if (rootMidi == null) return undefined;

  // Normalize compound degrees: 9→2, 11→4, 13→6
  const simpleDegree = degree > 7 ? degree - 7 : degree;

  for (const note of notes) {
    const noteMidi = Note.midi(`${note}4`);
    if (noteMidi == null) continue;
    const semitones = ((noteMidi - rootMidi) % 12 + 12) % 12;
    if (semitonesToDegree(semitones) === simpleDegree) return note;
  }

  return undefined;
}

/** Format the available degrees for error messages */
function describeAvailableDegrees(root: string, notes: string[]): string {
  const rootMidi = Note.midi(`${root}4`);
  if (rootMidi == null) return notes.join(", ");

  const degrees: string[] = [];
  for (const note of notes) {
    const noteMidi = Note.midi(`${note}4`);
    if (noteMidi == null) continue;
    const semitones = ((noteMidi - rootMidi) % 12 + 12) % 12;
    const deg = semitonesToDegree(semitones);
    const name = DEGREE_NAMES[deg] ?? `${deg}th`;
    degrees.push(`${name} (${note})`);
  }
  return degrees.join(", ");
}

function isChordProps(props: ChordProps | KeyboardProps): props is ChordProps {
  return "chord" in props;
}

export function PianoChord(props: ChordProps | KeyboardProps) {
  if (!isChordProps(props)) {
    return <PianoKeyboard {...props} />;
  }

  const { chord, format, theme, highlightColor, padding, scale, display = "keyboard", uiTheme, className, style } =
    props;
  const uiCtx = resolveUITheme(uiTheme);

  const parsed = parseChordDescription(chord);

  // ── Scale path ─────────────────────────────────────────────────
  if (parsed.isScale && parsed.scaleName) {
    const [scaleRoot, ...scaleTypeParts] = parsed.scaleName.split(" ");
    const scaleType = scaleTypeParts.join(" ");
    const scaleResolved = resolveScale(scaleRoot, scaleType, parsed.scaleDirection, parsed.scaleOctaves);
    const scaleKeyboardNotes = scaleResolved.notes.map(normalizeNote);
    const layoutPadding = parsed.padding ?? padding ?? 1;
    const resolvedFormat = parsed.format ?? format;

    // Compute real MIDI numbers using Tonal for each ascending scale note.
    // Scale starts from root octave (default: lowest octave where root >= A3).
    const rootMidiAt3 = Note.midi(`${scaleKeyboardNotes[0]}3`) ?? 48;
    const startOctave = rootMidiAt3 >= 57 ? 3 : 4; // A3=57; start at 3 if root is A-B, else 4

    let octave = startOctave;
    let prevMidi = -1;
    const scaleMidis = scaleKeyboardNotes.map((n) => {
      const midi = Note.midi(`${n}${octave}`);
      if (midi == null) return 60; // fallback
      // If this note would be at or below the previous, bump octave
      if (prevMidi >= 0 && midi <= prevMidi) {
        octave++;
        const higher = Note.midi(`${n}${octave}`) ?? midi + 12;
        prevMidi = higher;
        return higher;
      }
      prevMidi = midi;
      return midi;
    });

    // Keyboard range: pad around the MIDI range
    const minMidi = scaleMidis[0];
    const maxMidi = scaleMidis[scaleMidis.length - 1];

    // Convert MIDI to note name + octave using Tonal
    const padSemitones = layoutPadding * 2;
    const startNoteName = Note.fromMidi(minMidi - padSemitones);
    const endNoteName = Note.fromMidi(maxMidi + padSemitones);
    const startPc = Note.pitchClass(startNoteName).replace(/[#b]/, "") as WhiteNote;
    const endPc = Note.pitchClass(endNoteName).replace(/[#b]/, "") as WhiteNote;
    const startOctaveReal = Note.octave(startNoteName) ?? startOctave;
    const endOctaveReal = Note.octave(endNoteName) ?? startOctave + 1;

    // Count white keys
    const startWhiteIdx = WHITE_NOTE_ORDER.indexOf(startPc);
    const endWhiteIdx = WHITE_NOTE_ORDER.indexOf(endPc);
    const octaveSpan = endOctaveReal - startOctaveReal;
    const whiteKeyCount = octaveSpan * 7 + (endWhiteIdx - startWhiteIdx) + 1;
    const kbSize = Math.max(whiteKeyCount, 8);

    // Build highlight keys using keyboard-relative octaves.
    // Keyboard starts at startOctaveReal and its relativeOctave 0 corresponds to that.
    const scaleHighlightKeys = scaleMidis.map((midi, i) => {
      const noteOctave = Note.octave(Note.fromMidi(midi)) ?? startOctave;
      const relOctave = noteOctave - startOctaveReal;
      return `${scaleKeyboardNotes[i]}:${relOctave}`;
    });

    // midiBaseOctave: keyboard's relative octave 0 = startOctaveReal
    const midiBase = startOctaveReal;

    // Degree labels: repeat interval pattern across octaves
    const singleOctaveDegrees = degreesForIntervals(scaleResolved.intervals);
    const degreeLabels = scaleResolved.notes.map((_, i) => {
      return singleOctaveDegrees[i % singleOctaveDegrees.length];
    });

    // Scale fingering: auto-compute if "with fingering" is in the prompt
    const scaleFingering = parsed.autoFingering
      ? scaleAutoFingering(scaleRoot, scaleType, "rh", parsed.scaleOctaves ?? 1)
      : undefined;

    return (
      <UIThemeProvider value={uiCtx}>
        <PianoKeyboard
          format={resolvedFormat}
          size={kbSize}
          startFrom={startPc}
          highlightKeys={scaleHighlightKeys}
          displayNoteNames={scaleResolved.notes}
          theme={theme}
          highlightColor={highlightColor}
          chordLabel={parsed.scaleName}
          showHeading={parsed.showHeading}
          scale={scale}
          showNoteNames={parsed.showNoteNames}
          noteNameSize={parsed.noteNameSize}
          noteNameMode={parsed.noteNameMode}
          midiBaseOctave={midiBase}
          degreeLabels={degreeLabels}
          fingering={scaleFingering && scaleFingering.length > 0 ? scaleFingering : undefined}
          fingeringSize={parsed.fingeringSize}
          className={className}
          style={style}
        />
      </UIThemeProvider>
    );
  }

  if (!parsed.chordName) {
    throw new Error(`Couldn't find a chord name in "${chord}"`);
  }
  const resolved = resolveChord(parsed.chordName, parsed.inversion);

  // All inversions: render a ChordGroup with root position + each inversion
  if (parsed.allInversions) {
    const numNotes = resolved.notes.length;
    const INVERSION_LABELS = ["Root position", "1st inversion", "2nd inversion", "3rd inversion", "4th inversion"];
    const chords: ProgressionChord[] = [];
    for (let inv = 0; inv < numNotes; inv++) {
      const invNotes = [...resolved.notes.slice(inv), ...resolved.notes.slice(0, inv)];
      chords.push({
        symbol: INVERSION_LABELS[inv] ?? `${inv}th inversion`,
        root: resolved.root,
        notes: invNotes,
      });
    }
    const resolvedFormat = parsed.format ?? format;
    return (
      <UIThemeProvider value={uiCtx}>
        <ChordGroup
          chords={chords}
          label={parsed.chordName}
          format={resolvedFormat}
          theme={theme}
          highlightColor={highlightColor}
          showPlayback
          scale={scale}
        />
      </UIThemeProvider>
    );
  }

  let { notes } = resolved;
  let voicingHandHints: VoicingHand[] | undefined;

  // If a style hint is present, try the voicing library for richer voicings
  if (parsed.styleHint) {
    const quality = mapToVoicingQuality(resolved.type, resolved.notes);
    if (quality) {
      const voicing = findVoicing(quality, parsed.styleHint);
      if (voicing) {
        const pitchClasses = voicingPitchClasses(resolved.root, voicing);
        if (pitchClasses.length > 0) {
          notes = pitchClasses;
          voicingHandHints = voicing.hands;
        }
      }
    }
  }

  // Resolve bass note for "over X" / "with X in the bass" → separate LH keyboard
  let lhBassNote: string | undefined;
  if (parsed.bassDegree != null) {
    const available = describeAvailableDegrees(resolved.root, notes);
    const bassNote = degreeToNote(resolved.root, parsed.bassDegree, notes);
    if (!bassNote) {
      const name = DEGREE_NAMES[parsed.bassDegree] ?? `${parsed.bassDegree}th`;
      throw new Error(
        `${parsed.chordName} doesn't have a ${name} — try: ${available}`
      );
    }
    lhBassNote = bassNote;
  } else if (parsed.bassNote) {
    lhBassNote = FLAT_TO_SHARP[parsed.bassNote] ?? parsed.bassNote;
  }

  // Resolve startingDegree/startingNote: rotate voicing so that note is lowest
  let startingNote = parsed.startingNote;
  if (!startingNote && parsed.startingDegree != null) {
    const available = describeAvailableDegrees(resolved.root, notes);
    startingNote = degreeToNote(resolved.root, parsed.startingDegree, notes);
    if (!startingNote) {
      const name = DEGREE_NAMES[parsed.startingDegree] ?? `${parsed.startingDegree}th`;
      throw new Error(
        `${parsed.chordName} doesn't have a ${name} — try: ${available}`
      );
    }
  }
  if (startingNote) {
    const norm = FLAT_TO_SHARP[startingNote] ?? startingNote;
    const idx = notes.indexOf(norm);
    if (idx < 0) {
      const available = describeAvailableDegrees(resolved.root, notes);
      throw new Error(
        `${startingNote} isn't in ${parsed.chordName} — the notes are: ${available}`
      );
    }
    if (idx > 0) {
      notes = [...notes.slice(idx), ...notes.slice(0, idx)];
    }
  }

  // Multi-octave arpeggio: repeat chord tones across octaves
  if (parsed.chordOctaves && parsed.chordOctaves > 1) {
    const oneOctave = [...notes];
    const expanded: string[] = [];
    for (let oct = 0; oct < parsed.chordOctaves; oct++) {
      expanded.push(...oneOctave);
    }
    expanded.push(oneOctave[0]); // final tonic
    notes = expanded;
  }

  // Compute degree labels for chords (jazz roman numerals)
  const chordDegreeLabels: string[] | undefined = (() => {
    if (parsed.noteNameMode !== "degree" && parsed.noteNameMode !== "pitch-class+degree") return undefined;
    const intervals = resolved.intervals;
    if (!intervals || intervals.length === 0) return undefined;
    const singleDegrees = degreesForIntervals(intervals);
    // For arpeggios, repeat the degree pattern
    return notes.map((_, i) => singleDegrees[i % singleDegrees.length]);
  })();

  const layoutPadding = parsed.padding ?? padding ?? 1;
  const resolvedFormat = parsed.format ?? format;

  // Fingering and hand assignment are computed after layout/octave resolution
  // so MIDI values are available for accurate hand splitting (see below).

  // Staff notation helper — accepts octave-qualified notes for exact pitch matching
  const renderStaff = (
    resolvedNotes: string[],
    opts?: { bassNote?: string; octaveQualifiedNotes?: string[] },
  ) => {
    const staffNotes = opts?.bassNote ? [opts.bassNote, ...resolvedNotes] : resolvedNotes;
    const lhPlaybackOctave = 3 + (parsed.bassOctaveShift ?? 0);
    // When no bass note, default to octave 2 so chords sit within bass clef
    const rhPlaybackOctave = 4 + (parsed.chordOctaveShift ?? 0);
    return (
      <StaffNotation
        notes={staffNotes}
        lhNotes={opts?.bassNote ? [opts.bassNote] : undefined}
        rhOctave={rhPlaybackOctave}
        lhOctave={lhPlaybackOctave}
        octaveQualifiedNotes={opts?.octaveQualifiedNotes}
        chordLabel={parsed.chordName}
        scale={scale}
        showPlayback
        className={className}
        style={style}
      />
    );
  };

  // Helper: compute octave-qualified notes from pitch classes and a base octave.
  // After initial ascending assignment, folds notes down to keep the voicing
  // within a playable hand span (max ~19 semitones = octave + fifth).
  const MAX_SPAN_SEMITONES = 28;

  const computeOctaveQualified = (pitchClasses: string[], baseOctave: number): string[] => {
    let octave = baseOctave;
    const firstNorm = normalizeNote(pitchClasses[0]);
    const firstWhiteIdx = WHITE_NOTE_ORDER.indexOf(
      firstNorm.replace("#", "") as WhiteNote,
    );
    let prevWhiteIdx = firstWhiteIdx;

    // Step 1: naive ascending octave assignment
    const assigned = pitchClasses.map((n, i) => {
      const norm = normalizeNote(n);
      const whiteKey = norm.replace("#", "") as WhiteNote;
      const whiteIdx = WHITE_NOTE_ORDER.indexOf(whiteKey);
      if (i > 0 && whiteIdx <= prevWhiteIdx) {
        octave++;
      }
      prevWhiteIdx = whiteIdx;
      return { norm, octave };
    });

    // Step 2: compact — fold notes down an octave if span exceeds playable range
    const baseMidi = Note.midi(`${assigned[0].norm}${assigned[0].octave}`);
    if (baseMidi != null) {
      for (let i = 1; i < assigned.length; i++) {
        const midi = Note.midi(`${assigned[i].norm}${assigned[i].octave}`);
        if (midi != null && midi - baseMidi > MAX_SPAN_SEMITONES && assigned[i].octave > assigned[0].octave) {
          assigned[i].octave--;
        }
      }
    }

    return assigned.map((a) => `${a.norm}:${a.octave}`);
  };

  // Single continuous keyboard with LH + RH brackets
  if (lhBassNote) {
    const lhNorm = normalizeNote(lhBassNote);
    const lhWhiteKey = lhNorm.replace("#", "") as WhiteNote;
    const lhWhiteIdx = WHITE_NOTE_ORDER.indexOf(lhWhiteKey);

    // RH note positions relative to LH
    // Default: one full octave above LH. Shifts adjust this.
    // "chord down" reduces gap, "bass up" also reduces gap (from the other side)
    const octaveGap = 1 + (parsed.chordOctaveShift ?? 0) - (parsed.bassOctaveShift ?? 0);
    // 7 white keys = 1 octave; clamp to 0 so negative gaps don't produce negative offsets
    const rhOctaveOffset = Math.max(octaveGap, 0) * 7;
    const rhOffsets = notes.map((n) => {
      const norm = normalizeNote(n);
      const whiteKey = norm.replace("#", "") as WhiteNote;
      const whiteIdx = WHITE_NOTE_ORDER.indexOf(whiteKey);
      let offset = whiteIdx - lhWhiteIdx;
      if (offset <= 0) offset += 7; // wrap within octave
      return offset + rhOctaveOffset;
    });
    const maxRhOffset = Math.max(...rhOffsets);

    // Keyboard start: padding steps below LH note (positive-mod wrap to 0-6 range)
    let startIdx = ((lhWhiteIdx - layoutPadding) % 7 + 7) % 7;
    // Black-key context: extend left edge if it has a sharp (needs neighbor for orientation)
    let lhClipLeft = false;
    if (whiteIdxHasSharp(startIdx)) { startIdx = ((startIdx - 1) % 7 + 7) % 7; lhClipLeft = true; }
    const startNote = WHITE_NOTE_ORDER[startIdx] as WhiteNote;
    const lhPositionOnKb = ((lhWhiteIdx - startIdx) % 7 + 7) % 7;
    let kbSize = Math.max(lhPositionOnKb + maxRhOffset + layoutPadding + 1, 10);
    // Black-key context: extend right edge if it has a sharp
    let lhClipRight = false;
    const endIdx = startIdx + kbSize - 1;
    if (whiteIdxHasSharp(endIdx)) { kbSize += 1; lhClipRight = true; }

    // Compute the keyboard to get octave info for each key
    const tempKeys = computeKeyboard(startNote, kbSize, resolvedFormat);

    // Find the LH key index and its relative octave
    const lhKeyIdx = tempKeys.findIndex((k) => normalizeNote(k.note) === lhNorm);
    const lhOctave = lhKeyIdx >= 0 ? tempKeys[lhKeyIdx].octave : 0;
    // RH octave relative to LH, adjusted by chordOctaveShift
    const rhBaseOctave = lhOctave + Math.max(octaveGap, 0);

    const lhHighlights = [`${lhNorm}:${lhOctave}`];
    const rhHighlights = notes.map((n) => {
      const norm = normalizeNote(n);
      const whiteKey = norm.replace("#", "") as WhiteNote;
      const whiteIdx = WHITE_NOTE_ORDER.indexOf(whiteKey);
      // Notes above LH in pitch class order (before the next C) are in rhBaseOctave;
      // notes at or below LH (wrapped past C) are in rhBaseOctave + 1
      const isAboveLhBeforeC = whiteIdx > lhWhiteIdx;
      const noteOctave = isAboveLhBeforeC ? rhBaseOctave : rhBaseOctave + 1;
      return `${norm}:${noteOctave}`;
    });
    const allHighlights = [...lhHighlights, ...rhHighlights];

    // Real-octave-qualified notes for staff notation
    // Keyboard octaves are relative (0, 1, 2); staff needs real MIDI octaves
    const realLhOctave = 3 + (parsed.bassOctaveShift ?? 0);
    const realRhBaseOctave = realLhOctave + Math.max(octaveGap, 0);
    const staffOctaveNotesBass = [
      `${lhNorm}:${realLhOctave}`,
      ...notes.map((n) => {
        const norm = normalizeNote(n);
        const whiteKey = norm.replace("#", "") as WhiteNote;
        const whiteIdx = WHITE_NOTE_ORDER.indexOf(whiteKey);
        const isAboveLhBeforeC = whiteIdx > lhWhiteIdx;
        const noteOctave = isAboveLhBeforeC ? realRhBaseOctave : realRhBaseOctave + 1;
        return `${norm}:${noteOctave}`;
      }),
    ];

    // Find key indices for bracket annotations
    const lhKeyIndices: number[] = [];
    const rhKeyIndices: number[] = [];
    const remaining = allHighlights.map((h, i) => {
      const [note, oct] = h.split(":");
      return { note, octave: parseInt(oct, 10), isLH: i < lhHighlights.length, matched: false };
    });

    for (let ki = 0; ki < tempKeys.length; ki++) {
      const keyNote = normalizeNote(tempKeys[ki].note);
      const keyOctave = tempKeys[ki].octave;
      const matchIdx = remaining.findIndex(
        (h) => !h.matched && h.note === keyNote && h.octave === keyOctave
      );
      if (matchIdx !== -1) {
        remaining[matchIdx].matched = true;
        (remaining[matchIdx].isLH ? lhKeyIndices : rhKeyIndices).push(ki);
      }
    }

    const handBrackets: HandBracket[] = [
      { label: "L.H.", keyIndices: lhKeyIndices },
      { label: "R.H.", keyIndices: rhKeyIndices },
    ];

    // Playback octaves: LH default 2, RH default 3 (so root ≈ C4 middle C)
    const lhPlaybackOctave = 2 + (parsed.bassOctaveShift ?? 0);
    const rhPlaybackOctave = 3 + (parsed.chordOctaveShift ?? 0);

    // Fingering for bass-note path: LH gets bass, RH gets chord
    const lhBassFinger = autoFingering([lhBassNote], "lh");
    const rhBassResult = assignFingering(notes, voicingHandHints);
    const bassResolvedFingering = parsed.fingering ?? (parsed.autoFingering
      ? [...lhBassFinger, ...rhBassResult.fingering]
      : undefined);

    const keyboard = (
      <PianoKeyboard
        format={resolvedFormat}
        size={kbSize}
        startFrom={startNote}
        highlightKeys={allHighlights}
        displayNoteNames={[lhBassNote, ...notes]}
        clipLeft={lhClipLeft}
        clipRight={lhClipRight}
        allNotes={[lhBassNote, ...notes]}
        lhNotes={[lhBassNote]}
        lhOctave={lhPlaybackOctave}
        rhOctave={rhPlaybackOctave}
        theme={theme}
        highlightColor={highlightColor}
        chordLabel={parsed.chordName}
        showHeading={parsed.showHeading}
        handBrackets={handBrackets}
        scale={scale}
        showNoteNames={parsed.showNoteNames}
        noteNameSize={parsed.noteNameSize}
        noteNameMode={parsed.noteNameMode}
        midiBaseOctave={lhPlaybackOctave + 1}
        fingering={bassResolvedFingering}
        fingeringSize={parsed.fingeringSize}
        className={className}
        style={style}
      />
    );

    if (display === "staff") {
      return (
        <UIThemeProvider value={uiCtx}>
          {renderStaff(notes, { bassNote: lhBassNote, octaveQualifiedNotes: staffOctaveNotesBass })}
        </UIThemeProvider>
      );
    }

    if (display === "both") {
      return (
        <UIThemeProvider value={uiCtx}>
          <div className="bc-display-both bc-display-both--stacked" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
            {keyboard}
            {renderStaff(notes, { bassNote: lhBassNote, octaveQualifiedNotes: staffOctaveNotesBass })}
          </div>
        </UIThemeProvider>
      );
    }

    return (
      <UIThemeProvider value={uiCtx}>
        {keyboard}
      </UIThemeProvider>
    );
  }

  // normalizeNote converts flats→sharps for keyboard-internal matching;
  // keep original note names for display (e.g. "Bb" not "A#").
  const keyboardNotes = notes.map(normalizeNote);

  const layout = calculateLayout(keyboardNotes, {
    padding: layoutPadding,
    startingNote,
    spanFrom: parsed.spanFrom,
    spanTo: parsed.spanTo,
  });

  // Apply octave shift: extend keyboard and offset chord highlights
  const chordShift = parsed.chordOctaveShift ?? 0;
  const kbSize = chordShift > 0 ? layout.size + chordShift * 7 : layout.size;

  // Use octave-qualified highlights when notes span multiple octaves or when
  // padding/clipping creates duplicate notes that would cause greedy mis-matching.
  // Detect wrapping: any note whose white-key index is at or below the previous.
  let highlightKeys: string[] = keyboardNotes;
  {
    const whiteIndices = keyboardNotes.map((n) => {
      return WHITE_NOTE_ORDER.indexOf(n.replace("#", "") as WhiteNote);
    });
    const needsOctaveQual = layout.chordOctave > 0 || chordShift !== 0 ||
      whiteIndices.some((idx, i) => i > 0 && idx <= whiteIndices[i - 1]);

    if (needsOctaveQual) {
      let octave = Math.max(layout.chordOctave + chordShift, 0);
      let prevWhiteIdx = whiteIndices[0];

      // Step 1: naive ascending octave assignment
      const assigned = keyboardNotes.map((n, i) => {
        const whiteIdx = whiteIndices[i];
        if (i > 0 && whiteIdx <= prevWhiteIdx) {
          octave++;
        }
        prevWhiteIdx = whiteIdx;
        return { note: n, octave };
      });

      // Step 2: compact — fold notes down if span exceeds playable range
      const baseMidi = Note.midi(`${assigned[0].note}${assigned[0].octave + 4}`);
      if (baseMidi != null) {
        for (let i = 1; i < assigned.length; i++) {
          const midi = Note.midi(`${assigned[i].note}${assigned[i].octave + 4}`);
          if (midi != null && midi - baseMidi > MAX_SPAN_SEMITONES && assigned[i].octave > assigned[0].octave) {
            assigned[i].octave--;
          }
        }
      }

      highlightKeys = assigned.map((a) => `${a.note}:${a.octave}`);
    }
  }

  // ── Compute fingering with MIDI context ──────────────────────────
  // Now that we have octave-qualified highlight keys, compute MIDI values
  // so assignFingering can sort by actual pitch and avoid hand crossing.
  const chordMidiValues: number[] = highlightKeys.map((hk) => {
    if (hk.includes(":")) {
      const [note, oct] = hk.split(":");
      return Note.midi(`${note}${parseInt(oct, 10) + 4}`) ?? 60;
    }
    return Note.midi(`${hk}4`) ?? 60;
  });

  let handResult: import("@better-chord/core").HandAssignment;
  if (lhBassNote) {
    // Explicit bass note path already handled above — skip MIDI-based split
    const lhFinger = autoFingering([lhBassNote], "lh");
    const rhResult = assignFingering(notes, voicingHandHints);
    handResult = {
      fingering: [...lhFinger, ...rhResult.fingering],
      hands: ["lh" as const, ...rhResult.hands],
    };
  } else {
    handResult = assignFingering(notes, voicingHandHints, chordMidiValues);
  }

  const resolvedFingering = parsed.fingering ?? (parsed.autoFingering ? handResult.fingering : undefined);
  const isTwoHanded = !lhBassNote && handResult.hands.some((h) => h === "lh");

  // Build hand brackets when chord is split across two hands
  let autoHandBrackets: HandBracket[] | undefined;
  if (isTwoHanded) {
    const tempKeys = computeKeyboard(layout.startFrom as WhiteNote, kbSize, resolvedFormat);
    const lhKeyIndices: number[] = [];
    const rhKeyIndices: number[] = [];
    const matched = new Set<number>();

    for (let ni = 0; ni < keyboardNotes.length; ni++) {
      const hand = handResult.hands[ni];
      const hKey = highlightKeys[ni];
      const hasOctave = hKey.includes(":");
      for (let ki = 0; ki < tempKeys.length; ki++) {
        if (matched.has(ki)) continue;
        const keyNote = normalizeNote(tempKeys[ki].note);
        if (hasOctave) {
          const [note, oct] = hKey.split(":");
          if (keyNote === note && tempKeys[ki].octave === parseInt(oct, 10)) {
            matched.add(ki);
            (hand === "lh" ? lhKeyIndices : rhKeyIndices).push(ki);
            break;
          }
        } else if (keyNote === hKey) {
          matched.add(ki);
          (hand === "lh" ? lhKeyIndices : rhKeyIndices).push(ki);
          break;
        }
      }
    }

    if (lhKeyIndices.length > 0 && rhKeyIndices.length > 0) {
      autoHandBrackets = [
        { label: "L.H.", keyIndices: lhKeyIndices },
        { label: "R.H.", keyIndices: rhKeyIndices },
      ];
    }
  }

  const keyboard = (
    <PianoKeyboard
      format={resolvedFormat}
      size={kbSize}
      startFrom={layout.startFrom as WhiteNote}
      highlightKeys={highlightKeys}
      displayNoteNames={notes}
      clipLeft={layout.clipLeft}
      clipRight={layout.clipRight}
      rhOctave={chordShift !== 0 ? 4 + chordShift : undefined}
      theme={theme}
      highlightColor={highlightColor}
      chordLabel={parsed.chordName}
      showHeading={parsed.showHeading}
      handBrackets={autoHandBrackets}
      scale={scale}
      showNoteNames={parsed.showNoteNames}
      noteNameSize={parsed.noteNameSize}
      noteNameMode={parsed.noteNameMode}
      midiBaseOctave={4}
      fingering={resolvedFingering}
      fingeringSize={parsed.fingeringSize}
      degreeLabels={chordDegreeLabels}
      className={className}
      style={style}
    />
  );

  // Octave-qualified notes for staff notation — use absolute octave (4), not keyboard-relative
  const staffOctaveNotes = computeOctaveQualified(notes, 4 + chordShift);

  if (display === "staff") {
    return (
      <UIThemeProvider value={uiCtx}>
        {renderStaff(notes, { octaveQualifiedNotes: staffOctaveNotes })}
      </UIThemeProvider>
    );
  }

  if (display === "both") {
    return (
      <UIThemeProvider value={uiCtx}>
        <div className="bc-display-both" style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {renderStaff(notes, { octaveQualifiedNotes: staffOctaveNotes })}
          {keyboard}
        </div>
      </UIThemeProvider>
    );
  }

  return (
    <UIThemeProvider value={uiCtx}>
      {keyboard}
    </UIThemeProvider>
  );
}
