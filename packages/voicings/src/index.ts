export { VOICING_LIBRARY } from "./library";
export {
  queryVoicings,
  findVoicing,
  realizeVoicing,
  realizeVoicingFull,
  voicingPitchClasses,
  getAlternativeVoicings,
  inferStyle,
  mapToVoicingQuality,
} from "./query";
export { selectByRange, autoSelectVoicing } from "./range-algorithm";
export { generateLockedHands } from "./locked-hands";
export { solvePolychord, solveSlashChord } from "./polychord";
export type { ChordDescriptor } from "./polychord";
export type {
  VoicingEntry,
  VoicingQuery,
  VoicingQuality,
  VoicingEra,
  VoicingStyle,
  Hand,
  RealizedNote,
} from "./types";
