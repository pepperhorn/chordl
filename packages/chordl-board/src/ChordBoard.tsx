import { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties } from "react";
import { PianoChord } from "@pepperhorn/chordl-react";
import type { UIThemeMode } from "@pepperhorn/chordl-react";
import type { BoardItem, StorageAdapter } from "./types";
import { localStorageAdapter } from "./storage";

/** Stable-ish id without pulling in a uuid dep. */
export function newId(): string {
  return `chord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Stateful hook that owns the board items list + storage I/O + clipboard.
 * Returned mutators are stable across renders.
 *
 * Pair with `<ChordBoard items={items} {...handlers} />` to render.
 */
export function useChordBoard(opts?: {
  initialItems?: BoardItem[];
  storage?: StorageAdapter;
  onChange?: (items: BoardItem[]) => void;
}) {
  const { initialItems, storage, onChange } = opts ?? {};
  const adapterRef = useRef<StorageAdapter>(storage ?? localStorageAdapter());
  useEffect(() => { adapterRef.current = storage ?? localStorageAdapter(); }, [storage]);

  const [items, setItems] = useState<BoardItem[]>(() => initialItems ?? []);
  const [clipboard, setClipboard] = useState<BoardItem | null>(null);
  const hydratedRef = useRef(false);

  // Hydrate from storage once on mount.
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    Promise.resolve(adapterRef.current.load()).then((arr) => {
      if (arr && arr.length > 0) setItems(arr);
    });
  }, []);

  // Persist + notify on every change (skip the initial render).
  const firstRunRef = useRef(true);
  useEffect(() => {
    if (firstRunRef.current) { firstRunRef.current = false; return; }
    adapterRef.current.save(items);
    onChange?.(items);
  }, [items, onChange]);

  const addItem = useCallback((item: Omit<BoardItem, "id"> & { id?: string }) => {
    const next: BoardItem = { id: item.id ?? newId(), nl: item.nl, title: item.title, subheading: item.subheading, footerText: item.footerText };
    setItems((prev) => [...prev, next]);
    return next.id;
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<BoardItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const copyItem = useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) setClipboard({ ...it });
      return prev;
    });
  }, []);

  const cutItem = useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) setClipboard({ ...it });
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const pasteItem = useCallback(() => {
    setClipboard((cb) => {
      if (cb) setItems((prev) => [...prev, { ...cb, id: newId() }]);
      return cb;
    });
  }, []);

  const reorder = useCallback((fromId: string, toId: string) => {
    if (fromId === toId) return;
    setItems((prev) => {
      const fromIdx = prev.findIndex((x) => x.id === fromId);
      const toIdx = prev.findIndex((x) => x.id === toId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const clearClipboard = useCallback(() => setClipboard(null), []);

  return {
    items, clipboard,
    addItem, updateItem, removeItem,
    copyItem, cutItem, pasteItem, clearClipboard,
    reorder, clear,
  };
}

// ── Stateless renderer ────────────────────────────────────────────

export interface ChordBoardProps {
  items: BoardItem[];
  clipboard?: BoardItem | null;
  onEdit?: (item: BoardItem) => void;
  onCopy?: (id: string) => void;
  onCut?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPaste?: () => void;
  onClearClipboard?: () => void;
  onReorder?: (fromId: string, toId: string) => void;
  uiTheme?: UIThemeMode;
  /** Render scale forwarded to each card's PianoChord. */
  scale?: number;
  className?: string;
  style?: CSSProperties;
}

export function ChordBoard({
  items,
  clipboard,
  onEdit,
  onCopy,
  onCut,
  onDelete,
  onPaste,
  onClearClipboard,
  onReorder,
  uiTheme,
  scale = 0.6,
  className,
  style,
}: ChordBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null);

  const cardStyle: CSSProperties = {
    position: "relative",
    border: "1px solid var(--btn-border, #ddd)",
    borderRadius: 12,
    padding: 12,
    background: "var(--pill-bg, #fff)",
    minWidth: 240,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    cursor: "grab",
    userSelect: "none",
  };

  const iconBtnStyle: CSSProperties = {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    padding: "2px 6px",
    fontSize: "0.78rem",
    color: "var(--text-muted, #666)",
    fontFamily: "inherit",
    borderRadius: 4,
  };

  return (
    <div className={`chordl-board ${className ?? ""}`.trim()} style={style}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
        {items.length === 0 && (
          <div style={{
            padding: "16px 20px",
            color: "var(--text-muted, #888)",
            fontSize: "0.85rem",
            fontStyle: "italic",
          }}>
            No chords yet — click the add button to capture the current chord.
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            data-board-id={item.id}
            style={{ ...cardStyle, opacity: dragId === item.id ? 0.45 : 1 }}
            draggable
            onDragStart={(e) => {
              setDragId(item.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", item.id);
            }}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDrop={(e) => {
              e.preventDefault();
              const fromId = e.dataTransfer.getData("text/plain");
              if (fromId && onReorder) onReorder(fromId, item.id);
              setDragId(null);
            }}
          >
            <PianoChord
              chord={item.nl}
              title={item.title}
              subheading={item.subheading}
              footerText={item.footerText}
              scale={scale}
              uiTheme={uiTheme}
              showPlayback={false}
            />
            <div style={{
              display: "flex",
              gap: 4,
              justifyContent: "flex-end",
              marginTop: 2,
              borderTop: "1px solid var(--btn-border, #eee)",
              paddingTop: 6,
            }}>
              <button style={iconBtnStyle} onClick={() => onEdit?.(item)} title="Edit">edit</button>
              <button style={iconBtnStyle} onClick={() => onCopy?.(item.id)} title="Copy">copy</button>
              <button style={iconBtnStyle} onClick={() => onCut?.(item.id)} title="Cut">cut</button>
              <button style={iconBtnStyle} onClick={() => onDelete?.(item.id)} title="Delete">delete</button>
            </div>
          </div>
        ))}
      </div>
      {clipboard && (
        <div style={{
          marginTop: 12,
          padding: "6px 12px",
          fontSize: "0.78rem",
          color: "var(--text-muted, #888)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          clipboard: <code>{clipboard.nl}</code>
          <button style={iconBtnStyle} onClick={() => onPaste?.()}>paste</button>
          <button style={iconBtnStyle} onClick={() => onClearClipboard?.()}>clear</button>
        </div>
      )}
    </div>
  );
}
