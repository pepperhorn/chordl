/** A single chord card on the board. */
export interface BoardItem {
  /** Stable identifier for keys and drag-drop. */
  id: string;
  /** NL chord string — the only field required to render. */
  nl: string;
  /** Optional title override (defaults to the resolved chord name). */
  title?: string;
  /** Optional muted subheading below the title. */
  subheading?: string;
  /** Optional footer text below all annotations. */
  footerText?: string;
}

/**
 * Persistence layer for a board. Default implementation uses localStorage;
 * callers can swap in any adapter (remote API, IndexedDB, etc.).
 */
export interface StorageAdapter {
  load(): Promise<BoardItem[]> | BoardItem[];
  save(items: BoardItem[]): Promise<void> | void;
}
