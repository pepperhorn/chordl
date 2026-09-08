export { VOICING_LIBRARY } from "./library.js";
export {
  queryVoicings,
  findVoicing,
  realizeVoicing,
  realizeVoicingFull,
  voicingPitchClasses,
  voicingOctaveOffsets,
  getAlternativeVoicings,
  inferStyle,
  mapToVoicingQuality,
} from "./query.js";
export { selectByRange, autoSelectVoicing } from "./range-algorithm.js";
export { generateLockedHands } from "./locked-hands.js";
export { solvePolychord, solveSlashChord } from "./polychord.js";
export type { ChordDescriptor } from "./polychord.js";
export { generateVariants } from "./variant-generator.js";
export type {
  VoicingEntry,
  VoicingQuery,
  VoicingQuality,
  VoicingEra,
  VoicingStyle,
  Hand,
  RealizedNote,
  VoicingVariant,
} from "./types.js";
export {
  levelForVoicing,
  isCoreQuality,
  selectVoicingsForExperience,
  EXPERIENCE_LADDER,
  CORE_TEMPLATES,
} from "./experience.js";
export type { ExperienceLevel, VoicingSelection } from "./experience.js";
