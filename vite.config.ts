import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(command === "build" ? [dts({ rollupTypes: true })] : [])],
  root: command === "serve" ? "dev" : undefined,
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "BetterChordReact",
      formats: ["es", "cjs"],
      fileName: "better-chord-react",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
        },
      },
    },
  },
}));
