export interface StaffGlyphSet {
  name: string;
  trebleClef: { path: string; width: number; height: number; originY: number };
  bassClef: { path: string; width: number; height: number; originY: number };
  sharp: { path: string; width: number; height: number };
  flat: { path: string; width: number; height: number };
  natural: { path: string; width: number; height: number };
  brace: (height: number) => string;
}

// Bravura-derived SVG paths (simplified for embedding)
// SMuFL: trebleClef=U+E050, bassClef=U+E062, sharp=U+E262, flat=U+E260
export const BRAVURA_GLYPHS: StaffGlyphSet = {
  name: "Bravura",

  trebleClef: {
    // Simplified treble clef path derived from Bravura (OFL licensed)
    path: "M 9.5 32 C 9.5 28 11 24.5 13.5 21.5 C 16 18.5 17 15 17 11 C 17 7.5 15.5 4.5 13 2.5 C 11.5 1.3 10 0.5 8.5 0.5 C 7.5 0.5 6.8 1 6.5 1.8 C 6.2 2.6 6.5 3.5 7.2 3.8 C 8 4.2 9 3.8 9.3 3 C 9 2.5 8.5 2 8.5 2 C 9 1.8 9.5 1.8 10 2 C 12 3 13.5 5.5 13.5 8.5 C 13.5 11.5 12 14.5 10 17 C 7 20.5 5.5 24.5 5.5 28.5 C 5.5 31 6 33 7 35 C 4 37 2 40 2 43.5 C 2 47.5 4.5 50 8 50 C 11 50 13.5 48 14.5 45 C 15.5 42 14.5 38.5 12.5 37 C 10.5 35.5 8 35 6 35.5 C 7 33.5 8 32.5 9.5 32 Z M 8 48.5 C 5.5 48.5 3.5 46.5 3.5 43.5 C 3.5 41 4.5 38.5 7 36.5 C 7.5 37 8 37 8.5 37 C 11 37 13 39.5 13 42.5 C 13 45.5 11 48.5 8 48.5 Z",
    width: 18,
    height: 51,
    originY: 28, // Y position where G4 line sits
  },

  bassClef: {
    // Simplified bass clef path
    path: "M 1 2 C 1 2 3 0 6.5 0 C 10 0 13 2.5 13 6 C 13 9 11 11 8.5 11.5 C 7 11.8 5.5 11 5 9.5 C 4.5 8 5.5 6.5 7 6.2 C 8.5 5.9 9.5 7 9.5 8 C 9.5 8.5 9 9 8.5 9 C 10 9.5 11 8.5 11 7 C 11 4 8.5 2 6 2 C 3.5 2 1.5 3.5 1 5 L 1 2 Z M 15 3 C 15.8 3 16.5 3.7 16.5 4.5 C 16.5 5.3 15.8 6 15 6 C 14.2 6 13.5 5.3 13.5 4.5 C 13.5 3.7 14.2 3 15 3 Z M 15 7.5 C 15.8 7.5 16.5 8.2 16.5 9 C 16.5 9.8 15.8 10.5 15 10.5 C 14.2 10.5 13.5 9.8 13.5 9 C 13.5 8.2 14.2 7.5 15 7.5 Z",
    width: 18,
    height: 12,
    originY: 4, // Y position where F3 line sits
  },

  sharp: {
    path: "M 3.5 0 L 3.5 5 L 0 6.2 L 0 7.5 L 3.5 6.3 L 3.5 11.5 L 0 12.7 L 0 14 L 3.5 12.8 L 3.5 18 L 4.8 18 L 4.8 12.3 L 8 11 L 8 16.5 L 9.3 16.5 L 9.3 10.5 L 12.5 9.3 L 12.5 8 L 9.3 9.2 L 9.3 4 L 12.5 2.8 L 12.5 1.5 L 9.3 2.7 L 9.3 -2.5 L 8 -2.5 L 8 3.2 L 4.8 4.5 L 4.8 -1 L 3.5 -1 L 3.5 0 Z M 4.8 5.8 L 8 4.5 L 8 9.7 L 4.8 11 L 4.8 5.8 Z",
    width: 12.5,
    height: 20.5,
  },

  flat: {
    path: "M 1 0 L 1 14 C 1 14 1 11 4 9.5 C 7 8 8.5 9.5 8.5 11 C 8.5 13 6 15 1 15.5 L 1 17 L 2.3 17 C 8 16 10 13 10 11 C 10 8.5 7.5 7 5 8 C 3 8.8 2.3 10 2.3 10 L 2.3 0 L 1 0 Z",
    width: 10,
    height: 17,
  },

  natural: {
    path: "M 1 0 L 1 11.5 L 6.5 9.5 L 6.5 18 L 7.8 18 L 7.8 6.5 L 2.3 8.5 L 2.3 0 L 1 0 Z",
    width: 7.8,
    height: 18,
  },

  brace: (height: number) => {
    const mid = height / 2;
    const q = height / 4;
    return `M 6 0 C 2 ${q} 0 ${mid - 4} 0 ${mid} C 0 ${mid + 4} 2 ${mid + q} 6 ${height}`;
  },
};

let _defaultGlyphs: StaffGlyphSet = BRAVURA_GLYPHS;

export function getDefaultGlyphs(): StaffGlyphSet {
  return _defaultGlyphs;
}

export function setDefaultGlyphs(glyphs: StaffGlyphSet): void {
  _defaultGlyphs = glyphs;
}
