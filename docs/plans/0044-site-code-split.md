# Plan 0044 — chordl.app: ship less JavaScript on first load

- **Spec:** ../specs/0044-site-code-split.md
- **Base:** main @ e86c52f
- **Verification (whole item):** `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site`

## Approach
1. Build the site with sourcemaps and attribute the entry chunk's bytes to packages and modules. Don't add a dependency; a short sourcemap script or `npx source-map-explorer` is fine. Record the request log of the default screen.
2. Move whatever isn't needed for the first screen behind `React.lazy` / `import()` in `dev/`: likely candidates are the board editor, cards, notation and audio. Use `manualChunks` only where it helps caching.
3. Re-measure.

## Tasks

### T1 — measure, split, re-measure
- **Depends on:** — (can run in parallel with 0043, whose files don't overlap)
- **Route:** implement (default)
- **Owns:** `packages/chordl-react/dev/**`, `packages/chordl-react/vite.site.config.ts`
- **May read:** anything
- **Acceptance:** AC1–AC4
- **Notes / gotchas:** `vite.site.config.ts` aliases `@pepperhorn/chordl-react` and board to source on purpose. Keep that. CI runs `build:site` because a missing name in dev/App.tsx once blanked the live site (#96).

## Merge order
T1

## Risks
A lazy boundary wrapped around something the first screen needs only adds a waterfall. AC1's request log is the check.
