import { BOARD_CARD_SIZES, BOARD_DISPLAY_MODES, BOARD_EXPERIENCE_LEVELS, BOARD_ICON_PREFIXES, BOARD_ITEM_KINDS, BOARD_PLAYBACK_INSTRUMENTS, MAX_COLUMNS, isTextCard } from "./types.js";
import type {
  BoardCardSize,
  BoardDisplayMode,
  BoardItem,
  BoardItemKind,
  BoardMeta,
  BoardState,
} from "./types.js";

export interface BoardItemJsonV1 extends BoardItem {
  /** sha256 cache key from ph-chordl computeCacheKey; carried for future lookup. */
  cacheKey?: string;
  /** Snapshot of the render config that produced `cacheKey`. */
  renderConfig?: Record<string, unknown>;
}

/**
 * Schema `exportBoardJson` writes. v3 is the first version that preserves an
 * exact playable voicing and its playback presentation settings.
 */
export const BOARD_SCHEMA = "chordl.board/v3";

/** Schemas `importBoardJson` accepts. v1 boards are chord-only and still read. */
export const READABLE_BOARD_SCHEMAS = ["chordl.board/v1", "chordl.board/v2", "chordl.board/v3"] as const;

export type BoardSchema = (typeof READABLE_BOARD_SCHEMAS)[number];

export interface BoardJsonV1 {
  schema: BoardSchema;
  exportedAt: string;
  meta: BoardMeta;
  items: BoardItemJsonV1[];
}

function normalizeRenderConfig(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeRenderConfig);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = normalizeRenderConfig((value as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return value;
}

/** Port of ph-chordl/src/lib/cacheKey.ts — sha256 over normalized {user_string, render_config}. */
export async function computeCacheKey(input: {
  user_string: string;
  render_config?: Record<string, unknown>;
}): Promise<string> {
  const normalized = {
    user_string: input.user_string.trim().toLowerCase(),
    render_config: normalizeRenderConfig(input.render_config ?? {}),
  };
  const data = new TextEncoder().encode(JSON.stringify(normalized));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function exportBoardJson(state: BoardState): Promise<string> {
  const items: BoardItemJsonV1[] = await Promise.all(
    state.items.map(async (it) => {
      // A text card draws no chord, so there is nothing to cache and nothing a
      // renderer could be configured with — emitting an empty key/config would
      // invite a consumer to look one up.
      if (isTextCard(it)) return { ...it };
      const renderConfig: Record<string, unknown> = {};
      if (it.title !== undefined) renderConfig.title = it.title;
      if (it.subheading !== undefined) renderConfig.subheading = it.subheading;
      if (it.footerText !== undefined) renderConfig.footerText = it.footerText;
      // Renderer identity belongs in the cache key: the same `nl` drawn as a
      // guitar frame and as a keyboard are different images, and a key that
      // ignored `display` would serve one for the other.
      if (it.display !== undefined) renderConfig.display = it.display;
      // Size is drawn, not just laid out: the same chord at "sm" and at "xl" is
      // a different image, so a key that ignored it would serve one for the
      // other.
      if (it.size !== undefined) renderConfig.size = it.size;
      if (it.instrument !== undefined) renderConfig.instrument = it.instrument;
      if (it.position !== undefined) renderConfig.position = it.position;
      // `level` is deliberately absent here, unlike every other field above
      // it: today every card that reaches this point has `showControls={false}`
      // in the renderer, which bypasses the level filter entirely, so `level`
      // affects nothing about the drawn image and does not belong in a cache
      // key. That stops being true the moment a renderer actually reads
      // `level` (the piano voicing this field is stored for) — at that point
      // the cache key for every existing card silently becomes wrong (two
      // different levels of the same chord would collide on one cached
      // image) unless this line is added then, not before.
      let cacheKey: string | undefined;
      try {
        // `nl` is optional on the type so a text card is constructible; a chord
        // card that somehow lost it is malformed, not cacheable.
        if (it.nl !== undefined) {
          cacheKey = await computeCacheKey({ user_string: it.nl, render_config: renderConfig });
        }
      } catch {
        // crypto.subtle unavailable (non-secure context) — skip the hash.
      }
      return { ...it, cacheKey, renderConfig };
    }),
  );
  const payload: BoardJsonV1 = {
    schema: BOARD_SCHEMA,
    exportedAt: new Date().toISOString(),
    meta: state.meta,
    items,
  };
  return JSON.stringify(payload, null, 2);
}

/** Imported JSON is untrusted — an unrecognised mode degrades to the default. */
function parseDisplayMode(value: unknown): BoardDisplayMode | undefined {
  return BOARD_DISPLAY_MODES.includes(value as BoardDisplayMode)
    ? (value as BoardDisplayMode)
    : undefined;
}

function parsePosition(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function parseSize(value: unknown): BoardCardSize | undefined {
  return BOARD_CARD_SIZES.includes(value as BoardCardSize) ? (value as BoardCardSize) : undefined;
}

function parseKind(value: unknown): BoardItemKind | undefined {
  return BOARD_ITEM_KINDS.includes(value as BoardItemKind) ? (value as BoardItemKind) : undefined;
}

/**
 * Unlike `instrument`, an unrecognised `level` isn't left for a consuming
 * panel to fall back on — nothing downstream actually does that: it reaches
 * `LevelControl`'s `checked` comparison (no radio checked) and
 * `selectForExperience`'s user-facing "showing X instead" string (a nonsense
 * value in a sentence a player reads) unguarded. So it's validated here,
 * against the same rungs chordl-guitar's `ExperienceLevel` defines.
 */
function parseLevel(value: unknown): string | undefined {
  return typeof value === "string" && BOARD_EXPERIENCE_LEVELS.includes(value) ? value : undefined;
}

/**
 * A bundle id is opaque to this package, so there is nothing to check it
 * against — only its shape. The rule is URL-safe unreserved characters
 * (RFC 3986) capped at 64: nothing reads the field yet, but the first reader
 * will put it in a path or a query string, and letting an untrusted file
 * smuggle a `/`, a `?` or a `..` through to that point is how a reserved
 * field becomes a traversal. Rejected outright rather than escaped later,
 * because "later" is a place this validator cannot see.
 */
function parseBundleId(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9._~-]{1,64}$/.test(value) ? value : undefined;
}

function parsePlaybackNotes(value: unknown): number[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value.every((note) => typeof note === "number" && Number.isInteger(note) && note >= 0 && note <= 127)
    ? [...value]
    : undefined;
}

function parsePlaybackInstrument(value: unknown): string | undefined {
  return typeof value === "string" && BOARD_PLAYBACK_INSTRUMENTS.includes(value)
    ? value
    : undefined;
}

function parseArpeggioBpm(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 40 && value <= 300
    ? value
    : undefined;
}

function parsePlaybackHighlightColor(value: unknown): string | undefined {
  return typeof value === "string" && /^#[0-9a-f]{3,4}(?:[0-9a-f]{3,4})?$/i.test(value)
    ? value
    : undefined;
}

/** Only a real boolean: truthy-coercing `"false"` or `0` invents a layout. */
function parseBreakAfter(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** An id, not a path or a glyph — anything outside the known namespaces is junk. */
function parseIcon(value: unknown): string | undefined {
  return typeof value === "string" && BOARD_ICON_PREFIXES.some((p) => value.startsWith(p))
    ? value
    : undefined;
}

/**
 * Security boundary: an imported board is untrusted and `image` ends up in a
 * `src`. Only an inline image passes — `data:text/html`, `javascript:` and
 * remote URLs are all ways to make a card fetch or execute something.
 */
function parseImage(value: unknown): string | undefined {
  return typeof value === "string" && value.startsWith("data:image/") ? value : undefined;
}

/**
 * Imported meta is as untrusted as an imported item. `columns` reaches a CSS
 * grid, where a count the layout cannot divide evenly renders every card as a
 * sliver — so anything outside what the settings offer becomes "auto". That
 * now includes 5 and 6, which the settings used to offer: a board saved at
 * either reflows as "auto" rather than being clamped to 4.
 */
function parseMeta(value: unknown): BoardMeta {
  const raw = (value ?? {}) as BoardMeta;
  const columns = raw.columns;
  const usable = columns === "auto"
    || (typeof columns === "number" && Number.isInteger(columns) && columns >= 1 && columns <= MAX_COLUMNS);
  return usable ? raw : { ...raw, columns: undefined };
}

export function importBoardJson(text: string): BoardState {
  const parsed = JSON.parse(text) as Partial<BoardJsonV1>;
  if (!parsed || !READABLE_BOARD_SCHEMAS.includes(parsed.schema as BoardSchema)) {
    throw new Error(
      `Unsupported board JSON: expected one of ${READABLE_BOARD_SCHEMAS.join(", ")}, got ` +
        `'${parsed?.schema}'. A board saved by a newer chordl needs a newer chordl to open it.`,
    );
  }
  if (!Array.isArray(parsed.items)) {
    throw new Error("Invalid board JSON: 'items' must be an array");
  }
  const items: BoardItem[] = parsed.items.map((raw) => {
    const kind = raw ? parseKind(raw.kind) : undefined;
    // A chord card is unrenderable without `nl`, so that stays fatal — but a
    // text card has no chord to require.
    if (!raw || (kind !== "text" && typeof raw.nl !== "string")) {
      throw new Error("Invalid board JSON: each item requires an 'nl' string");
    }
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : `chord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      kind,
      nl: typeof raw.nl === "string" ? raw.nl : undefined,
      title: raw.title,
      subheading: raw.subheading,
      footerText: raw.footerText,
      display: parseDisplayMode(raw.display),
      instrument: typeof raw.instrument === "string" && raw.instrument ? raw.instrument : undefined,
      position: parsePosition(raw.position),
      level: parseLevel(raw.level),
      playbackNotes: parsePlaybackNotes(raw.playbackNotes),
      playbackInstrument: parsePlaybackInstrument(raw.playbackInstrument),
      arpeggioBpm: parseArpeggioBpm(raw.arpeggioBpm),
      playbackHighlightColor: parsePlaybackHighlightColor(raw.playbackHighlightColor),
      bundleId: parseBundleId(raw.bundleId),
      icon: parseIcon(raw.icon),
      image: parseImage(raw.image),
      size: parseSize(raw.size),
      breakAfter: parseBreakAfter(raw.breakAfter),
    };
  });
  return { items, meta: parseMeta(parsed.meta) };
}
