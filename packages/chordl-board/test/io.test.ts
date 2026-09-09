import { describe, it, expect } from "vitest";
import {
  BOARD_SCHEMA,
  computeCacheKey,
  exportBoardJson,
  importBoardJson,
} from "../src/io";
import { isTextCard } from "../src/types";
import type { BoardState } from "../src/types";

const board = (items: BoardState["items"]): BoardState => ({ items, meta: {} });

/** Hand-rolled JSON standing in for an untrusted file the user picked. */
const rawBoard = (items: unknown[], schema = "chordl.board/v1"): string =>
  JSON.stringify({
    schema,
    exportedAt: "2026-08-12T00:00:00.000Z",
    meta: {},
    items,
  });

describe("board JSON round-trip", () => {
  it("preserves the four original card fields", async () => {
    const state = board([
      { id: "a", nl: "Cmaj7", title: "One", subheading: "tonic", footerText: "bar 1" },
    ]);
    const back = importBoardJson(await exportBoardJson(state));
    expect(back.items[0]).toMatchObject(state.items[0]);
  });

  it("preserves a card's display mode", async () => {
    const state = board([
      { id: "a", nl: "Cmaj7", display: "staff" },
      { id: "b", nl: "Dm7", display: "both" },
    ]);
    const back = importBoardJson(await exportBoardJson(state));
    expect(back.items.map((i) => i.display)).toEqual(["staff", "both"]);
  });

  it("preserves a guitar card's instrument and fret position", async () => {
    const state = board([
      { id: "a", nl: "Cmaj7", display: "guitar", instrument: "ukulele", position: 2 },
    ]);
    const back = importBoardJson(await exportBoardJson(state));
    expect(back.items[0]).toMatchObject({
      display: "guitar",
      instrument: "ukulele",
      position: 2,
    });
  });

  it("preserves a card's experience level, regardless of display mode", async () => {
    // Unlike instrument/position, `level` is stored whatever the display mode
    // is — the guitar renderer is the only current reader, but a piano
    // voicing is expected to read it in a later PR.
    const state = board([
      { id: "a", nl: "Cmaj7", display: "guitar", level: "beginner" },
      { id: "b", nl: "Dm7", level: "established" },
    ]);
    const back = importBoardJson(await exportBoardJson(state));
    expect(back.items.map((i) => i.level)).toEqual(["beginner", "established"]);
  });

  it("preserves an exact playback snapshot and presentation settings", async () => {
    const state = board([{
      id: "a",
      nl: "Cmaj7",
      playbackNotes: [48, 52, 55, 59],
      playbackInstrument: "electric_guitar_clean",
      arpeggioBpm: 96,
      playbackHighlightColor: "#ff8800",
    }]);
    const back = importBoardJson(await exportBoardJson(state));
    expect(back.items[0]).toMatchObject(state.items[0]);
  });

  it("drops malformed playback fields at import", () => {
    const back = importBoardJson(rawBoard([{
      id: "a", nl: "C", playbackNotes: [60, 128],
      playbackInstrument: "remote_sf2", arpeggioBpm: 0,
      playbackHighlightColor: "url(javascript:alert(1))",
    }], "chordl.board/v3"));
    expect(back.items[0].playbackNotes).toBeUndefined();
    expect(back.items[0].playbackInstrument).toBeUndefined();
    expect(back.items[0].arpeggioBpm).toBeUndefined();
    expect(back.items[0].playbackHighlightColor).toBeUndefined();
  });

  it("leaves the new fields undefined on a legacy card", async () => {
    const state = board([{ id: "a", nl: "Cmaj7" }]);
    const back = importBoardJson(await exportBoardJson(state));
    expect(back.items[0].display).toBeUndefined();
    expect(back.items[0].instrument).toBeUndefined();
    expect(back.items[0].position).toBeUndefined();
    expect(back.items[0].level).toBeUndefined();
  });

  it("drops an unrecognised display mode rather than trusting it", async () => {
    const json = JSON.stringify({
      schema: "chordl.board/v1",
      exportedAt: "2026-08-12T00:00:00.000Z",
      meta: {},
      items: [{ id: "a", nl: "Cmaj7", display: "banjo-tab" }],
    });
    expect(importBoardJson(json).items[0].display).toBeUndefined();
  });

  it("drops a non-integer or negative position", async () => {
    const json = JSON.stringify({
      schema: "chordl.board/v1",
      exportedAt: "2026-08-12T00:00:00.000Z",
      meta: {},
      items: [
        { id: "a", nl: "Cmaj7", display: "guitar", position: -1 },
        { id: "b", nl: "Dm7", display: "guitar", position: 1.5 },
        { id: "c", nl: "G7", display: "guitar", position: "2" },
      ],
    });
    expect(importBoardJson(json).items.map((i) => i.position)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("drops a non-string or empty instrument", async () => {
    const json = JSON.stringify({
      schema: "chordl.board/v1",
      exportedAt: "2026-08-12T00:00:00.000Z",
      meta: {},
      items: [
        { id: "a", nl: "Cmaj7", display: "guitar", instrument: "" },
        { id: "b", nl: "Dm7", display: "guitar", instrument: 42 },
        { id: "c", nl: "G7", display: "guitar", instrument: null },
      ],
    });
    expect(importBoardJson(json).items.map((i) => i.instrument)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("drops a non-string, empty, or unrecognised level", async () => {
    // Unlike `instrument`, an unrecognised `level` string is not a graceful
    // fallback for some consuming panel to catch — nothing downstream checks
    // it before use, so a value like "expert" would reach `LevelControl` with
    // no radio checked and `selectForExperience` with a nonsense value baked
    // into its "showing X instead" message.
    const json = JSON.stringify({
      schema: "chordl.board/v1",
      exportedAt: "2026-08-12T00:00:00.000Z",
      meta: {},
      items: [
        { id: "a", nl: "Cmaj7", level: "" },
        { id: "b", nl: "Dm7", level: 42 },
        { id: "c", nl: "G7", level: null },
        { id: "d", nl: "Am", level: "expert" },
      ],
    });
    expect(importBoardJson(json).items.map((i) => i.level)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("text cards", () => {
  it("round-trips kind, icon and breakAfter", async () => {
    const state = board([
      {
        id: "t",
        kind: "text",
        title: "Verse",
        subheading: "x2",
        footerText: "capo 2",
        icon: "music:trebleClef",
        breakAfter: true,
      },
    ]);
    const back = importBoardJson(await exportBoardJson(state));
    expect(back.items[0]).toMatchObject(state.items[0]);
    expect(isTextCard(back.items[0])).toBe(true);
  });

  it("round-trips an uploaded image", async () => {
    const image = "data:image/png;base64,iVBORw0KGgo=";
    const state = board([{ id: "t", kind: "text", title: "Chorus", image }]);
    const back = importBoardJson(await exportBoardJson(state));
    expect(back.items[0].image).toBe(image);
  });

  it("contributes no cache key and no render config", async () => {
    const json = JSON.parse(
      await exportBoardJson(board([{ id: "t", kind: "text", title: "Verse", breakAfter: true }])),
    );
    expect(json.items[0]).not.toHaveProperty("cacheKey");
    expect(json.items[0]).not.toHaveProperty("renderConfig");
  });

  it("accepts a text card with no chord but still rejects a chord card without one", () => {
    expect(() => importBoardJson(rawBoard([{ id: "t", kind: "text", title: "Verse" }]))).not.toThrow();
    expect(() => importBoardJson(rawBoard([{ id: "c", title: "no chord here" }]))).toThrow(/nl/);
    expect(() => importBoardJson(rawBoard([{ id: "c", kind: "chord", title: "x" }]))).toThrow(/nl/);
  });

  it("reads every card on a legacy board as a chord card", () => {
    const back = importBoardJson(rawBoard([{ id: "a", nl: "Cmaj7" }, { id: "b", nl: "Dm7" }]));
    expect(back.items.map(isTextCard)).toEqual([false, false]);
    expect(back.items.map((i) => i.kind)).toEqual([undefined, undefined]);
  });
});

describe("import degradation for text-card fields", () => {
  it("drops an unrecognised kind rather than trusting it", () => {
    const back = importBoardJson(rawBoard([{ id: "a", nl: "Cmaj7", kind: "sticker" }]));
    expect(back.items[0].kind).toBeUndefined();
    expect(isTextCard(back.items[0])).toBe(false);
  });

  it("drops a breakAfter that is not a boolean", () => {
    const back = importBoardJson(
      rawBoard([
        { id: "a", nl: "C", breakAfter: "true" },
        { id: "b", nl: "D", breakAfter: 1 },
        { id: "c", nl: "E", breakAfter: null },
        { id: "d", nl: "F", breakAfter: false },
        { id: "e", nl: "G", breakAfter: true },
      ]),
    );
    expect(back.items.map((i) => i.breakAfter)).toEqual([
      undefined,
      undefined,
      undefined,
      false,
      true,
    ]);
  });

  it("drops an icon with an unknown prefix", () => {
    const back = importBoardJson(
      rawBoard([
        { id: "a", kind: "text", icon: "sprite:../../etc/passwd" },
        { id: "b", kind: "text", icon: "trebleClef" },
        { id: "c", kind: "text", icon: 7 },
        { id: "d", kind: "text", icon: "music:trebleClef" },
        { id: "e", kind: "text", icon: "obj:guitar" },
      ]),
    );
    expect(back.items.map((i) => i.icon)).toEqual([
      undefined,
      undefined,
      undefined,
      "music:trebleClef",
      "obj:guitar",
    ]);
  });

  // `image` lands in a src attribute, so an imported board is a script-injection
  // vector unless everything but an inline image is refused.
  it("drops an image that is not an inline image data URI", () => {
    const back = importBoardJson(
      rawBoard([
        { id: "a", kind: "text", image: "javascript:alert(1)" },
        { id: "b", kind: "text", image: "data:text/html,<script>alert(1)</script>" },
        { id: "c", kind: "text", image: "https://example.com/x.png" },
        { id: "d", kind: "text", image: " data:image/png;base64,AAAA" },
        { id: "e", kind: "text", image: 42 },
        { id: "f", kind: "text", image: "data:image/png;base64,AAAA" },
      ]),
    );
    expect(back.items.map((i) => i.image)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "data:image/png;base64,AAAA",
    ]);
  });

  it("does not throw on any of the bogus optional fields", () => {
    expect(() =>
      importBoardJson(
        rawBoard([
          { id: "a", nl: "C", kind: 3, breakAfter: {}, icon: [], image: null },
        ]),
      ),
    ).not.toThrow();
  });
});

describe("render cache key", () => {
  const keys = async (items: BoardState["items"]) => {
    const json = JSON.parse(await exportBoardJson(board(items)));
    return json.items.map((i: { cacheKey?: string }) => i.cacheKey);
  };

  // ph-chordl caches rendered SVGs by this key. If the renderer isn't part of
  // it, a board's guitar frame and its keyboard diagram collide and one gets
  // served for the other.
  it("separates the same chord drawn by different renderers", async () => {
    const k = await keys([
      { id: "a", nl: "Cmaj7", display: "keyboard" },
      { id: "b", nl: "Cmaj7", display: "staff" },
      { id: "c", nl: "Cmaj7", display: "guitar", instrument: "guitar", position: 0 },
      { id: "d", nl: "Cmaj7", display: "guitar", instrument: "guitar", position: 1 },
      { id: "e", nl: "Cmaj7", display: "guitar", instrument: "ukulele", position: 0 },
    ]);
    expect(k.every(Boolean)).toBe(true);
    expect(new Set(k).size).toBe(5);
  });

  // A card saved before this feature has no display field, so its render_config
  // must stay exactly as it was or every cached render is invalidated on deploy.
  it("keeps a legacy card's render config free of the new fields", async () => {
    const json = JSON.parse(await exportBoardJson(board([{ id: "a", nl: "Cmaj7" }])));
    expect(json.items[0].renderConfig).toEqual({});
    expect(json.items[0].cacheKey).toBe(
      await computeCacheKey({ user_string: "Cmaj7", render_config: {} }),
    );
  });

  // Layout, not image content: two identical cards must share a cached render
  // whether or not a break follows one of them.
  it("keeps the text-card fields out of a chord card's render config", async () => {
    const json = JSON.parse(
      await exportBoardJson(
        board([
          { id: "a", nl: "Cmaj7", title: "One", breakAfter: true, kind: "chord" },
          { id: "b", nl: "Cmaj7", title: "One" },
        ]),
      ),
    );
    expect(json.items[0].renderConfig).toEqual({ title: "One" });
    expect(json.items[0].cacheKey).toBe(
      await computeCacheKey({ user_string: "Cmaj7", render_config: { title: "One" } }),
    );
    expect(json.items[0].cacheKey).toBe(json.items[1].cacheKey);
  });
});

describe("schema versioning", () => {
  it("writes v3 — the first version that preserves playback snapshots", async () => {
    const json = JSON.parse(await exportBoardJson(board([{ id: "a", nl: "Cmaj7" }])));
    expect(json.schema).toBe("chordl.board/v3");
    expect(BOARD_SCHEMA).toBe("chordl.board/v3");
  });

  it("still reads a v1 board written before text cards existed", () => {
    const back = importBoardJson(
      rawBoard([{ id: "a", nl: "Cmaj7", title: "One", display: "staff" }]),
    );
    expect(back.items).toHaveLength(1);
    expect(back.items[0]).toMatchObject({ id: "a", nl: "Cmaj7", title: "One", display: "staff" });
  });

  it("reads a v2 board carrying a text card", () => {
    const back = importBoardJson(
      rawBoard(
        [
          { id: "a", nl: "Cmaj7" },
          { id: "b", kind: "text", title: "Chorus", icon: "music:trebleClef" },
        ],
        "chordl.board/v2",
      ),
    );
    expect(back.items).toHaveLength(2);
    expect(isTextCard(back.items[1])).toBe(true);
    expect(back.items[1]).toMatchObject({ title: "Chorus", icon: "music:trebleClef" });
  });

  it("rejects a newer schema by saying a newer chordl is needed", () => {
    expect(() => importBoardJson(rawBoard([], "chordl.board/v4"))).toThrow(/newer chordl/);
  });

  it("round-trips its own export", async () => {
    const state = board([
      { id: "a", nl: "Cmaj7" },
      { id: "b", kind: "text", title: "Verse", breakAfter: true },
    ]);
    const back = importBoardJson(await exportBoardJson(state));
    expect(back.items).toHaveLength(2);
    expect(back.items[1]).toMatchObject({ kind: "text", title: "Verse", breakAfter: true });
  });
});

describe("importBoardJson — board meta", () => {
  const board = (meta: unknown) => JSON.stringify({
    schema: "chordl.board/v2",
    meta,
    items: [{ id: "a", nl: "C" }],
  });

  it("keeps a column count the settings offer", () => {
    expect(importBoardJson(board({ columns: 4 })).meta.columns).toBe(4);
    expect(importBoardJson(board({ columns: "auto" })).meta.columns).toBe("auto");
  });

  /** It reaches a CSS grid, where an unusable count renders cards as slivers. */
  it("drops a column count the layout cannot use", () => {
    for (const columns of [7, 0, -1, 2.5, "four", null]) {
      expect(importBoardJson(board({ columns })).meta.columns, String(columns)).toBeUndefined();
    }
  });

  it("keeps the rest of the meta when the count is dropped", () => {
    const meta = importBoardJson(board({ columns: 99, title: "Practice" })).meta;
    expect(meta.title).toBe("Practice");
    expect(meta.columns).toBeUndefined();
  });
});

describe("bundleId", () => {
  it("survives an export/import round trip", async () => {
    const state = board([{ id: "a", kind: "chord" as const, nl: "C", bundleId: "cdl-a1b2c3" }]);
    const back = importBoardJson(await exportBoardJson(state));
    expect(back.items[0].bundleId).toBe("cdl-a1b2c3");
  });

  it("drops a value that is not a URL-safe token", () => {
    const raw = JSON.stringify({
      schema: BOARD_SCHEMA,
      items: [{ id: "a", kind: "chord", nl: "C", bundleId: "not a token/../etc" }],
      meta: {},
    });
    expect(importBoardJson(raw).items[0].bundleId).toBeUndefined();
  });

  /** The 64-char cap is part of the rule, so an over-long token is junk too. */
  it("drops an empty or over-long token", () => {
    const withId = (bundleId: unknown) => JSON.stringify({
      schema: BOARD_SCHEMA,
      items: [{ id: "a", kind: "chord", nl: "C", bundleId }],
      meta: {},
    });
    expect(importBoardJson(withId("")).items[0].bundleId).toBeUndefined();
    expect(importBoardJson(withId("a".repeat(65))).items[0].bundleId).toBeUndefined();
    expect(importBoardJson(withId(42)).items[0].bundleId).toBeUndefined();
    expect(importBoardJson(withId("a".repeat(64))).items[0].bundleId).toBe("a".repeat(64));
  });

  /**
   * The traversal segments themselves. `"not a token/../etc"` above is
   * rejected on its spaces and its slash, so it never exercised the `..` the
   * rule claims to stop — and `.` and `..` are made *entirely* of characters
   * the unreserved-character class allows, so they sailed through. A field
   * whose first reader will put it in a path has to reject the two strings
   * that are a path instruction rather than a name.
   */
  it("drops the traversal segments, which are all-legal characters", () => {
    const withId = (bundleId: unknown) => JSON.stringify({
      schema: BOARD_SCHEMA,
      items: [{ id: "a", kind: "chord", nl: "C", bundleId }],
      meta: {},
    });
    expect(importBoardJson(withId(".")).items[0].bundleId).toBeUndefined();
    expect(importBoardJson(withId("..")).items[0].bundleId).toBeUndefined();
    expect(importBoardJson(withId("...")).items[0].bundleId).toBeUndefined();
    // A dot inside a name is still a name: only an all-dots token is a path.
    expect(importBoardJson(withId("cdl.v2")).items[0].bundleId).toBe("cdl.v2");
    expect(importBoardJson(withId(".hidden")).items[0].bundleId).toBe(".hidden");
  });
});
