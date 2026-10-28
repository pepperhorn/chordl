# Board-wide card style (chordl-react 0.5.1, chordl-board 0.2.2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A host passes one `cardStyle` (colour theme plus note-name defaults) to `ChordBoard`, `BoardPlayer` or `BoardEditor`, and every keyboard card on the board renders with it, while a card's own NL settings still win.

**Architecture:** `PianoChord` gains three optional note-name props that act as defaults under the NL, resolved by one pure function `resolveNoteNames` so all four keyboard render branches and the degree-label logic read the same answer. `chordl-board` adds a `cardStyle.ts` module (`BoardCardStyle`, `normalizeCardStyle`, `cardStyleChordProps`, `cardStyleRenderConfig`). Every entry point normalises the prop and threads it to `BoardCardContent`, which spreads it onto `PianoChord`. `exportBoardJson` takes it as an optional second argument and folds it into `renderConfig.cardStyle` so the JSON cache key describes the image. `BoardEditor` starts its Theme pill and Note names controls from the style, and serialises only the note-name settings that differ from it, so cards never bake the board's style into their NL.

**Tech Stack:** React 19, TypeScript 5.7 (`moduleResolution: "bundler"`), Vitest 4 with jsdom and @testing-library/react, pnpm 10 workspaces.

**Spec:** the design recorded in the request for this plan (2026-10-29): hosts (crf-staff message editor, becreative family site) store a per-board card style on a CMS block and pass it in. Decisions 1–4 of that request are restated in Global Constraints.

## Global Constraints

- Node 22 for every command: `export PATH=$HOME/.nvm/versions/node/v22.22.1/bin:$PATH` once per shell. Order: `pnpm build` before any `lint` / `test:run` (packages resolve each other from `dist`). Board tests see `chordl-react` changes only after `pnpm --filter @pepperhorn/chordl-react build`.
- The jsdom "Not implemented: navigation" stack trace in board test output is pre-existing noise, not a failure.
- Branch `feat/board-card-style` off `origin/main` (`8e58073`, the merge of #83). `/home/shaun/chordl`'s local `main` is behind `origin/main` (it is at #82): `git fetch origin && git switch -c feat/board-card-style origin/main`.
- Versions: `@pepperhorn/chordl-react` 0.5.0 → 0.5.1, `@pepperhorn/chordl-board` 0.2.1 → 0.2.2. `chordl-core` (0.5.2), `chordl-guitar`, `chordl-cards` are not bumped. chordl-board's `package.json` keeps `"@pepperhorn/chordl-react": "workspace:*"`; `pnpm publish` rewrites it to the exact `0.5.1`. Hosts pin exact versions, no caret.
- `chordl-react` props, all optional, on `ChordProps` (`packages/chordl-react/src/types.ts`) and `VoicingVariantToggleProps`: `showNoteNames?: boolean`, `noteNameSize?: TextSize`, `noteNameMode?: NoteNameMode` (types from `@pepperhorn/chordl-core`). Absent = today's output, byte for byte.
- NL cannot say "no note names": the core parser only ever sets `showNoteNames = true` or leaves it `undefined` (`natural-language.ts:498-516, 795`). So a board style that turns note names on cannot be turned off by one card. This is documented, and the editor locks its toggle on in that case (Task 4).
- Precedence (`resolveNoteNames`, Task 1), with `parsed` from `parseChordDescription` and `d` the props:
  - NL asked for names (`parsed.showNoteNames === true && parsed.noteNameMode !== "degree"`), or `d.showNoteNames !== true`: `{ showNoteNames: parsed.showNoteNames, noteNameMode: parsed.noteNameMode, noteNameSize: parsed.noteNameSize ?? d.noteNameSize }`. The NL keeps its own mode; an NL "with note names" that gave no size takes the default size.
  - Otherwise (props turn names on; NL has none, or degrees only): `showNoteNames: true`, `noteNameSize: parsed.noteNameSize ?? d.noteNameSize`, `noteNameMode`: base `d.noteNameMode ?? "pitch-class"`; if `parsed.noteNameMode === "degree"`, base `"pitch-class"` → `"pitch-class+degree"`, `"midi"` → `"midi+degree"`, any mode already containing `degree` unchanged.
- Theme precedence is unchanged: `parsed.colorTheme ?? themeProp` (`PianoChord.tsx:86`). NL theme words: `boomwhacker(s)`, `crf`, `rainbow` (→ `crf`).
- Board type, exported from the package root:
  ```ts
  export type BoardCardTheme = "simple" | "crf" | "boomwhacker";
  export interface BoardCardStyle {
    theme?: BoardCardTheme;
    showNoteNames?: boolean;
    noteNameSize?: TextSize;            // "base" | "lg" | "xl" | "2xl"
    noteNameMode?: "pitch-class" | "midi";
  }
  ```
  `noteNameMode` is narrowed from `NoteNameMode` on purpose: the editor's form only offers pitch class and MIDI, and degrees stay a per-card choice.
- `normalizeCardStyle(value: unknown): BoardCardStyle`: a non-null, non-array object, else `{}`. Keeps `theme` only if exactly one of `"simple" | "crf" | "boomwhacker"` (no case folding, no `"rainbow"`), `showNoteNames` only if `typeof === "boolean"`, `noteNameSize` only if one of the four `TextSize` values, `noteNameMode` only if `"pitch-class" | "midi"`. Builds a fresh object; never writes a key whose value is `undefined`; drops all other keys silently.
- `"simple"` passes no `theme` prop (today's look, `#a0c6e8`). Guitar cards (`display: "guitar"`) get nothing from the style: `GuitarChordPanel` has no colour theme or note-name props. Staff-only cards (`display: "staff"`) draw no keyboard, so the style changes nothing there either. `display: "both"` gets it through its keyboard.
- The style is never stored in board JSON fields or `BoardMeta`; schema stays `chordl.board/v3`. It appears only inside the derived `renderConfig.cardStyle` snapshot of an exported chord card (see Task 2), which `importBoardJson` already ignores.
- Cache key: `exportBoardJson(state, { cardStyle })` adds `renderConfig.cardStyle = cardStyleRenderConfig(item, style)` only when that is non-empty. It is empty for guitar and staff-only cards and drops `theme: "simple"`. With no style, `{}`, or `{ theme: "simple" }`, every `cacheKey` is byte-identical to 0.2.1. Reason: the key exists to name a rendered image, and a CRF card with xl names is a different image. Only `ChordBoard`'s JSON export calls it with a style.
- PNG/PDF export captures `ChordBoard`'s DOM, so it inherits the style with no code change.
- The editor never writes `cardStyle` anywhere; the host owns it.
- Class names on new elements follow the `chordl-board-*` convention. Comments explain why, matching surrounding density. Relative imports in `chordl-board/src` keep explicit `.js` extensions (`test/esm-specifiers.test.ts`).
- Release is local-only (Task 5). The human publishes by hand; no tags are pushed (pushing `chordl-react@0.5.1` / `chordl-board@0.2.2` tags would also trigger `release.yml`).

## Review Focus

1. **A degrees-only card on a board with note names on.** NL "C with degrees" parses to `showNoteNames: true, noteNameMode: "degree"`, which looks like "the card set its own names". Expected: board names plus the card's degrees, not degrees replacing names. Test in Task 1: "adds the default note names under a degrees-only chord".
2. **Opening an existing card for editing on a styled board.** The live-edit mirror effect writes `chordCardFields` as soon as `editingItemId` is set. If the form loads the board's names and serialises them, merely opening card "C" rewrites it to "C note names in xl". Expected: `nl` unchanged. Test in Task 4: "opening a card on a styled board leaves its chord text alone".
3. **A host that passes a fresh `cardStyle` object every render, or loads it after mount.** Expected: no reset of a form the user has changed while the values are unchanged; a late-arriving style still reaches the pills; an open card's note names are not overwritten by a resync. Tests in Task 4: "picks up a cardStyle that arrives after mount" and "a new cardStyle object with the same values leaves the form alone".
4. **Untrusted CMS values** (`"true"`, `"CRF"`, `"rainbow"`, `null`, an array, a JSON string, `noteNameMode: "degree"`). Expected: ignored, never a crash, never a partial style with `undefined` keys. Tests in Task 2 ("drops anything it does not recognise") and Task 3 ("renders an invalid cardStyle like none").
5. **Existing boards' cache keys.** A host that upgrades without passing a style must see identical `cacheKey`s. Test in Task 2: "leaves cache keys unchanged without a style or with simple".

---

### Task 1: Note-name default props in chordl-react

**Files:**
- Create: `packages/chordl-react/src/note-name-defaults.ts`
- Modify: `packages/chordl-react/src/types.ts:114-160` (`ChordProps`: the three props, doc: "Default when the chord text does not set it; the text wins. Text cannot turn names off.")
- Modify: `packages/chordl-react/src/components/PianoChord.tsx` (destructure at :40 as `showNoteNames: showNoteNamesProp, noteNameSize: noteNameSizeProp, noteNameMode: noteNameModeProp`; after :86 compute `const names = resolveNoteNames(parsed, {…props})`; replace every `parsed.showNoteNames` / `parsed.noteNameSize` / `parsed.noteNameMode` at :188-191, :375-378, :543, :798-801, :1061-1064 with `names.*`)
- Modify: `packages/chordl-react/src/components/VoicingVariantToggle.tsx` (props at :20-63, pass the three through at both `<PianoChord>` sites :252 and :311)
- Test: `packages/chordl-react/test/note-name-defaults.test.ts`, `packages/chordl-react/test/PianoChord.card-defaults.test.tsx`

**Interfaces:**
- Consumes: `ParsedChordRequest`, `TextSize`, `NoteNameMode` from `@pepperhorn/chordl-core`.
- Produces: `export interface NoteNameDefaults { showNoteNames?: boolean; noteNameSize?: TextSize; noteNameMode?: NoteNameMode }` and `export function resolveNoteNames(parsed: Pick<ParsedChordRequest, "showNoteNames" | "noteNameSize" | "noteNameMode">, defaults: NoteNameDefaults): NoteNameDefaults` (module-internal; not added to `src/index.ts`). The public surface is the three `PianoChord` / `VoicingVariantToggle` props.

- [ ] **Step 1: Write the failing tests.** `test/note-name-defaults.test.ts`, one `it` per row (`p` = parsed, `d` = defaults, expected result):

```ts
it.each([
  ["no defaults leaves the NL alone", {}, {}, { showNoteNames: undefined, noteNameMode: undefined, noteNameSize: undefined }],
  ["defaults turn names on", {}, { showNoteNames: true, noteNameSize: "xl" }, { showNoteNames: true, noteNameMode: "pitch-class", noteNameSize: "xl" }],
  ["default mode is used", {}, { showNoteNames: true, noteNameMode: "midi" }, { showNoteNames: true, noteNameMode: "midi", noteNameSize: undefined }],
  ["NL size wins", { showNoteNames: true, noteNameSize: "base" }, { showNoteNames: true, noteNameSize: "xl" }, { showNoteNames: true, noteNameMode: undefined, noteNameSize: "base" }],
  ["NL without size takes the default size", { showNoteNames: true }, { noteNameSize: "2xl" }, { showNoteNames: true, noteNameMode: undefined, noteNameSize: "2xl" }],
  ["NL mode wins", { showNoteNames: true, noteNameMode: "midi" }, { showNoteNames: true, noteNameMode: "pitch-class" }, { showNoteNames: true, noteNameMode: "midi", noteNameSize: undefined }],
  ["degrees-only NL gains default names", { showNoteNames: true, noteNameMode: "degree" }, { showNoteNames: true }, { showNoteNames: true, noteNameMode: "pitch-class+degree", noteNameSize: undefined }],
  ["degrees-only NL with midi default", { showNoteNames: true, noteNameMode: "degree" }, { showNoteNames: true, noteNameMode: "midi" }, { showNoteNames: true, noteNameMode: "midi+degree", noteNameSize: undefined }],
  ["degrees-only NL, names off", { showNoteNames: true, noteNameMode: "degree" }, { showNoteNames: false }, { showNoteNames: true, noteNameMode: "degree", noteNameSize: undefined }],
])("%s", (_, p, d, want) => expect(resolveNoteNames(p, d)).toEqual(want));
```

`test/PianoChord.card-defaults.test.tsx`, reusing the `fontOf` helper shape from `PianoKeyboard.degree-size.test.tsx` and `fills = [...container.querySelectorAll("rect")].map(r => r.getAttribute("fill"))`:
- "draws no note names without props or NL": `<PianoChord chord="C" />` has no `.bc-note-name`.
- "draws default note names on a plain chord": `chord="C" showNoteNames noteNameSize="xl"` → `.bc-note-name` count 3, and its font equals `chord="C note names in xl"`'s.
- "the chord's own size wins": `chord="C note names in base" showNoteNames noteNameSize="xl"` font equals `chord="C note names in base"`'s, and is less than the xl one.
- "an NL without a size takes the default size": `chord="C with note names" noteNameSize="xl"` font equals `chord="C note names in xl"`'s.
- "default MIDI mode labels octaves": `chord="C" showNoteNames noteNameMode="midi"` → every `.bc-note-name` text matches `/\d$/`.
- "the chord's MIDI request wins over a pitch-class default": `chord="C midi note names" showNoteNames noteNameMode="pitch-class"` → texts match `/\d$/`.
- "adds the default note names under a degrees-only chord": `chord="C with degrees" showNoteNames` → both `.bc-note-name` and `.bc-degree-label` present (3 each).
- One test per remaining keyboard branch, each `showNoteNames` only, asserting `.bc-note-name` present: scale `"C major scale"` (≥ 7), bass `"C/F"`, hand groups `"Rh c d e LH c e"`, `display="both"` on `"C"` (inside `.bc-display-both`).
- "staff-only draws no note names": `chord="C" display="staff" showNoteNames` → no `.bc-note-name` (pins the documented limit).
- "theme prop colours the keys and the NL theme still wins": `chord="C" theme="crf"` fills contain `#f86e6e`; `chord="C boomwhacker" theme="crf"` fills contain `#e81c1c` and not `#f86e6e`.
- "VoicingVariantToggle passes the defaults through": `<VoicingVariantToggle chord="C" showNoteNames noteNameSize="xl" />` has `.bc-note-name`.

- [ ] **Step 2: Run to verify the failures**

Run: `pnpm --filter @pepperhorn/chordl-react exec vitest run test/note-name-defaults.test.ts test/PianoChord.card-defaults.test.tsx`
Expected: FAIL — `resolveNoteNames` module missing; the prop-driven cases find no `.bc-note-name`. The no-props, staff-only and theme cases already pass (pins).

- [ ] **Step 3: Implement** `resolveNoteNames` per Global Constraints, the `ChordProps` / `VoicingVariantToggleProps` fields, and the `names.*` substitution in `PianoChord.tsx`. `ChordGroup` (the "all inversions" branch, :419) takes no note-name props today and is left alone.

- [ ] **Step 4: Run the package's tests and lint**

Run: `pnpm --filter @pepperhorn/chordl-react exec vitest run && pnpm --filter @pepperhorn/chordl-react lint`
Expected: PASS, including the existing `PianoKeyboard.degree-size` and `PianoChord.rotated-degrees` suites unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-react/src/note-name-defaults.ts packages/chordl-react/src/types.ts packages/chordl-react/src/components/PianoChord.tsx packages/chordl-react/src/components/VoicingVariantToggle.tsx packages/chordl-react/test/note-name-defaults.test.ts packages/chordl-react/test/PianoChord.card-defaults.test.tsx
git commit -m "feat(react): note-name default props on PianoChord, text still wins"
```

---

### Task 2: `BoardCardStyle`, `normalizeCardStyle` and the export cache key

**Files:**
- Create: `packages/chordl-board/src/cardStyle.ts`
- Modify: `packages/chordl-board/src/io.ts:65` (`exportBoardJson` second parameter; after the `frameLineStyle` line, add `renderConfig.cardStyle` when non-empty, with a one-line comment: it changes the drawn image, and is a snapshot, not a stored setting)
- Modify: `packages/chordl-board/src/index.ts` (export `normalizeCardStyle`, `BOARD_CARD_THEMES`; types `BoardCardStyle`, `BoardCardTheme`)
- Test: `packages/chordl-board/test/card-style.test.ts`, `packages/chordl-board/test/io.test.ts` (new `describe("cardStyle in the cache key", …)`)

**Interfaces:**
- Consumes: `TextSize`, `NoteNameMode` from `@pepperhorn/chordl-core`; `BoardItem`, `isTextCard` from `./types.js`.
- Produces, in `src/cardStyle.ts`:
  - `export const BOARD_CARD_THEMES = ["simple", "crf", "boomwhacker"] as const;` `export type BoardCardTheme = (typeof BOARD_CARD_THEMES)[number];` and `BoardCardStyle` exactly as in Global Constraints.
  - `export function normalizeCardStyle(value: unknown): BoardCardStyle`
  - `export function cardStyleChordProps(style: BoardCardStyle): { theme?: string; showNoteNames?: boolean; noteNameSize?: TextSize; noteNameMode?: NoteNameMode }` — `theme` omitted for `"simple"`; other keys copied only when defined.
  - `export function cardStyleRenderConfig(item: BoardItem, style: BoardCardStyle): Partial<BoardCardStyle>` — `{}` for text cards, `display === "guitar"` and `display === "staff"`; otherwise `cardStyleChordProps(style)`'s keys.
  - `export const DEFAULT_NOTE_NAME_SIZE: TextSize = "lg";` (comment: `PianoKeyboard`'s own default, so the editor can tell when a card's size matches what the board draws).
  - `exportBoardJson(state: BoardState, opts?: { cardStyle?: BoardCardStyle }): Promise<string>`; it calls `normalizeCardStyle(opts?.cardStyle)` itself.

- [ ] **Step 1: Write the failing tests.** `test/card-style.test.ts`:

```ts
it("keeps a full valid style", () => {
  const s = { theme: "crf", showNoteNames: true, noteNameSize: "xl", noteNameMode: "midi" };
  expect(normalizeCardStyle(s)).toEqual(s);
  expect(normalizeCardStyle(s)).not.toBe(s);
});
it("returns {} for anything that is not an object", () => {
  for (const v of [undefined, null, "crf", '{"theme":"crf"}', 5, true, ["crf"]]) expect(normalizeCardStyle(v)).toEqual({});
});
it("drops anything it does not recognise", () => {
  const out = normalizeCardStyle({ theme: "CRF", showNoteNames: "true", noteNameSize: "xxl", noteNameMode: "degree", colour: "red" });
  expect(out).toEqual({});
  expect(Object.keys(out)).toEqual([]);
  expect(normalizeCardStyle({ theme: "rainbow" })).toEqual({});
  expect(normalizeCardStyle({ showNoteNames: false })).toEqual({ showNoteNames: false });
});
it("never writes undefined keys", () => {
  expect(Object.keys(normalizeCardStyle({ theme: "boomwhacker", noteNameSize: undefined }))).toEqual(["theme"]);
});
it("maps simple to no theme prop", () => {
  expect(cardStyleChordProps({ theme: "simple", showNoteNames: true })).toEqual({ showNoteNames: true });
  expect(cardStyleChordProps({ theme: "crf" })).toEqual({ theme: "crf" });
});
it("gives guitar, staff-only and text cards no render config", () => {
  const s = { theme: "crf", showNoteNames: true } as const;
  expect(cardStyleRenderConfig({ id: "g", nl: "C", display: "guitar" }, s)).toEqual({});
  expect(cardStyleRenderConfig({ id: "s", nl: "C", display: "staff" }, s)).toEqual({});
  expect(cardStyleRenderConfig({ id: "t", kind: "text", title: "x" }, s)).toEqual({});
  expect(cardStyleRenderConfig({ id: "b", nl: "C", display: "both" }, s)).toEqual(s);
});
```

In `test/io.test.ts`, `describe("cardStyle in the cache key", …)` using the file's `board()` helper:
- "leaves cache keys unchanged without a style or with simple": for `undefined`, `{}`, `{ theme: "simple" }` and `{ theme: "nope" }`, `items[0].cacheKey` equals the plain `exportBoardJson(state)` key and `renderConfig` has no `cardStyle` property.
- "splits the key for a styled keyboard card": `{ theme: "crf", showNoteNames: true, noteNameSize: "xl" }` → different `cacheKey`; `renderConfig.cardStyle` equals `{ theme: "crf", showNoteNames: true, noteNameSize: "xl" }`.
- "does not touch guitar cards": a `display: "guitar"` item keeps its plain key.
- "is not read back on import": `importBoardJson(styledJson).items[0]` has no `cardStyle` / `renderConfig` key and `meta` is unchanged.

- [ ] **Step 2: Run to verify the failures**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/card-style.test.ts test/io.test.ts`
Expected: FAIL — `../src/cardStyle.js` not found; "splits the key" fails. The unchanged-key and import cases pass (pins).

- [ ] **Step 3: Implement** `src/cardStyle.ts`, the `exportBoardJson` parameter and the index exports.

- [ ] **Step 4: Run tests and lint**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/card-style.test.ts test/io.test.ts && pnpm --filter @pepperhorn/chordl-board lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/cardStyle.ts packages/chordl-board/src/io.ts packages/chordl-board/src/index.ts packages/chordl-board/test/card-style.test.ts packages/chordl-board/test/io.test.ts
git commit -m "feat(board): BoardCardStyle with normalizeCardStyle, folded into the export cache key"
```

---

### Task 3: `cardStyle` on `ChordBoard` and `BoardPlayer`

Requires Task 1 built: `pnpm --filter @pepperhorn/chordl-react build`.

**Files:**
- Modify: `packages/chordl-board/src/ChordBoard.tsx` — `BoardCardContent` (:104) gains `cardStyle?: BoardCardStyle` and spreads `cardStyleChordProps(cardStyle ?? {})` onto `<PianoChord>` (:175) only; the guitar branch (:148) gets a comment that `GuitarChordPanel` has no theme or note-name props. `ChordBoardProps` (:528) gains `cardStyle?: BoardCardStyle` (doc: board-wide defaults for every keyboard card; a card's own text wins; never saved in the board). `ChordBoard` normalises once per render (`const style = normalizeCardStyle(cardStyle)`), passes it at :1374, and `handleExportJson` (:808) calls `exportBoardJson({ items, meta: safeMeta }, { cardStyle: style })`.
- Modify: `packages/chordl-board/src/BoardPlayer.tsx` — `BoardPlayerProps` (:101) gains the same prop; normalise and pass at :542.
- Modify: `scripts/verify-board-package.mjs` — consumer `App.tsx` imports `normalizeCardStyle` and passes `cardStyle={normalizeCardStyle({ theme: "crf", showNoteNames: true, noteNameSize: "xl" })}` to both `BoardEditor` and `BoardPlayer`; `smoke.mjs` renders `BoardPlayer` with `cardStyle: { showNoteNames: true }` and asserts the HTML includes `bc-note-name`.
- Test: `packages/chordl-board/test/card-style-render.test.tsx`

**Interfaces:**
- Consumes: `BoardCardStyle`, `normalizeCardStyle`, `cardStyleChordProps` (Task 2); `PianoChord` note-name props (Task 1).
- Produces: `ChordBoardProps.cardStyle?: BoardCardStyle`, `BoardPlayerProps.cardStyle?: BoardCardStyle`.

- [ ] **Step 1: Write the failing tests** in `test/card-style-render.test.tsx`. Helpers: `cardFills(c, id)` = fills of `[data-board-id="${id}"] rect`; `nameFont(c, id)` = parsed `style.fontSize` of the first `[data-board-id="${id}"] .bc-note-name` (throw if missing).
- "draws every keyboard card with the board's theme": `<ChordBoard items={[{id:"a",nl:"C"},{id:"b",nl:"F"}]} cardStyle={{ theme: "crf" }} />` → `cardFills(a)` contains `#f86e6e`; `cardFills(b)` contains `#b3f888` (CRF's F). Neither contains `#a0c6e8`.
- "simple draws today's colours": `cardStyle={{ theme: "simple" }}` → `cardFills(a)` contains `#a0c6e8`, not `#f86e6e`.
- "draws note names at the board size": `cardStyle={{ showNoteNames: true, noteNameSize: "xl" }}` → `nameFont(a)` equals that of an unstyled board whose item is `{ id: "a", nl: "C note names in xl" }`.
- "a card's own settings win": item `nl: "C note names in base boomwhacker"` with `cardStyle={{ theme: "crf", showNoteNames: true, noteNameSize: "xl" }}` → font equals the unstyled `"C note names in base boomwhacker"` card's; fills contain `#e81c1c`.
- "leaves guitar and text cards alone": items `{id:"g",nl:"C",display:"guitar"}`, `{id:"t",kind:"text",title:"Intro"}` with a full style → both render, no `.bc-note-name` inside either.
- "renders an invalid cardStyle like none": `cardStyle={{ theme: "neon", showNoteNames: "yes" } as never}` → no `.bc-note-name`, fills contain `#a0c6e8`, no console error.
- "BoardPlayer draws the same style": `<BoardPlayer items={[{id:"a",nl:"C"}]} playing={false} onPlayingChange={() => {}} cardStyle={{ theme: "crf", showNoteNames: true }} />` → `#f86e6e` and `.bc-note-name` present.

- [ ] **Step 2: Run to verify the failures**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/card-style-render.test.tsx`
Expected: FAIL on every styled case (no prop yet); "simple" and "invalid" pass as pins.

- [ ] **Step 3: Implement** the `ChordBoard.tsx` / `BoardPlayer.tsx` changes and the verify-script additions.

- [ ] **Step 4: Run board tests, lint and the package check**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run && pnpm --filter @pepperhorn/chordl-board lint && pnpm build && node scripts/verify-board-package.mjs`
Expected: PASS; the verify script ends with "Packed consumer typecheck and Vite build pass".

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/ChordBoard.tsx packages/chordl-board/src/BoardPlayer.tsx packages/chordl-board/test/card-style-render.test.tsx scripts/verify-board-package.mjs
git commit -m "feat(board): cardStyle prop on ChordBoard and BoardPlayer"
```

---

### Task 4: `cardStyle` on `BoardEditor`

**Files:**
- Modify: `packages/chordl-board/src/editor/chordDetails.ts` — add the two helpers below.
- Modify: `packages/chordl-board/src/BoardEditor.tsx`:
  - `BoardEditorProps` (:18) gains `cardStyle?: BoardCardStyle` (doc: the board's style, so the preview and cards show it; the editor never saves it).
  - `const style = normalizeCardStyle(cardStyle)` at the top of the component.
  - `theme` (:603) starts at `style.theme ?? "simple"`; note-name state (:673-675) starts from `boardNoteNameDetails(style)`.
  - One `useEffect` keyed on `[style.theme, style.showNoteNames, style.noteNameSize, style.noteNameMode]` (primitives, so a fresh object with equal values is a no-op): sets `theme` to `style.theme ?? "simple"` and, only when `editingItemId` is null, the note-name state to `boardNoteNameDetails(style)`.
  - `detailsModifiers` (:803) composes `withoutBoardNoteNames(state, style)` instead of the raw state.
  - `handleEditBoardItem` (:1036-1053): if `details.showNoteNames` is false, load the note-name state from `boardNoteNameDetails(style)` instead of the details' defaults.
  - `AnnotationControl` (:185) gains `toggleLockedReason?: string`: when set, only the On/Off button is `disabled` with that `title`; size and options stay usable. The Note names control passes `"This board shows note names on every card"` when `style.showNoteNames === true`.
  - Pass the three note-name props (`cardStyleChordProps(style)` minus `theme`) to `<VoicingVariantToggle>` (:1617) so the preview draws inherited names, and `cardStyle={style}` to the editor's `<BoardPlayer>` (:1739) and `<ChordBoard>` (:1750).
- Test: `packages/chordl-board/test/chordDetails.test.ts`, `packages/chordl-board/test/board-editor-card-style.test.tsx`

**Interfaces:**
- Consumes: `BoardCardStyle`, `normalizeCardStyle`, `cardStyleChordProps`, `DEFAULT_NOTE_NAME_SIZE` (Task 2); `ChordBoardProps.cardStyle`, `BoardPlayerProps.cardStyle` (Task 3); `VoicingVariantToggle` note-name props (Task 1).
- Produces, in `editor/chordDetails.ts`:
  - `export function boardNoteNameDetails(style: BoardCardStyle): Pick<ChordDetailState, "showNoteNames" | "noteNameMode" | "noteNameSize">` — names on: `{ true, style.noteNameMode ?? "pitch-class", style.noteNameSize ?? DEFAULT_NOTE_NAME_SIZE }`; otherwise `{ false, "pitch-class", style.noteNameSize ?? DEFAULT_CHORD_DETAILS.noteNameSize }`.
  - `export function withoutBoardNoteNames(state: ChordDetailState, style: BoardCardStyle): ChordDetailState` — returns `{ ...state, showNoteNames: false }` when `style.showNoteNames === true`, `state.showNoteNames`, the sizes match (`style.noteNameSize ?? DEFAULT_NOTE_NAME_SIZE`) and the name kinds match (`state.noteNameMode.startsWith("midi") ? "midi" : "pitch-class"` vs `style.noteNameMode ?? "pitch-class"`); otherwise `state` unchanged. Degrees, fingering and octave pass through untouched.
- `BoardEditorProps.cardStyle?: BoardCardStyle`.

- [ ] **Step 1: Write the failing tests.** In `test/chordDetails.test.ts`:

```ts
const on = { showNoteNames: true, noteNameSize: "xl" } as const;
it("drops note names the board already draws", () => {
  const s = { ...DEFAULT_CHORD_DETAILS, ...boardNoteNameDetails(on) };
  expect(composeChordDetails(withoutBoardNoteNames(s, on))).toBe("");
});
it("keeps a size or mode the board does not use", () => {
  const s = { ...DEFAULT_CHORD_DETAILS, showNoteNames: true, noteNameSize: "base" as const };
  expect(composeChordDetails(withoutBoardNoteNames(s, on))).toBe(" note names in base");
  const m = { ...DEFAULT_CHORD_DETAILS, showNoteNames: true, noteNameMode: "midi" as const, noteNameSize: "xl" as const };
  expect(composeChordDetails(withoutBoardNoteNames(m, on))).toBe(" midi note names in xl");
});
it("keeps degrees when the names are inherited", () => {
  const s = { ...DEFAULT_CHORD_DETAILS, ...boardNoteNameDetails(on), showDegrees: true };
  expect(composeChordDetails(withoutBoardNoteNames(s, on))).toBe(" with degrees in lg");
});
it("strips nothing when the board shows no names", () => {
  const s = { ...DEFAULT_CHORD_DETAILS, showNoteNames: true };
  expect(withoutBoardNoteNames(s, {})).toBe(s);
});
it("uses the keyboard's lg default when the board gives no size", () => {
  expect(boardNoteNameDetails({ showNoteNames: true }).noteNameSize).toBe("lg");
  expect(boardNoteNameDetails({}).noteNameSize).toBe("xl");
});
```

`test/board-editor-card-style.test.tsx`, copying `Host` from `board-editor.test.tsx` with an added `cardStyle` prop forwarded to `BoardEditor`. `STYLE = { theme: "crf", showNoteNames: true, noteNameSize: "xl" }`. Helpers: `themePill(c)` = text of the active `.pill-btn[data-active="true"]` inside the control whose `.control-label` is "Theme"; `namesToggle(c)` = `.annotation-toggle` inside the annotation control labelled "Note names"; `namesSize(c)` = `getByLabelText("Note names size")`.
- "starts the Theme pill and note names from cardStyle": `themePill` is "CRF"; `namesToggle` has `aria-pressed="true"` and `disabled`, `title` "This board shows note names on every card"; `namesSize.value === "xl"`.
- "adds a card without baking the board's note names into its chord": type `G`, click `.btn-add-to-board` → draft `items[1].nl === "G"`.
- "keeps a per-card note-name size the board does not use": set `namesSize` to `base`, add `G` → `items[1].nl === "G note names in base"`.
- "opening a card on a styled board leaves its chord text alone": `onSave` spy; open `saved` (nl `"C"`) via its edit action, then `await` a tick → `onSave` not called, draft `items[0].nl === "C"`, and `namesToggle` pressed.
- "board cards draw the style": `[data-board-id="saved"] .bc-note-name` exists and the card's rect fills contain `#f86e6e`.
- "picks up a cardStyle that arrives after mount": render with no style, `rerender` with `STYLE` → `themePill` "CRF", `namesToggle` pressed.
- "a new cardStyle object with the same values leaves the form alone": with `STYLE`, click the "Boom" pill, `rerender` with `{ ...STYLE }` → `themePill` still "Boom".
- "without cardStyle nothing changes": `themePill` "Simple", `namesToggle` not pressed and not disabled (pins today's defaults).

- [ ] **Step 2: Run to verify the failures**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run test/chordDetails.test.ts test/board-editor-card-style.test.tsx`
Expected: FAIL — the helpers are missing and `BoardEditor` ignores `cardStyle`. "without cardStyle nothing changes" passes.

- [ ] **Step 3: Implement** the helpers and the `BoardEditor.tsx` changes listed under Files.

- [ ] **Step 4: Run the board suite and lint**

Run: `pnpm --filter @pepperhorn/chordl-board exec vitest run && pnpm --filter @pepperhorn/chordl-board lint`
Expected: PASS, with `board-editor.test.tsx` unchanged (no style passed there).

- [ ] **Step 5: Commit**

```bash
git add packages/chordl-board/src/editor/chordDetails.ts packages/chordl-board/src/BoardEditor.tsx packages/chordl-board/test/chordDetails.test.ts packages/chordl-board/test/board-editor-card-style.test.tsx
git commit -m "feat(board): BoardEditor previews the host's cardStyle without saving it into cards"
```

---

### Task 5: Release prep (local only): chordl-react 0.5.1, chordl-board 0.2.2

**Files:**
- Modify: `packages/chordl-react/package.json` (`"version": "0.5.1"`), `packages/chordl-board/package.json` (`"version": "0.2.2"`). Nothing else in either manifest.
- Modify: `CHANGELOG.md` (new section above `## 2026-10-28 — chordl-board 0.2.1`)
- Modify: `README.md` — `### <PianoChord>` table (:547): three rows after `theme`: `showNoteNames` / `boolean` / `—` / "Default note names when the chord text asks for none; text wins", `noteNameSize` / `TextSize` / `—` / "Default size when the text gives none", `noteNameMode` / `NoteNameMode` / `—` / "Default mode when the default turns names on". Embed section (:660): `chordl-board@0.2.1` → `0.2.2`; add `cardStyle={normalizeCardStyle(block.card_style)}` to the `BoardEditor` and `BoardPlayer` lines of the example; one paragraph on precedence, the "text cannot turn names off" limit, guitar/staff-only not styled, and that the style is never stored in the board. Replace "This release requires `chordl-guitar@0.3.0` and `chordl-react@0.5.0`" with `chordl-react@0.5.1`.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: two publishable packages on the PR branch.

- [ ] **Step 1: Bump and document.** Set both versions, update README, then add to `CHANGELOG.md`:

```markdown
## 2026-10-29 — chordl-react 0.5.1, chordl-board 0.2.2

Publish `chordl-react@0.5.1` first, then `chordl-board@0.2.2` (which depends on
it exactly). `chordl-core` stays 0.5.2. Hosts pin both exactly.

- **PianoChord note-name defaults:** `showNoteNames`, `noteNameSize` and
  `noteNameMode` props apply when the chord text does not set them; the text wins.
  A degrees-only chord gains the default names beside its degrees. Chord text
  cannot turn names off. `VoicingVariantToggle` passes them through.
- **Board card style:** `cardStyle?: BoardCardStyle` (`theme`
  simple/crf/boomwhacker, `showNoteNames`, `noteNameSize`, `noteNameMode`
  pitch-class/midi) on `ChordBoard`, `BoardPlayer` and `BoardEditor` styles every
  keyboard card. Guitar and staff-only cards are unchanged. Use
  `normalizeCardStyle(value)` on CMS input; the components also normalise it.
  The style is not saved in the board (still `chordl.board/v3`); PNG/PDF export
  includes it, and JSON export records it in `renderConfig.cardStyle`, so styled
  cards get their own `cacheKey`. Unstyled boards keep their keys.
- **Editor:** the Theme pill and Note names controls start from `cardStyle`.
  Cards store only note-name settings that differ from the board's, and the Note
  names toggle is locked on while the board shows names.
```

- [ ] **Step 2: Full verification under Node 22**

Run: `pnpm install --frozen-lockfile && pnpm build && pnpm lint && pnpm test:run && node scripts/verify-board-package.mjs`
Expected: all green (the jsdom navigation trace may print; it is not a failure). Then confirm the packed pin:
`rm -rf /tmp/cs && pnpm --filter @pepperhorn/chordl-board pack --pack-destination /tmp/cs && tar -xOzf /tmp/cs/pepperhorn-chordl-board-0.2.2.tgz package/package.json | grep -E '"version"|chordl-(core|react)'`
Expected: `"version": "0.2.2"`, `"@pepperhorn/chordl-core": "0.5.2"`, `"@pepperhorn/chordl-react": "0.5.1"`.

- [ ] **Step 3: Commit and open the PR**

```bash
git add packages/chordl-react/package.json packages/chordl-board/package.json CHANGELOG.md README.md
git commit -m "chore: release chordl-react 0.5.1 and chordl-board 0.2.2"
git push -u origin feat/board-card-style
gh pr create --base main --title "feat(board): board-wide card style (react 0.5.1, board 0.2.2)"
```

- [ ] **Step 4: Publishing is the human's step, after the PR merges.** Do not push tags. On an up-to-date `main` with `pnpm build` done (neither package has a prepublish build):

```bash
cd packages/chordl-react && pnpm publish --access public --no-git-checks
cd ../chordl-board && pnpm publish --access public --no-git-checks
npm view @pepperhorn/chordl-board@0.2.2 dependencies   # expect chordl-react: '0.5.1'
```

Then crf-staff and becreative bump to `"@pepperhorn/chordl-board": "0.2.2"` and pass `cardStyle={normalizeCardStyle(block.card_style)}` from their board block.

---

## Self-review

1. **Spec coverage.** React props with NL precedence, the unset-vs-false finding and per-branch tests: Task 1. `BoardCardStyle`, `normalizeCardStyle`, the cache-key decision: Task 2. `ChordBoard`/`BoardPlayer` threading, guitar note, export inheritance: Task 3 and Global Constraints. Editor initialisation without writing `cardStyle`: Task 4. No board JSON/meta changes, v3: Global Constraints and the Task 2 import test. Release order, exact pins, manual publish: Task 5.
2. **Step scan.** Each code step names file, line anchors and signature; tests are given as code where values matter, as named assertions elsewhere.
3. **Type consistency.** `BoardCardStyle` / `BoardCardTheme` / `normalizeCardStyle` / `cardStyleChordProps` / `cardStyleRenderConfig` / `DEFAULT_NOTE_NAME_SIZE` match across Tasks 2–5. `resolveNoteNames` and `NoteNameDefaults` stay inside chordl-react. `boardNoteNameDetails` / `withoutBoardNoteNames` live in `editor/chordDetails.ts` only.
4. **Review Focus.** Each of the 5 lines names its owning test.
5. **Proportion.** Five tasks; code only for test values, types and CHANGELOG copy.
