import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTheme, type Theme } from "../src/theme";

/** A path, not `new URL(..., import.meta.url)`: Vite rewrites the latter into an asset URL. */
export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
/** The shipped theme (themes/crf-default.json): the one print and the site both read. */
export const THEME_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "themes", "crf-default.json");
export const RAW_THEME = JSON.parse(readFileSync(THEME_PATH, "utf8"));
export function loadTheme(): Theme {
  return parseTheme(JSON.parse(readFileSync(THEME_PATH, "utf8")));
}
