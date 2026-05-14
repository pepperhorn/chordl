import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

/**
 * Vite config for building the chordl.app site (the dev playground as a static site).
 * Produces a deployable HTML/JS/CSS bundle in site-dist/.
 */
export default defineConfig({
  plugins: [react()],
  root: "dev",
  base: "/",
  build: {
    outDir: resolve(__dirname, "site-dist"),
    emptyOutDir: true,
  },
});
