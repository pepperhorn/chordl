// schema/*.json is the source of truth (shipped in `files`). Copy it into src/
// so the TypeScript build can import it and bundlers/Node resolve it the same way.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "src", "generated");
mkdirSync(dest, { recursive: true });
for (const f of ["chord.schema.json", "voicing.schema.json"]) {
  cpSync(join(root, "schema", f), join(dest, f));
}
