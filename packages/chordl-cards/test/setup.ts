import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom implements no SVG layout, so svguitar throws measuring text without a
// getBBox; GuitarChord would then render nothing. Same shim as chordl-react.
if (typeof SVGElement !== "undefined" && !("getBBox" in SVGElement.prototype)) {
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    writable: true,
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 10, height: 10 }),
  });
}

// No vitest globals, so Testing Library does not auto-clean between tests.
afterEach(cleanup);
