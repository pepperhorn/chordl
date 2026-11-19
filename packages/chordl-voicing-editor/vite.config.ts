import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import pkg from "./package.json";
const deps = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
];
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === "build" ? [dts({ rollupTypes: true })] : []),
  ],
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "index" },
    rollupOptions: {
      external: (id) => deps.some((d) => id === d || id.startsWith(d + "/")),
    },
  },
}));
