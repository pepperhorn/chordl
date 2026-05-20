import type { BoardItem, StorageAdapter } from "./types";

/** Default in-browser persistence. Stores the board under a single key. */
export function localStorageAdapter(key: string = "chordl-board"): StorageAdapter {
  return {
    load(): BoardItem[] {
      if (typeof localStorage === "undefined") return [];
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as BoardItem[]) : [];
      } catch {
        return [];
      }
    },
    save(items: BoardItem[]): void {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(key, JSON.stringify(items));
      } catch {
        // Quota exceeded / disabled — silently drop. Caller can pass their
        // own adapter with richer error handling.
      }
    },
  };
}

/** No-op adapter for tests or unsigned-in / ephemeral usage. */
export const memoryStorageAdapter = (): StorageAdapter => {
  let items: BoardItem[] = [];
  return {
    load: () => items,
    save: (next) => { items = next; },
  };
};
