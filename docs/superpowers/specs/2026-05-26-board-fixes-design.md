# Board Fixes — Design

Date: 2026-05-26
Scope: `packages/chordl-board/`

Five fixes to the chord board: clean PNG/PDF export, semantic title/subtitle, JSON import/export, selectable cards with a repeat action, and a scoped drag handle.

## 1. Clean export (PNG/PDF)

The PNG/PDF capture currently includes card chrome (drag handle, edit/copy/cut/delete row, settings toolbar, clipboard bar). Strip them during capture.

- Add an `exporting: boolean` state in `ChordBoard`.
- Before calling `html2canvas`, set `exporting = true`, await one `requestAnimationFrame` so the DOM settles, capture, then reset.
- The toolbar (settings + download buttons) and the clipboard bar already live outside `exportRef` — no change needed there.
- Inside `exportRef`, the drag handle and the action-buttons row render only when `!exporting`. The card border/padding stay so the layout reads as cards.

## 2. Centered title/subtitle as h1/h3

Already centered. Change the existing title `<div>` → `<h1>` and subtitle `<div>` → `<h3>` inside the exportable region. Keep current font sizes/weights via inline style (override default browser margins). Same DOM is shared by UI and export.

## 3. JSON import/export

Self-contained payload with optional ph-apps cache refs.

New file: `packages/chordl-board/src/io.ts`

```ts
export interface BoardJsonV1 {
  schema: "chordl.board/v1";
  exportedAt: string; // ISO timestamp
  meta: BoardMeta;
  items: Array<BoardItem & {
    cacheKey?: string;       // sha256 from ph-chordl computeCacheKey
    renderConfig?: Record<string, unknown>; // snapshot used to derive cacheKey
  }>;
}

export function exportBoardJson(state: BoardState): string;
export async function importBoardJson(text: string): Promise<BoardState>;
export async function computeCacheKey(input: {
  user_string: string;
  render_config: Record<string, unknown>;
}): Promise<string>;
```

`computeCacheKey` is a direct port of `ph-chordl/src/lib/cacheKey.ts` (no new dep, sha256 via `crypto.subtle`). Items written today include `cacheKey` derived from `{ user_string: item.nl, render_config: {} }` plus any per-card overrides — this future-proofs lookup; nothing reads it yet on import.

Import path: parse → validate `schema === "chordl.board/v1"` → return `{ items, meta }`, stripping the extra `cacheKey`/`renderConfig` fields back to the base `BoardItem` shape. Malformed JSON throws.

Toolbar additions (next to PNG / PDF):
- **Export JSON** — `application/json` blob download named `<slug>.json`.
- **Import JSON** — hidden `<input type="file" accept="application/json">`. If the board currently has items, confirm before replacing. New handler `onImport?: (state: BoardState) => void` is plumbed up to the host page (callers can drop it into their `useChordBoard` setters).

## 4. Selected card + repeat action

State lives in `useChordBoard`:
- Add `selectedId: string | null`, `selectItem(id)`, `clearSelection()`, and a new `duplicateItem(id)` that inserts a clone with a fresh id immediately after the source.
- Pass `selectedId`, `onSelect`, `onDuplicate` through `ChordBoardProps`.

Behaviour:
- Click on the card body → `onSelect(item.id)`. Click on the board background (the grid container, not a card) → `clearSelection()`.
- Action buttons row (edit, copy, cut, **repeat**, delete) is hidden by default. CSS opacity transitions to 1 on `:hover` or when the card has `data-selected="true"`.
- Selected card gets a sticky blue ring (reuses the `EDIT_BORDER`/`DRAG_GLOW_SOFT` palette, distinct from the editing pulse — solid 1px ring, no animation).

Wire `duplicateItem` to the new "repeat" button.

## 5. Drag handle scope

Today the entire card is `draggable`. Scope dragging to the handle:
- Card root carries `draggable` only when the handle has reported a mousedown.
- `onMouseDown` on the handle sets a local `dragArmed` ref → enables `draggable`; `onDragEnd` / `onMouseUp` clears it.
- Handle follows the same hover-reveal / selected-sticky visibility as the action row.
- Cursor on the handle is `grab` / `grabbing`; the card body cursor returns to `default` (no more `grab` on the whole card).

## Files touched

- `packages/chordl-board/src/ChordBoard.tsx` — exporting gate, selection, hover-reveal CSS, scoped drag, h1/h3, JSON buttons, repeat action.
- `packages/chordl-board/src/types.ts` — `BoardJsonV1`; extend hook return with `selectedId`, `selectItem`, `clearSelection`, `duplicateItem`; extend `ChordBoardProps` with `selectedId`, `onSelect`, `onClearSelection`, `onDuplicate`, `onImport`.
- `packages/chordl-board/src/io.ts` — new; `exportBoardJson`, `importBoardJson`, `computeCacheKey`.
- `packages/chordl-board/src/index.ts` — re-export new public API.

## Out of scope

- Saving boards to a user account (deferred per user).
- Live ph-apps cache resolution on import — `cacheKey` is written but not read.
- Keyboard shortcuts (delete/duplicate via keys).
- Multi-select.
