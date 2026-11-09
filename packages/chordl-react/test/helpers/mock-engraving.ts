import { vi } from "vitest";

// Control tests exercise real panels, parsing, filtering and state updates.
// Engraving pixels are covered by notation tests; avoid initializing WASM and
// engraving every intermediate Both/Notation view just to click past it.
// Mock the external engine so this also works through the built workspace
// packages used by the dev app, without changing package resolution.
vi.mock("verovio/wasm", () => ({ default: async () => ({}) }));
vi.mock("verovio/esm", () => ({
  VerovioToolkit: class {
    setOptions() {}
    loadData() { return true; }
    renderToSVG() { return '<svg viewBox="0 0 140 120"><g class="staff" /></svg>'; }
    getPageCount() { return 1; }
  },
}));
