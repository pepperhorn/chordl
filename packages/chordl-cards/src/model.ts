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
  requestFor, sharpPitchClasses, chordNotes,
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
