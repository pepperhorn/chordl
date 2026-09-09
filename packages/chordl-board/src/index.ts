export { ChordBoard, useChordBoard, newId } from "./ChordBoard.js";
export type { ChordBoardProps } from "./ChordBoard.js";
// `BoardCardContent` is exported from ChordBoard.tsx for BoardPlayer to share,
// and deliberately not re-exported here: it is an internal renderer, and
// putting it in the package's public surface would commit us to its props.
export { BoardPlayer } from "./BoardPlayer.js";
export type { BoardPlayerProps } from "./BoardPlayer.js";
export { resolveCardPlayback } from "./cardPlayback.js";
export type { CardPlayback } from "./cardPlayback.js";
export { CardToolbar, placeCardToolbar, domMeasureToolbar, TOOLBAR_GAP, TOOLBAR_MARGIN, TOOLBAR_CARET } from "./CardToolbar.js";
export type {
  CardToolbarProps,
  MeasureToolbar,
  ToolbarMeasurements,
  ToolbarPlacement,
  ToolbarPosition,
  ToolbarRect,
} from "./CardToolbar.js";
export type {
  BoardDisplayMode,
  BoardItem,
  BoardItemKind,
  BoardMeta,
  BoardState,
  StorageAdapter,
} from "./types.js";
export { BOARD_CARD_SIZES, BOARD_CARD_SIZE_FACTORS, BOARD_DISPLAY_MODES, BOARD_EXPERIENCE_LEVELS, BOARD_ICON_PREFIXES, BOARD_ITEM_KINDS, BOARD_PLAYBACK_INSTRUMENTS, isTextCard } from "./types.js";
export { localStorageAdapter, memoryStorageAdapter } from "./storage.js";
export type { LocalStorageAdapterOptions } from "./storage.js";
export { exportBoardJson, importBoardJson, computeCacheKey } from "./io.js";
export type { BoardJsonV1, BoardItemJsonV1, BoardSchema } from "./io.js";
export { BOARD_SCHEMA, READABLE_BOARD_SCHEMAS } from "./io.js";
export { GRID_TRACKS, trackWidth, computeRowSpans, sizeFits } from "./layout.js";
export type { RowSpans } from "./layout.js";
export {
  fileToCardImage,
  imageBytesUsed,
  ImageTooLargeError,
  IMAGE_BUDGET_CHARS,
  MAX_UPLOAD_BYTES,
} from "./image.js";
export type { DownscaleOptions, DecodedImage, ImageDecoder } from "./image.js";
// BOARD_ICON_PREFIXES is exported above from ./types, which owns the list.
export { BoardIcon, BOARD_ICONS, isBoardIconId } from "./icons.js";
export type { BoardIconId, BoardIconDef, BoardIconProps } from "./icons.js";
