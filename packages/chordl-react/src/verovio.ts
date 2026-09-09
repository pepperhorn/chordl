// Verovio toolkit loader + font registration.
//
// Verovio ships as a ~7 MB WASM module, so it is dynamically imported and the
// toolkit instance is cached behind a single promise. The bundled Bravura /
// Petaluma zips (see fonts/verovio + verovio-fonts.generated.ts) are registered
// via `fontAddCustom` the first time the toolkit initializes, so engraving uses
// the repo-bundled fonts rather than whatever the Verovio build compiled in.

export type VerovioFont = "Bravura" | "Petaluma";

// Minimal shape of the bits of the Verovio toolkit we use.
interface Toolkit {
  setOptions(opts: Record<string, unknown>): void;
  loadData(data: string): boolean;
  renderToSVG(page: number): string;
  getPageCount(): number;
}

let toolkitPromise: Promise<Toolkit> | null = null;

async function initToolkit(): Promise<Toolkit> {
  // `verovio/wasm` is the WASM module factory; `verovio/esm` the JS toolkit.
  // The embedded font zips (~1 MB base64) are dynamically imported here too so
  // they land in this lazy chunk rather than the main bundle.
  const [{ default: createVerovioModule }, { VerovioToolkit }, { VEROVIO_FONT_ZIPS }] =
    await Promise.all([
      import("verovio/wasm"),
      import("verovio/esm"),
      import("./verovio-fonts.generated"),
    ]);
  const mod = await createVerovioModule();
  const tk = new VerovioToolkit(mod) as unknown as Toolkit;
  // Register the bundled font zips (base64). Loading all keeps font switching
  // instant afterwards — no re-init when the user toggles Bravura/Petaluma.
  tk.setOptions({
    fontAddCustom: Object.values(VEROVIO_FONT_ZIPS),
  });
  return tk;
}

/** Lazily load (and cache) the Verovio toolkit with the bundled fonts registered. */
export function getVerovioToolkit(): Promise<Toolkit> {
  if (!toolkitPromise) {
    toolkitPromise = initToolkit().catch((err) => {
      // Reset so a later call can retry after a transient import/WASM failure.
      toolkitPromise = null;
      throw err;
    });
  }
  return toolkitPromise;
}

/**
 * Start loading the toolkit without waiting for it.
 *
 * Nothing pulls in the ~7 MB Verovio chunk until a staff first mounts, so a
 * cold visitor who switches to notation view pays the whole download inside the
 * first engraving — 13 s on a deployed cold cache, which reads as a hung
 * loading animation. Calling this once after first paint moves that download
 * off the critical path, so the first staff paints from an already-warm
 * toolkit.
 *
 * Idempotent: it shares `getVerovioToolkit`'s cached promise, so it never
 * starts a second initialisation and never changes what a later real render
 * gets. Its rejection is swallowed — a background warm-up has no caller to
 * catch it, and `getVerovioToolkit` already drops its cached promise on
 * failure, so a later render still retries from scratch.
 */
export function prefetchVerovio(): Promise<void> {
  return getVerovioToolkit().then(
    () => undefined,
    () => undefined,
  );
}

export interface RenderMeiOptions {
  font?: VerovioFont;
  /** Verovio `scale` (percent). Larger = bigger engraving. */
  scale?: number;
}

/** Render an MEI document to a single-system SVG string. */
export async function renderMeiToSvg(
  mei: string,
  { font = "Bravura", scale = 40 }: RenderMeiOptions = {},
): Promise<string> {
  const tk = await getVerovioToolkit();
  tk.setOptions({
    font,
    scale,
    adjustPageWidth: true,
    adjustPageHeight: true,
    breaks: "none",
    header: "none",
    footer: "none",
    pageMarginTop: 2,
    pageMarginBottom: 8,
    pageMarginLeft: 4,
    pageMarginRight: 4,
    svgViewBox: true,
    svgRemoveXlink: true,
  });
  if (!tk.loadData(mei)) {
    throw new Error("Verovio failed to load notation data");
  }
  return tk.renderToSVG(1);
}
