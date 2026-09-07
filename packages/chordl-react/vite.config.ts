import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import { readFileSync } from "fs";

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

// Anything we declare as a runtime dependency must stay a runtime import, or
// consumers install the code twice — once transitively, once inlined here.
// Subpaths count too: "verovio/wasm" and "react/jsx-runtime" belong to their
// package. Local chunks (./verovio-fonts.generated) are relative, so unmatched.
const runtimeDeps = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

const isRuntimeDep = (id: string) =>
  runtimeDeps.some((name) => id === name || id.startsWith(`${name}/`));

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === "build" ? [dts({ rollupTypes: true })] : [])],
  root: command === "serve" ? "dev" : undefined,
  // The playground is a workspace integration surface. Resolve sibling
  // packages to source while serving so board changes hot-reload instead of
  // silently coming from the last published/built dist artifact.
  resolve: command === "serve" ? {
    alias: {
      "@pepperhorn/chordl-react": resolve(__dirname, "src/index.ts"),
      "@pepperhorn/chordl-board": resolve(__dirname, "../chordl-board/src/index.ts"),
    },
  } : undefined,
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "chordl",
    },
    rollupOptions: {
      external: isRuntimeDep,
    },
  },
}));
