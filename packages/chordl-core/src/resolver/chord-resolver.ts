import { Chord, Note, Interval } from "tonal";

/**
 * Simplify a note name via Tonal without forcing sharp spelling.
 * Tonal's simplify already respects musical context (e.g. Bb stays Bb).
 */
function simplifyNote(note: string): string {
  const simplified = Note.simplify(note);
  return simplified || note;
}

// Alteration tokens we can strip and re-apply as intervals
const ALTERATION_RE =
  /([#b](?:5|9|11|13)|add(?:9|11|13|b9|#9|b13|#11))$/;

const ALTERATION_TO_INTERVAL: Record<string, string> = {
  "#5": "5A",
  "b5": "5d",
  "#9": "2A",
  "b9": "2m",
  "#11": "4A",
  "b11": "4d",
  "#13": "6A",
  "b13": "6m",
  "add9": "2M",
  "add11": "4P",
  "add13": "6M",
  "addb9": "2m",
  "add#9": "2A",
  "add#11": "4A",
  "addb13": "6m",
};

// Strip the whole alteration tail before consulting Tonal: e.g. 7b9b5 is
// otherwise interpreted as 7b9#11, retaining the natural fifth.
function splitAlterations(chordName: string) {
  const rootMatch = chordName.match(/^([A-G][#b]?)/);
  if (!rootMatch) return null;
  const root = rootMatch[1];
  let suffix = chordName.slice(root.length);
  const tokens: string[] = [];
  let match: RegExpMatchArray | null;
  while ((match = suffix.match(ALTERATION_RE))) {
    tokens.unshift(match[1]);
    suffix = suffix.slice(0, -match[1].length);
  }
  return { root, suffix, tokens };
}

function resolveWithFallback(
  chordName: string
): { notes: string[]; root: string; type: string; intervals: string[] } | null {
  const parts = splitAlterations(chordName);
  if (!parts || !parts.tokens.length) return null;
  const { root, suffix, tokens } = parts;
  const chord = Chord.get(root + suffix);
  if (chord.empty) return null;
  const notes = chord.notes.map(simplifyNote);
  const intervals = [...chord.intervals];

  for (const token of tokens) {
    const ivl = ALTERATION_TO_INTERVAL[token];
    const note = simplifyNote(Note.transpose(root, ivl));
    // Alterations replace that degree; additions keep existing chord tones.
    // Match interval degrees, never chroma: b5 and #11 share a sound but
    // describe different chord tones.
    const index = token.startsWith("add") ? -1 : intervals.findIndex(
      (existing) => Interval.get(existing).simple === Interval.get(ivl).simple,
    );
    if (index >= 0) {
      notes[index] = note;
      intervals[index] = ivl;
    } else if (!notes.includes(note)) {
      notes.push(note);
      intervals.push(ivl);
    }
  }
  return {
    notes, root: simplifyNote(root),
    // A quality such as m7b5 or 7#11 owns its first alteration too.
    type: (() => {
      const quality = Chord.get(root + suffix + tokens[0]);
      const base = quality.empty ? chord : quality;
      return (base.type || base.aliases?.[0] || suffix) + " (extended)";
    })(),
    intervals,
  };
}

export interface ResolvedChord {
  notes: string[];
  root: string;
  type: string;
  /**
   * Interval names relative to the root (e.g. ["1P", "3M", "5P", "7M"]).
   *
   * Populated on every branch of `resolveChord` — tonal, `buildSpecialChord`
   * and `resolveWithFallback` alike. `mapToVoicingQuality` classifies chords by
   * these rather than by the shape of `type`, so a branch that left them
   * undefined would silently fall back to reading the chord's name.
   *
   * Unlike `notes`, these are *not* rotated by `inversion` below: they describe
   * the chord, not the order its notes are voiced in.
   */
  intervals?: string[];
}

// Normalize chord symbols that Tonal doesn't recognize into equivalents
function normalizeChordName(name: string): string {
  // Extract root note first
  const rootMatch = name.match(/^([A-G][#b]?)/i);
  if (!rootMatch) return name;
  const root = rootMatch[1];
  let suffix = name.slice(root.length);

  // Tonal's major/minor thirteenths omit the catalogue's natural eleventh.
  // Do not turn these previously unsupported bracketed spellings into a
  // silently incomplete chord. #11 variants explicitly supply their eleventh.
  if (/^(?:maj13\(#5\)|m13\([b#]5\))$/.test(suffix)) {
    throw new Error(`Unknown chord: "${name}"`);
  }

  // Catalogue extensions such as m7b5(b9) and 7(b9,#5) use brackets.
  // Unwrap only alteration lists; other parentheses retain their meaning.
  suffix = suffix.replace(/\(((?:[#b](?:5|9|11|13)|add(?:9|11|13|b9|#9|b13|#11))(?:,(?:[#b](?:5|9|11|13)|add(?:9|11|13|b9|#9|b13|#11)))*)\)/g,
    (group, alterations: string, offset: number) =>
      offset === 0 && /^[#b]/.test(alterations)
        ? group : alterations.replace(/,/g, ""));

  // Jazz Δ7 spells maj7; normalize its look-alike without changing other Δ forms.
  suffix = suffix.replace(/∆/g, "Δ").replace(/(?<!M)Δ7/g, "maj7");

  // m7sus is special — handled by buildSpecialChord, don't normalize it away

  // Cmaug → Cm#5 (minor augmented)
  suffix = suffix.replace(/^maug$/i, "m#5");

  // Cm6/9 → Cm6add9 (Tonal doesn't know m6/9 but knows the notes)
  // Actually build it manually below via special handling

  // CmMaj → CmM (Tonal recognizes mM but not mmaj for some roots)
  // Dbmmaj7 → DbmMaj7 — ensure proper casing
  suffix = suffix.replace(/mmaj/i, "mMaj");

  // omit3 → remove, we'll handle it post-resolution
  // Keep it for now, handle in resolveChord

  return root + suffix;
}

// Special chord builders for symbols Tonal can't handle at all
function buildSpecialChord(
  name: string
): { notes: string[]; root: string; type: string; intervals: string[] } | null {
  const rootMatch = name.match(/^([A-G][#b]?)/i);
  if (!rootMatch) return null;
  const root = rootMatch[1];
  const suffix = name.slice(root.length);

  // X7omit3 → root, 5th, b7 (no 3rd)
  if (/^7omit3$/i.test(suffix)) {
    return {
      notes: [root, Note.transpose(root, "5P"), Note.transpose(root, "7m")].map(simplifyNote),
      root: simplifyNote(root),
      type: "7omit3",
      intervals: ["1P", "5P", "7m"],
    };
  }

  // Xm7sus / Xm7sus4 → root, m3, P4, m7
  if (/^m7sus4?$/i.test(suffix)) {
    return {
      notes: [
        root,
        Note.transpose(root, "3m"),
        Note.transpose(root, "4P"),
        Note.transpose(root, "7m"),
      ].map(simplifyNote),
      root: simplifyNote(root),
      type: "m7sus4",
      intervals: ["1P", "3m", "4P", "7m"],
    };
  }

  // Xm6/9 → root, m3, 5, 6, 9
  if (/^m6\/9$/i.test(suffix)) {
    return {
      notes: [
        root,
        Note.transpose(root, "3m"),
        Note.transpose(root, "5P"),
        Note.transpose(root, "6M"),
        Note.transpose(root, "2M"),
      ].map(simplifyNote),
      root: simplifyNote(root),
      type: "m6/9",
      // The ninth is transposed as a 2M above, which is the same pitch class;
      // named here as the ninth the chord actually spells.
      intervals: ["1P", "3m", "5P", "6M", "9M"],
    };
  }

  return null;
}

export function resolveChord(
  chordName: string,
  inversion?: number
): ResolvedChord {
  // Only a terminal note is a slash bass; m6/9 remains a quality.
  const slash = chordName.match(/\/([A-G][#b]?)$/);
  const upperName = normalizeChordName(slash ? chordName.slice(0, slash.index) : chordName);
  chordName = upperName + (slash ? slash[0] : "");
  const chord = Chord.get(chordName);

  let notes: string[];
  let root: string;
  let type: string;
  let intervals: string[] | undefined;

  // Try special chord builders first (omit3, m6/9, etc.)
  const special = buildSpecialChord(chordName);
  const alterations = splitAlterations(upperName)?.tokens ?? [];
  const alteredFifth = alterations.length > 1 && alterations.some((t) => t === "b5" || t === "#5");
  const fallback = chord.empty || alteredFifth ? resolveWithFallback(upperName) : null;
  if (special) {
    notes = special.notes;
    root = special.root;
    type = special.type;
    intervals = special.intervals;
  } else if (fallback) {
    ({ notes, root, type, intervals } = fallback);
    if (slash) {
      const bass = simplifyNote(slash[1]);
      const bassIndex = notes.findIndex((note) => Note.chroma(note) === Note.chroma(bass));
      // Chord tones rotate into the bass; an external pedal is added below
      // the upper chord. Intervals continue to describe the upper quality.
      notes = bassIndex < 0 ? [bass, ...notes]
        : [bass, ...notes.slice(bassIndex + 1), ...notes.slice(0, bassIndex)];
    }
  } else if (!chord.empty && !alteredFifth) {
    notes = chord.notes.map(simplifyNote);
    root = simplifyNote(chord.tonic ?? notes[0]);
    // tonal names most of its chord types but not all: `Cadd9`, `CM7b5` and
    // `C6#11` resolve to real notes carrying `type: ""`. An empty type tells a
    // consumer nothing — `mapToVoicingQuality` reads this field to pick a
    // voicing — so fall back to the type's own first alias, which is the
    // canonical spelling tonal lists for it. The display name comes from the
    // parsed chord name, not from here, so this only affects consumers that
    // reason about the chord's quality.
    type = chord.type || chord.aliases?.[0] || "";
    intervals = chord.intervals;
  } else {
    throw new Error(`Unknown chord: "${chordName}"`);
  }

  // Apply inversion: rotate notes array
  if (inversion && inversion > 0) {
    const rotation = inversion % notes.length;
    notes = [...notes.slice(rotation), ...notes.slice(0, rotation)];
  }

  return { notes, root, type, intervals };
}
