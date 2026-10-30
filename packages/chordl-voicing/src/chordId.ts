// Chord IDs: `<root>:<quality>[/<bass>]`, e.g. `C:maj7`, `Db:7#9b13/F`.
// Enharmonic roots are distinct IDs (C# and Db are different files).

export const BASE_QUALITIES: Record<string, string[]> = {
  maj: ["1P", "3M", "5P"],
  m: ["1P", "3m", "5P"],
  dim: ["1P", "3m", "5d"],
  aug: ["1P", "3M", "5A"],
  sus2: ["1P", "2M", "5P"],
  sus4: ["1P", "4P", "5P"],
  "5": ["1P", "5P"],
  "6": ["1P", "3M", "5P", "6M"],
  m6: ["1P", "3m", "5P", "6M"],
  "69": ["1P", "3M", "5P", "6M", "9M"],
  m69: ["1P", "3m", "5P", "6M", "9M"],
  add9: ["1P", "3M", "5P", "9M"],
  madd9: ["1P", "3m", "5P", "9M"],
  maj7: ["1P", "3M", "5P", "7M"],
  "7": ["1P", "3M", "5P", "7m"],
  m7: ["1P", "3m", "5P", "7m"],
  mmaj7: ["1P", "3m", "5P", "7M"],
  m7b5: ["1P", "3m", "5d", "7m"],
  dim7: ["1P", "3m", "5d", "7d"],
  "7sus4": ["1P", "4P", "5P", "7m"],
  maj9: ["1P", "3M", "5P", "7M", "9M"],
  "9": ["1P", "3M", "5P", "7m", "9M"],
  m9: ["1P", "3m", "5P", "7m", "9M"],
  "11": ["1P", "3M", "5P", "7m", "9M", "11P"],
  m11: ["1P", "3m", "5P", "7m", "9M", "11P"],
  maj13: ["1P", "3M", "5P", "7M", "9M", "13M"],
  "13": ["1P", "3M", "5P", "7m", "9M", "13M"],
  m13: ["1P", "3m", "5P", "7m", "9M", "13M"],
  "7alt": ["1P", "3M", "7m"],
};

export const ALTERATIONS = ["b5", "#5", "b9", "#9", "#11", "b13"] as const;

const ALTERATION_INTERVAL: Record<string, string> = {
  b5: "5d", "#5": "5A", b9: "9m", "#9": "9A", "#11": "11A", b13: "13m",
};

const ROOT_RE = /^[A-G][b#]?$/;
const degreeOf = (interval: string): number => parseInt(interval, 10);
const hasSeventh = (intervals: string[]): boolean => intervals.some((i) => degreeOf(i) === 7);

// Longest token first so `m7b5` wins over `m7` and `69` over `6`.
const BASE_TOKENS = Object.keys(BASE_QUALITIES).sort((a, b) => b.length - a.length);

export interface ParsedChordId {
  root: string;
  quality: string;
  bass: string | null;
  base: string;
  alterations: string[];
}

function splitAlterations(rest: string): string[] | null {
  const out: string[] = [];
  let lastIdx = -1;
  while (rest.length > 0) {
    const idx = ALTERATIONS.findIndex((a) => rest.startsWith(a));
    if (idx === -1 || idx <= lastIdx) return null;
    out.push(ALTERATIONS[idx]);
    lastIdx = idx;
    rest = rest.slice(ALTERATIONS[idx].length);
  }
  return out;
}

export function parseChordId(id: string): ParsedChordId | null {
  if (typeof id !== "string") return null;
  const colon = id.indexOf(":");
  if (colon === -1) return null;
  const root = id.slice(0, colon);
  if (!ROOT_RE.test(root)) return null;
  let quality = id.slice(colon + 1);
  let bass: string | null = null;
  const slash = quality.indexOf("/");
  if (slash !== -1) {
    bass = quality.slice(slash + 1);
    quality = quality.slice(0, slash);
    if (!ROOT_RE.test(bass)) return null;
  }
  for (const base of BASE_TOKENS) {
    if (!quality.startsWith(base)) continue;
    const alterations = splitAlterations(quality.slice(base.length));
    if (!alterations) continue;
    if (alterations.length > 0 && (base === "7alt" || !hasSeventh(BASE_QUALITIES[base]))) continue;
    return { root, quality, bass, base, alterations };
  }
  return null;
}

export function formatChordId(parts: { root: string; quality: string; bass?: string | null }): string {
  return `${parts.root}:${parts.quality}${parts.bass ? `/${parts.bass}` : ""}`;
}

export function chordIntervals(id: string): string[] {
  const p = parseChordId(id);
  if (!p) throw new Error(`Invalid chord id: ${id}`);
  // An alteration replaces only the base's natural of that degree; alterations never replace each other.
  const added = p.alterations.map((a) => ALTERATION_INTERVAL[a]);
  const replaced = new Set(added.map(degreeOf));
  const intervals = [...BASE_QUALITIES[p.base].filter((i) => !replaced.has(degreeOf(i))), ...added];
  return intervals.sort((a, b) => degreeOf(a) - degreeOf(b));
}
