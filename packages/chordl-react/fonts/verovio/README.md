# Verovio font zips

`Bravura.zip` and `Petaluma.zip` are [Verovio](https://www.verovio.org) custom-font
archives (bounding-box XML + per-glyph SVG paths + a stub `<Font>.css`). The
notation renderer registers them with Verovio via `fontAddCustom` (see
`src/verovio.ts`) so engraving uses these repo-bundled fonts rather than whatever
the Verovio WASM build happens to compile in.

Upstream ships a real `<Font>.css` — an `@font-face` wrapping an embedded woff2,
for Verovio's HTML output. We replace it with a stub, because nothing here reads
it: every glyph is drawn as a `<use>` of an embedded SVG path and no `<text>` in
the music font is emitted. That is ~193 KB of base64 saved across the two fonts,
with engraving verified identical. The stub has to exist rather than be absent —
Verovio logs `[Error] No file 'Petaluma.css' to read found in the archive` on
every toolkit init otherwise, in the console of every visitor who loads notation.

Compression stays at zip's default level 6: level 9 measured slightly *worse*
(413,345 B against 412,846 B for Bravura), these being ~880 small XML files each
deflated separately and already at their limit.

Both fonts are licensed under the SIL Open Font License (see `../OFL.txt`):

- **Bravura** — designed by Daniel Spreadbury / Steinberg.
- **Petaluma** — designed by Steinberg.

## Regenerating

The zips are assembled from the upstream Verovio font data and then embedded as
base64 in `src/verovio-fonts.generated.ts`:

```sh
pnpm --filter @pepperhorn/chordl-react fonts:build
```

`scripts/build-verovio-fonts.mjs` needs a `zip` binary on PATH, fetches the font
data from Verovio's `develop` branch — so regenerating takes whatever is there
today, which is a deliberate act, not a routine one — and writes the zips;
`scripts/embed-verovio-fonts.mjs` regenerates the base64 module. Commit all three
outputs (the two zips and the generated module) together.
