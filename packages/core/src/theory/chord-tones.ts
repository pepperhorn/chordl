/**
 * Chord tone classification engine.
 *
 * Classifies each note in a chord by its functional role:
 * - identity: defines the chord (3rd, 7th, altered tensions) — never drop
 * - color: adds character (natural 9th, 13th) — drop last
 * - foundation: structural (root) — drop when bass covers it
 * - omittable: standard to omit (perfect 5th, natural 11th) — drop first
 *
 * Inspired by Mark Levine's "The Jazz Piano Book" approach to voicing.
 */

// ── Types ─────────────────────────────────────────────────────────

export type ChordToneRole = "identity" | "color" | "foundation" | "omittable";

export interface ChordTone {
  note: string;           // Pitch class: "E", "Bb", "D#"
  interval: string;       // Tonal format: "3M", "7m", "9A"
  degree: number;         // Scale degree: 1, 3, 5, 7, 9, 11, 13
  quality: string;        // "P", "M", "m", "A", "d"
  role: ChordToneRole;
}

export interface ChordToneAnalysis {
  root: string;
  type: string;
  tones: ChordTone[];
  /** Notes that define the chord — never drop */
  identityTones: string[];
  /** Smallest set that still communicates the chord */
  minVoicing: string[];
  /** Notes ordered safe-to-drop-first → never-drop-last */
  dropOrder: string[];
}

// ── Interval parsing ──────────────────────────────────────────────

/**
 * Parse a Tonal interval string like "3M", "5d", "9A", "1P".
 * Format: degree number + quality letter(s).
 */
export function parseInterval(interval: string): { degree: number; quality: string } {
  const match = interval.match(/^(\d+)(.*)/);
  if (!match) return { degree: 0, quality: "" };
  return {
    degree: parseInt(match[1], 10),
    quality: match[2],
  };
}

/**
 * Check if an interval is "altered" — i.e., not the natural/default quality
 * for that scale degree.
 *
 * Natural defaults:
 *   1=P, 2=M, 3=M(maj)/m(min), 4=P, 5=P, 6=M, 7=M(maj)/m(dom/min)
 *   9=M, 11=P, 13=M
 *
 * Anything else (A=augmented, d=diminished, or wrong M/m) is altered.
 */
function isAltered(degree: number, quality: string): boolean {
  switch (degree) {
    case 1: return quality !== "P";
    case 2: case 9: return quality !== "M";
    case 3: return quality !== "M" && quality !== "m"; // both are "natural" depending on chord
    case 4: case 11: return quality !== "P";
    case 5: return quality !== "P";
    case 6: case 13: return quality !== "M";
    case 7: return quality !== "M" && quality !== "m"; // both natural depending on chord
    default: return false;
  }
}

// ── Chord quality families ────────────────────────────────────────

type QualityFamily = "triad" | "seventh" | "half-dim" | "dim7" | "alt" | "sus" | "sixth";

function classifyQualityFamily(type: string, intervals?: string[]): QualityFamily {
  const t = type.toLowerCase();
  if (t.includes("alt")) return "alt";
  if (t.includes("dim") && t.includes("seventh")) return "dim7";
  if (t.includes("half") || t.includes("m7b5")) return "half-dim";
  if (t.includes("sus")) return "sus";
  if (t.includes("sixth") || t.includes("6")) return "sixth";
  if (/seven|7|ninth|9|eleven|11|thirteen|13/.test(t)) return "seventh";

  // Fallback: infer from intervals when type string is empty/ambiguous
  if (intervals && intervals.length > 0) {
    const hasAugOrDimFifth = intervals.some((i) => {
      const { degree, quality } = parseInterval(i);
      return degree === 5 && (quality === "A" || quality === "d");
    });
    const hasSeventh = intervals.some((i) => parseInterval(i).degree === 7);
    const hasAlteredExtension = intervals.some((i) => {
      const { degree, quality } = parseInterval(i);
      return degree >= 9 && isAltered(degree, quality);
    });

    if (hasAlteredExtension && hasAugOrDimFifth) return "alt";
    if (hasSeventh) {
      const dimFifth = intervals.some((i) => {
        const p = parseInterval(i);
        return p.degree === 5 && p.quality === "d";
      });
      const dimSeventh = intervals.some((i) => {
        const p = parseInterval(i);
        return p.degree === 7 && p.quality === "d";
      });
      if (dimFifth && dimSeventh) return "dim7";
      if (dimFifth) return "half-dim";
      return "seventh";
    }
  }

  return "triad";
}

// ── Role assignment ───────────────────────────────────────────────

/**
 * Assign a role to a chord tone based on its degree, quality, and the
 * chord's quality family.
 */
function assignRole(
  degree: number,
  quality: string,
  family: QualityFamily,
  instrument: "piano" | "guitar",
): ChordToneRole {
  const altered = isAltered(degree, quality);

  switch (degree) {
    case 1:
      // Root: foundation in most contexts, omittable in rootless jazz piano
      if (family === "alt" && instrument === "piano") return "omittable";
      return "foundation";

    case 3:
      // 3rd always defines major/minor quality
      return "identity";

    case 4:
      // sus4: the 4th replaces the 3rd, so it's identity
      if (family === "sus") return "identity";
      // #11 is identity (lydian character)
      if (altered) return "identity";
      // Natural 11 clashes with major 3rd — omittable
      return "omittable";

    case 5:
      // Perfect 5th is omittable in 7th chords — adds nothing to identity
      // But altered 5th (b5, #5) IS the identity (dim, aug, m7b5)
      if (altered) return "identity";
      if (family === "triad") return instrument === "guitar" ? "omittable" : "identity";
      return "omittable";

    case 6:
      // 6th in sixth chords is identity
      if (family === "sixth") return "identity";
      return "color";

    case 7:
      // 7th defines the chord in 7th-chord families
      if (family === "triad") return "color"; // shouldn't normally appear
      return "identity";

    case 2: case 9:
      // Altered 9ths (#9, b9) are identity — they define the chord
      if (altered) return "identity";
      return "color";

    case 11:
      if (altered) return "identity"; // #11 = lydian
      return "omittable"; // natural 11 clashes with 3rd

    case 13:
      if (altered) return "identity"; // b13 in alt chords
      return "color";

    default:
      return "color";
  }
}

// ── Main classification ───────────────────────────────────────────

/**
 * Classify each tone in a chord by its functional role.
 *
 * @param root - Root note ("C", "Bb", etc.)
 * @param chordType - Tonal chord type string ("major seventh", "dominant sharp ninth")
 * @param intervals - Tonal interval names (["1P", "3M", "5P", "7M"])
 * @param notes - Pitch classes matching intervals (["C", "E", "G", "B"])
 * @param instrument - "piano" (default) or "guitar" — shifts role assignments
 */
export function classifyTones(
  root: string,
  chordType: string,
  intervals: string[],
  notes: string[],
  instrument: "piano" | "guitar" = "piano",
): ChordToneAnalysis {
  const family = classifyQualityFamily(chordType, intervals);

  const tones: ChordTone[] = intervals.map((interval, i) => {
    const { degree, quality } = parseInterval(interval);
    const role = assignRole(degree, quality, family, instrument);
    return {
      note: notes[i] ?? "",
      interval,
      degree,
      quality,
      role,
    };
  });

  const identityTones = tones.filter((t) => t.role === "identity").map((t) => t.note);

  // Minimal voicing: identity tones + foundation (root) for grounding
  const foundationTones = tones.filter((t) => t.role === "foundation").map((t) => t.note);
  const minVoicing = [...foundationTones, ...identityTones];

  // Drop order: omittable first, then color, then foundation, identity last
  const ROLE_PRIORITY: Record<ChordToneRole, number> = {
    omittable: 0,
    color: 1,
    foundation: 2,
    identity: 3,
  };
  const dropOrder = [...tones]
    .sort((a, b) => ROLE_PRIORITY[a.role] - ROLE_PRIORITY[b.role])
    .map((t) => t.note);

  return {
    root,
    type: chordType,
    tones,
    identityTones,
    minVoicing,
    dropOrder,
  };
}

/**
 * Get the minimal voicing — the fewest notes that still communicate the chord.
 */
export function minimalVoicing(analysis: ChordToneAnalysis): string[] {
  return analysis.minVoicing;
}

/**
 * Get notes in order of safe-to-drop (first = safest to drop).
 */
export function dropOrder(analysis: ChordToneAnalysis): string[] {
  return analysis.dropOrder;
}
