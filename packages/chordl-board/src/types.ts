/**
 * How a card draws itself. The first three map straight onto `PianoChord`'s
 * `display` prop; `"guitar"` selects the fretboard renderer instead.
 * Omitted means `"keyboard"` — which is what every pre-existing card is.
 */
export type BoardDisplayMode = "keyboard" | "staff" | "both" | "guitar";

export const BOARD_DISPLAY_MODES: readonly BoardDisplayMode[] = [
  "keyboard",
  "staff",
  "both",
  "guitar",
];

/**
 * What a card is. Absent means `"chord"` — every card saved before text cards
 * existed, so the discriminator needs no migration pass over stored boards.
 */
export type BoardItemKind = "chord" | "text";

export const BOARD_ITEM_KINDS: readonly BoardItemKind[] = ["chord", "text"];

/**
 * Values `BoardItem.level` accepts on import. Duplicated from chordl-guitar's
 * `ExperienceLevel` rather than imported, for the same reason `instrument` is
 * a bare string: the board carries no runtime dependency on that package's
 * union. Unlike `instrument`, which degrades to an instrument-config lookup
 * that already has to handle "not in the table", nothing downstream checks
 * `level` before using it — `LevelControl` renders it straight into a radio
 * `checked` comparison and `selectForExperience` interpolates it into a
 * user-facing string, so an unvalidated value here is not a graceful
 * fallback, it is a broken control and a nonsense message.
 */
export const BOARD_EXPERIENCE_LEVELS: readonly string[] = ["beginner", "emerging", "established"];
export const BOARD_PLAYBACK_INSTRUMENTS: readonly string[] = [
  "acoustic_grand_piano",
  "electric_guitar_clean",
  "ukulele",
];

/**
 * Prefixes an `icon` id may carry: `music:` for notation glyphs, `obj:` for
 * object icons. Shared with the icon module so the registry and the import
 * validator cannot drift apart.
 */
export const BOARD_ICON_PREFIXES: readonly string[] = ["music:", "obj:"];

/**
 * How much room a card takes, and how big it draws. `"rg"` is one column of the
 * board's grid — the size every card was before this existed, and the size a
 * card with no `size` still is.
 */
export type BoardCardSize = "sm" | "md" | "rg" | "lg" | "xl" | "2xl";

export const BOARD_CARD_SIZES: readonly BoardCardSize[] = ["sm", "md", "rg", "lg", "xl", "2xl"];

/**
 * Width of each size as a fraction of one column, which is also the factor its
 * diagram is drawn at — a card that takes twice the room draws twice the size,
 * or the extra width would be empty paper.
 *
 * The values are eighths and quarters on purpose: see `GRID_TRACKS`, which is
 * chosen so every one of them lands on a whole track at every column count the
 * board offers.
 */
export const BOARD_CARD_SIZE_FACTORS: Record<BoardCardSize, number> = {
  sm: 0.5,
  md: 0.75,
  rg: 1,
  lg: 1.5,
  xl: 2,
  "2xl": 3,
};

/** A single card on the board — a chord diagram, or text with an icon/image. */
export interface BoardItem {
  /** Stable identifier for keys and drag-drop. */
  id: string;
  /** What this card is. Absent means `"chord"`. */
  kind?: BoardItemKind;
  /**
   * NL chord string — required to render a chord card, and absent on a text
   * card, which has no chord at all. Optional in the type only so a text card
   * is constructible: consumers branch on `kind` first and never reach the
   * chord path for a text card, rather than null-checking `nl` everywhere.
   */
  nl?: string;
  /** How much room this card takes and how big it draws. Absent means `"rg"`. */
  size?: BoardCardSize;
  /** Optional title override (defaults to the resolved chord name). */
  title?: string;
  /** Optional muted subheading below the title. */
  subheading?: string;
  /** Optional footer text below all annotations. */
  footerText?: string;
  /** Renderer for this card. Defaults to `"keyboard"` when absent. */
  display?: BoardDisplayMode;
  /**
   * Fretted instrument for `display: "guitar"` — an `InstrumentId` from
   * chordl-guitar. Typed loosely so the board carries no runtime dependency
   * on that package's union; an unknown id falls back to the panel default.
   */
  instrument?: string;
  /**
   * Index into the chord's shape list for `display: "guitar"` — the A/B/C
   * position the user picked. Clamped at render time if the shape list is
   * shorter (e.g. after a chords-db update).
   */
  position?: number;
  /**
   * Difficulty filter on a chord's alternate shapes — "can I play this yet".
   * Typed loosely (a bare string), like `instrument`, so the board carries no
   * runtime dependency on chordl-guitar's `ExperienceLevel` union — but
   * unlike `instrument`, an unknown value is rejected outright at import
   * (`parseLevel` in io.ts checks it against `BOARD_EXPERIENCE_LEVELS`)
   * rather than left for a consumer to fall back on, because nothing
   * downstream actually does: it reaches a radio group's `checked` check and
   * a user-facing message unguarded. Unlike `instrument`/`position`, stored
   * regardless of `display`: only the guitar renderer reads it today, but a
   * piano voicing is expected to in a later PR, and a card saved before that
   * lands should not need a migration.
   */
  level?: string;
  /**
   * Opaque id of a hosted chord bundle for this card.
   *
   * Reserved, not used: nothing reads it today. Stored now for the same reason
   * `level` above is stored regardless of `display` — a board is exported to a
   * JSON file the user keeps, so a field added after those files exist forces
   * a migration on them. Validated on import all the same (`parseBundleId` in
   * io.ts), since it is a token an untrusted file supplies and a future reader
   * will put it in a URL. What a bundle actually contains is deliberately not
   * decided here.
   */
  bundleId?: string;
  /** Ordered MIDI pitches for the exact voicing captured in the editor. */
  playbackNotes?: number[];
  playbackInstrument?: string;
  arpeggioBpm?: number;
  playbackHighlightColor?: string;
  /** Icon id (e.g. `"music:trebleClef"`) shown above the text. Text cards only. */
  icon?: string;
  /**
   * Uploaded image as a data URI, so a JSON export stays a complete backup.
   * Text cards only, and mutually exclusive with `icon`.
   */
  image?: string;
  /**
   * Start a new row after this card. Layout only — it stays out of the render
   * cache key, since a break changes nothing about the card's image.
   */
  breakAfter?: boolean;
}

/** A card is a chord unless it explicitly says otherwise. */
export function isTextCard(item: BoardItem): boolean {
  return item.kind === "text";
}

/** Board-level metadata — title/subtitle/footer rendered around the chord grid. */
export interface BoardMeta {
  title?: string;
  subtitle?: string;
  footer?: string;
  /** Items per row. `undefined` (or "auto") falls back to flex-wrap. */
  columns?: number | "auto";
}

/** Persistence envelope — items plus board-level meta. */
export interface BoardState {
  items: BoardItem[];
  meta: BoardMeta;
}

/**
 * Persistence layer for a board. Default implementation uses localStorage;
 * callers can swap in any adapter (remote API, IndexedDB, etc.).
 *
 * `load` may return either the new envelope shape or a bare items array
 * (legacy schema); the hook normalizes both.
 *
 * `save` never throws: a board that cannot be persisted must keep working in
 * memory. An adapter that drops a write is expected to surface it some other
 * way (see `localStorageAdapter`'s `onError`) — losing work silently is worse
 * than an editing session that carries on.
 */
export interface StorageAdapter {
  load(): Promise<BoardState | BoardItem[]> | BoardState | BoardItem[];
  save(state: BoardState): Promise<void> | void;
}

/**
 * Most cards a row may hold.
 *
 * Five and six were offered and were a mistake: at a board's usual width they
 * shrink a chord diagram past the point where its fret numbers and note dots
 * stay readable, which is the whole job of the card. Four is the most that
 * still renders a legible diagram.
 *
 * A board saved at 5 or 6 is not clamped to 4 — `parseMeta` drops an
 * out-of-range count to `undefined`, so it reflows as "auto". Auto is the
 * default and lays out by card size rather than by a fixed count, which is a
 * truer answer than silently pretending the user asked for 4.
 */
export const MAX_COLUMNS = 4;
