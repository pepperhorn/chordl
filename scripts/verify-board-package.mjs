// Run after pnpm build. Exercises packed packages against registry dependencies,
// without workspace links or Vite aliases, before a coordinated npm release.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const consumer = mkdtempSync(join(tmpdir(), "chordl-board-consumer-"));
const run = (command, args, cwd = consumer) => {
  try {
    return execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    process.stderr.write(error.stdout ?? "");
    process.stderr.write(error.stderr ?? "");
    throw error;
  }
};

const dependencies = { react: "^19.0.0", "react-dom": "^19.0.0" };
for (const dir of ["chordl-guitar", "chordl-react", "chordl-board"]) {
  run("pnpm", ["--filter", `@pepperhorn/${dir}`, "pack", "--pack-destination", consumer], root);
  const manifest = JSON.parse(readFileSync(join(root, "packages", dir, "package.json"), "utf8"));
  const tarball = join(consumer, `pepperhorn-${dir}-${manifest.version}.tgz`);
  const packed = run("tar", ["-xOf", tarball, "package/package.json"]);
  assert(!packed.includes("workspace:"), `${dir} contains an unresolved workspace dependency`);
  dependencies[manifest.name] = `file:${tarball}`;
}

// The read-only player shares ChordBoard.js, so the export libraries must only
// ever be reached through import(), never a static import in dist.
const distDir = join(root, "packages", "chordl-board", "dist");
const staticExportImport = /^\s*import\s+(?:[^;]*?\sfrom\s+)?["'](?:html2canvas|jspdf)["']/m;
const distJs = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? distJs(join(dir, e.name)) : e.name.endsWith(".js") ? [join(dir, e.name)] : []);
for (const file of distJs(distDir)) {
  assert(!staticExportImport.test(readFileSync(file, "utf8")), `${file} statically imports html2canvas or jspdf`);
}
const boardJs = readFileSync(join(distDir, "ChordBoard.js"), "utf8");
assert(boardJs.includes('import("html2canvas")'), "dist/ChordBoard.js must load html2canvas with import()");
assert(boardJs.includes('import("jspdf")'), "dist/ChordBoard.js must load jspdf with import()");

writeFileSync(join(consumer, "package.json"), JSON.stringify({
  private: true, type: "module", dependencies,
  devDependencies: { vite: "^6.0.0", typescript: "^5.7.0", "@types/react": "^19.0.0", "@types/react-dom": "^19.0.0" },
}, null, 2));
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);

writeFileSync(join(consumer, "App.tsx"), `
import { useMemo, useRef, useState } from "react";
import { BoardEditor, BoardPlayer, useChordBoard, memoryStorageAdapter } from "@pepperhorn/chordl-board";
import type { BoardEditorHandle, BoardPlayerHandle, BoardState } from "@pepperhorn/chordl-board";
import "@pepperhorn/chordl-board/editor.css";
const initial: BoardState = { items: [{ id: "c", nl: "C", playbackNotes: [60,64,67] }], meta: { title: "Lesson" } };
export default function App() {
  const storage = useMemo(() => memoryStorageAdapter(initial), []);
  const [draft, setDraft] = useState(initial);
  const board = useChordBoard({ initialItems: initial.items, initialMeta: initial.meta, storage, onChange: setDraft });
  const editor = useRef<BoardEditorHandle>(null);
  const playerRef = useRef<BoardPlayerHandle>(null);
  return <><button type="button" onClick={() => editor.current?.setChord("Dm7", { ref: { source: "chords", id: "42" } })}>Catalogue</button>
    <BoardEditor ref={editor} board={board} enableListening={false} />
    <BoardPlayer ref={playerRef} items={draft.items} meta={draft.meta} playing={false} onPlayingChange={() => {}} /></>;
}
`);
writeFileSync(join(consumer, "main.tsx"), `import { createRoot } from "react-dom/client"; import App from "./App"; createRoot(document.getElementById("root")!).render(<App />);`);
writeFileSync(join(consumer, "index.html"), `<div id="root"></div><script type="module" src="/main.tsx"></script>`);
writeFileSync(join(consumer, "vite.config.mjs"), `export default { esbuild: { jsx: "automatic" } };`);
writeFileSync(join(consumer, "smoke.mjs"), `
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement as el } from "react";
import { renderToString } from "react-dom/server";
import { BoardEditor, BoardPlayer, memoryStorageAdapter, useChordBoard } from "@pepperhorn/chordl-board";
import postcss from "postcss";
const initial = { items: [{ id: "c", nl: "C" }], meta: { title: "Lesson" } };
function Host() {
  const board = useChordBoard({ initialItems: initial.items, initialMeta: initial.meta, storage: memoryStorageAdapter(initial) });
  return el(BoardEditor, { board, initialChord: "C", enableListening: false });
}
const html = renderToString(el(Host));
assert(html.includes("chordl-board-editor"));
assert(html.includes("Lesson"));
assert(!html.includes('class="listen-mic-btn"'));
const player = renderToString(el(BoardPlayer, { ...initial, playing: false, onPlayingChange() {} }));
assert(player.includes("board-player"));
assert(player.includes("chordl-player-play"));
assert(!player.includes("chordl-board-action-edit"));
const css = readFileSync(import.meta.resolve("@pepperhorn/chordl-board/editor.css").replace("file://", ""), "utf8");
const unscoped = [];
postcss.parse(css).walkRules(rule => {
  if (rule.parent.type === "atrule" && rule.parent.name.endsWith("keyframes")) return;
  for (const selector of rule.selector.split(",")) if (!selector.trim().startsWith(".chordl-board-editor")) unscoped.push(selector);
});
assert.deepEqual(unscoped, [], "Unscoped editor styles");
console.log("Packed editor/player SSR, exports and scoped stylesheet pass.");
`);
run("node", ["node_modules/typescript/bin/tsc", "--noEmit", "--skipLibCheck", "--jsx", "react-jsx", "--module", "esnext", "--moduleResolution", "bundler", "--target", "es2022", "App.tsx", "main.tsx"]);
process.stdout.write(run("node", ["smoke.mjs"]));
run("node", ["node_modules/vite/bin/vite.js", "build"]);
console.log(`Packed consumer typecheck and Vite build pass: ${consumer}`);
