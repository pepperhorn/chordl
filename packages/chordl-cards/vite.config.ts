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

// Same rule as chordl-react: every declared runtime dependency (and its
// subpaths, e.g. "react/jsx-runtime") stays an import, never inlined.
const runtimeDeps = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
];

const isRuntimeDep = (id: string) =>
  runtimeDeps.some((name) => id === name || id.startsWith(`${name}/`));

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === "build" ? [dts({ rollupTypes: true })] : [])],
  build: {
    lib: {
      // Two entries: the React-free voicing model (what print imports) and the
      // full package with the player.
      entry: {
        "chordl-cards": resolve(__dirname, "src/index.ts"),
        model: resolve(__dirname, "src/model.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: isRuntimeDep,
      // The model is shared by both entries; name its chunk for what it is.
      output: { chunkFileNames: "shared-[hash].js" },
    },
  },
}));
