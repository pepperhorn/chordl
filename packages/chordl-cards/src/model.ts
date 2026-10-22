// @pepperhorn/chordl-cards/model — the card voicing model, React-free and
// node-free. What print imports; the player builds on the same functions.

export { explodedVoicing, handsWindow, HANDS_WINDOW } from "./hands";
export type { HandTone, ExplodedVoicing } from "./hands";

export {
  KEYBOARD_WHITE_KEYS, MIN_CONTEXT_KEYS,
  voiceAscending, keyboardWindow, keyIndicesFor, keyCentresFor,
} from "./keyboard-window";
export type { KeyboardWindow, WhiteNote } from "./keyboard-window";

export {
  requestFor, sharpPitchClasses, chordNotes, plainKeyboardWindow,
  keyboardNoteLabels, handsNoteLabels, handLabels,
  faceNoteNames, handBracketsFor,
} from "./faces";
export type {
  CardFace, FaceRequest, KeyboardFaceRequest, GuitarFaceRequest, FrettedShape,
  NoteLabel, HandBracket,
} from "./faces";

export { playbackFor } from "./playback";
export type { FacePlayback } from "./playback";

export { qualityLabelFor, fullChordName, rootOf } from "./names";

export { parseTheme, toneColor, familyOf, HEX_COLOUR } from "./theme";
export type {
  Theme, ThemeFonts, ThemeKeyboard, ThemeFret, ThemeQrChip, ThemePlayback,
  FontSpec, FontFamilyKey, FontStyle, ColorMode, KeyboardFormat, PitchEntry, RootEntry,
} from "./theme";

export {
  CHORD_TYPES, ROOTS, SHEET_ERRATA, chordTypeById, parseChordSymbol, spellChord,
  spellInterval, noteParts, chordSpelling, spelledChord,
  spellChordStrict, simplifyDoubleAccidental, teachingNoteFor,
} from "./catalogue";
export type { ChordType, CatalogueFace, ParsedChord, Root } from "./catalogue";

export {
  SLASH_INTERVALS, SLASH_UPPER_TYPES, slashChordsForBass, respellIntoRoots,
} from "./slash";
export type { SlashChord, SlashInterval } from "./slash";

export { slugFor, rootSlug } from "./slug";
export type { SlugInput } from "./slug";
