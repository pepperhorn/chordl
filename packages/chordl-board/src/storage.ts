import type { BoardItem, BoardState, StorageAdapter } from "./types";

/** Default in-browser persistence. Stores the board under a single key. */
export function localStorageAdapter(key: string = "chordl-board"): StorageAdapter {
  return {
    load(): BoardState {
      if (typeof localStorage === "undefined") return { items: [], meta: {} };
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return { items: [], meta: {} };
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Legacy schema: bare items array.
          return { items: parsed as BoardItem[], meta: {} };
        }
        return {
          items: Array.isArray(parsed?.items) ? parsed.items : [],
          meta: parsed?.meta && typeof parsed.meta === "object" ? parsed.meta : {},
        };
      } catch {
        return { items: [], meta: {} };
      }
    },
    save(state: BoardState): void {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Quota exceeded / disabled — silently drop.
      }
    },
  };
}

/** No-op adapter for tests or unsigned-in / ephemeral usage. */
export const memoryStorageAdapter = (): StorageAdapter => {
  let state: BoardState = { items: [], meta: {} };
  return {
    load: () => state,
    save: (next) => { state = next; },
  };
};
