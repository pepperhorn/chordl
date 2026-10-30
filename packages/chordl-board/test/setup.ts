import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Board cards render chord diagrams, and svguitar measures text via getBBox,
// which jsdom does not implement. A fixed-size box is enough for layout to
// finish — these tests assert on structure, never on geometry.
if (typeof SVGElement !== "undefined" && !("getBBox" in SVGElement.prototype)) {
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    writable: true,
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 10, height: 10 }),
  });
}

// Node 25+ defines its own global localStorage and sessionStorage, and vitest's
// jsdom environment will not overwrite a global that already exists, so tests
// would see Node's stubs instead of jsdom's working storage. Put jsdom's back.
const { jsdom } = globalThis as unknown as { jsdom?: { window: Window } };
if (jsdom) {
  for (const name of ["localStorage", "sessionStorage"] as const) {
    Object.defineProperty(globalThis, name, {
      writable: true,
      configurable: true,
      value: jsdom.window[name],
    });
  }
}

// This package runs vitest without `globals: true`, so Testing Library does not
// auto-clean; without this the DOM from one render() leaks into the next test.
afterEach(() => cleanup());
