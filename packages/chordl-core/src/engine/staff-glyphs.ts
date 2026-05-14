// SMuFL (Standard Music Font Layout) glyph sets.
//
// Glyphs are addressed by Unicode codepoint and rendered as <text> with the
// matching font-family. SMuFL fonts are designed so that 1 em = 4 staff
// spaces, which means setting font-size = 4 * staffLineSpacing makes glyphs
// render at the correct staff size with no per-glyph scaling.
//
// Font loading: @pepperhorn/chordl-react auto-injects subsetted versions
// (PHBravura, PHPetaluma — see chordl-react/src/staff-fonts.ts) so consumers
// don't need to host woff2 files. The fontFamily stack falls back to the
// unsubsetted Bravura/Petaluma names so consumers who provide the full fonts
// (e.g. for extended glyphs beyond the 6 subset codepoints) still work.

export interface StaffGlyphSet {
  name: string;
  fontFamily: string;
  glyphs: {
    trebleClef: string;
    bassClef: string;
    sharp: string;
    flat: string;
    natural: string;
    wholeNote: string;
  };
  brace: (height: number) => string;
}

const SMUFL = {
  gClef: "",
  fClef: "",
  noteheadWhole: "",
  accidentalSharp: "",
  accidentalFlat: "",
  accidentalNatural: "",
} as const;

function synthesizedBrace(curl: number) {
  return (height: number) => {
    const mid = height / 2;
    const q = height / 4;
    return `M ${curl} 0 C ${curl - 4} ${q} 0 ${mid - 4} 0 ${mid} C 0 ${mid + 4} ${curl - 4} ${mid + q} ${curl} ${height}`;
  };
}

export const BRAVURA_GLYPHS: StaffGlyphSet = {
  name: "Bravura",
  fontFamily: "PHBravura, Bravura, serif",
  glyphs: {
    trebleClef: SMUFL.gClef,
    bassClef: SMUFL.fClef,
    sharp: SMUFL.accidentalSharp,
    flat: SMUFL.accidentalFlat,
    natural: SMUFL.accidentalNatural,
    wholeNote: SMUFL.noteheadWhole,
  },
  brace: synthesizedBrace(6),
};

export const PETALUMA_GLYPHS: StaffGlyphSet = {
  name: "Petaluma",
  fontFamily: "PHPetaluma, Petaluma, serif",
  glyphs: {
    trebleClef: SMUFL.gClef,
    bassClef: SMUFL.fClef,
    sharp: SMUFL.accidentalSharp,
    flat: SMUFL.accidentalFlat,
    natural: SMUFL.accidentalNatural,
    wholeNote: SMUFL.noteheadWhole,
  },
  brace: synthesizedBrace(6),
};

let _defaultGlyphs: StaffGlyphSet = BRAVURA_GLYPHS;

export function getDefaultGlyphs(): StaffGlyphSet {
  return _defaultGlyphs;
}

export function setDefaultGlyphs(glyphs: StaffGlyphSet): void {
  _defaultGlyphs = glyphs;
}
