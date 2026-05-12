# ph-chordl: Astro v6 wrapper with Directus cache + human-in-the-loop ratings

**Status:** Approved design, pending implementation plan
**Date:** 2026-05-12
**Touches:** `pepperhorn/chordl` (this public repo) + new private `pepperhorn/ph-chordl` repo

## Goal

Wrap the public chordl React component in a private Astro v6 app that:

1. Caches generated chord/progression results (parsed JSON + per-variation SVG, plus PNG on demand) in a Directus collection on ph-apps, keyed by user input + render config, and serves from cache on hit.
2. Adds a human-in-the-loop rating layer: every `(chord × voicing)` variation gets thumbs-up / thumbs-down buttons; thumbs-down opens an inline ≤150-char reason field. All ratings persist to Directus alongside the cached state for offline review.
3. Keeps the Directus token off the client by running Astro with a Node SSR adapter and routing all Directus calls through server endpoints.

## Repo topology

### `pepperhorn/chordl` (this repo, stays public)

- Continues to host `@pepperhorn/voicings`, `@pepperhorn/core`, `@pepperhorn/react` (renamed from `@better-chord/*` as part of first publish).
- Adds one minor public API extension to support per-variation extras (see §3).
- Publishes to public npm under `@pepperhorn` scope.

### `pepperhorn/ph-chordl` (new private repo, on disk at `~/ph-chordl/`)

- Astro v6 app with `@astrojs/node` SSR adapter (standalone mode).
- Consumes `@pepperhorn/react` from public npm like any other dep.
- Owns the Directus integration, cache lookup logic, and rating UI.
- Deploys to Coolify as a Node container.

## 1. Public chordl changes (this repo)

### 1.1 New types in `packages/chord-react/src/types.ts`

```ts
export interface VariationContext {
  /** e.g. "Cmaj7#5" */
  chordSymbol: string;
  /** position in progression, 0 if single chord */
  chordIndex: number;
  /** e.g. "closed", "drop2", "open" */
  voicingId: string;
  /** pitch + midi data for this rendered variation */
  notes: VariationNotes;
  /** rendered SVG markup for this variation */
  svgString: string;
}

export type RenderVariationExtras = (ctx: VariationContext) => ReactNode;
export type OnVariation = (ctx: VariationContext) => void;
```

`VariationNotes` reuses the existing internal note shape (pitches, midi numbers, octaves) — exact field set finalized during implementation against the current chord/voicing types.

### 1.2 Two new optional props

Two separate concerns, two props:

- `renderVariationExtras?: RenderVariationExtras` — called during render; return value is rendered as children alongside the variation cell. Used by ph-chordl for `<RatingButtons>`. Pure render, no side effects.
- `onVariation?: OnVariation` — fired in a post-render effect, once per variation per render pass. Used by ph-chordl to collect `{chord_symbol, voicing_id, notes_json, svg}` for the cache write. Pure side effect, no return value.

Both attach to whichever component renders the `(chord, voicing)` cells. Per current code that's likely `ChordGroup` and/or `VoicingVariantToggle` — implementer picks the single seam that surfaces every rendered variation exactly once.

When both props are absent, behavior is unchanged. Fully backwards compatible.

### 1.3 Package rename + first publish

- Rename `@better-chord/voicings` → `@pepperhorn/voicings`
- Rename `@better-chord/core` → `@pepperhorn/core`
- Rename `@better-chord/react` → `@pepperhorn/react`
- Update workspace references and root `package.json` scripts.
- Set `"publishConfig": { "access": "public" }` on each package.
- Bump to `0.2.0` (new prop is additive, but the rename is the headline change for first publish).
- Add CHANGELOG entries.
- Publish in dep order: voicings → core → react.

A GitHub Actions publish workflow is nice-to-have but not blocking; manual `pnpm publish` is acceptable for v0.2.0.

### 1.4 Tests

- Unit test in `packages/chord-react/test/` that mounts a chord/progression with `renderVariationExtras` and asserts the prop is invoked once per `(chord, voicing)` cell with a well-formed `VariationContext`.
- Existing tests must still pass without modification.

## 2. ph-chordl repo (new, private)

### 2.1 Layout

```
ph-chordl/
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── public/
└── src/
    ├── env.d.ts                 # astro:env schema
    ├── lib/
    │   ├── directus.ts          # SDK client (server-only import)
    │   ├── cache.ts             # getCached / saveToCache / recordRating
    │   ├── cacheKey.ts          # sha256 hash of normalized config (server + client)
    │   └── schema.ts            # typed Directus collection shapes
    ├── pages/
    │   ├── index.astro          # shell, mounts <ChordlIsland client:load />
    │   └── api/
    │       ├── cache/
    │       │   ├── [key].ts     # GET hit/miss
    │       │   └── index.ts     # POST write
    │       └── ratings.ts       # POST {variationId, rating, reason?}
    └── components/
        ├── ChordlIsland.tsx     # React island wrapping @pepperhorn/react
        └── RatingButtons.tsx    # thumbs UI + collapsible reason input
```

### 2.2 Env schema (`astro:env`)

```ts
// astro.config.mjs
env: {
  schema: {
    DIRECTUS_PHAPPS_URL:   { context: 'server', access: 'secret', type: 'string' },
    DIRECTUS_PHAPPS_TOKEN: { context: 'server', access: 'secret', type: 'string' },
  }
}
```

Both declared `server` + `secret`. Astro fails the build if any client-side module imports them. Set via Coolify env vars at deploy time.

### 2.3 Server endpoints

**`GET /api/cache/:key`**
- Looks up `chordl_cache` by `cache_key`, includes related `chordl_variations` (and variation `png` file id if present).
- Hit (200): returns `{ cache, variations[] }`. Fire-and-forget PATCH bumps `hit_count` and `last_hit_at`.
- Miss (404): empty body.

**`POST /api/cache`**
- Body: `{ cache_key, user_string, render_config, parsed_json, is_progression, variations: [{ chord_symbol, chord_index, voicing_id, notes_json, svg }] }`
- Creates the cache row + variation rows in one transaction (Directus batch). PNG not uploaded here — see §5 PNG policy.
- Returns the created cache row with variation IDs so the client can attach ratings later.

**`POST /api/ratings`**
- Body: `{ variation_id, rating: 'up' | 'down', reason?: string }`
- Validates `reason.length <= 150` when present; required when `rating === 'down'` (server enforces).
- PATCHes the variation row with `rating`, `rating_reason`, `rating_at`.

All endpoints log + swallow Directus errors so client never blocks on cache infra. Returns appropriate status; client treats 5xx as cache-bypass.

### 2.4 React island (`ChordlIsland.tsx`)

- Owns the user-input state (port the relevant pieces of current `dev/App.tsx`).
- Debounces input ~400ms; computes `cache_key` client-side using `lib/cacheKey.ts`.
- `fetch('/api/cache/' + key)` → if hit, hydrates from cached state and renders chordl with cached `parsed_json`. If miss, lets chordl render locally, then `POST`s the freshly rendered output.
- Passes `renderVariationExtras={(ctx) => <RatingButtons cacheKey={cacheKey} variation={ctx} />}` into chordl.
- Maintains a local `cacheKey → variation_id[]` map populated after the cache write returns, so `RatingButtons` knows which Directus variation row to PATCH.

### 2.5 RatingButtons component

- Two icon buttons (👍 / 👎) per variation, mounted via `renderVariationExtras`.
- Tailwind for layout; semantic class names per repo CSS convention (e.g. `.rating-buttons`, `.rating-thumb-up`).
- Click 👍: optimistic UI, POST to `/api/ratings` with `rating: 'up'`.
- Click 👎: reveals an inline `<textarea maxLength={150}>` + Submit. Submit POSTs `rating: 'down', reason`. Cancel collapses the field without submitting.
- Disabled state if no `variation_id` yet (i.e. cache write still in flight) — buttons enable as soon as the POST returns IDs.
- Visual confirmation after submit (e.g. button stays "active" colored).

## 3. Directus collections (created in ph-apps via MCP during execution)

### `chordl_cache`

| Field            | Type         | Notes                                                  |
|------------------|--------------|--------------------------------------------------------|
| `id`             | uuid (pk)    |                                                        |
| `cache_key`      | string       | unique index, sha256 of normalized config              |
| `user_string`    | text         | raw input, e.g. `"Cmaj7#5 starting on G#"`             |
| `render_config`  | json         | expanded inputs that fed `cache_key` (debug)           |
| `parsed_json`    | json         | full chordl output (chords, notes, voicings)           |
| `is_progression` | boolean      |                                                        |
| `schema_version` | integer      | bump to invalidate stale rows on read                  |
| `hit_count`      | integer      | default 0                                              |
| `last_hit_at`    | timestamp    | nullable                                               |
| `date_created`   | timestamp    | Directus standard field                                |

### `chordl_variations`

| Field           | Type                       | Notes                                            |
|-----------------|----------------------------|--------------------------------------------------|
| `id`            | uuid (pk)                  |                                                  |
| `cache`         | m2o → `chordl_cache`       | parent                                           |
| `chord_symbol`  | string                     | e.g. `"Cmaj7"`                                   |
| `chord_index`   | integer                    | position in progression, 0 for single            |
| `voicing_id`    | string                     | e.g. `"closed"`, `"drop2"`, `"open"`             |
| `notes_json`    | json                       | per-variation pitch/midi data                    |
| `svg`           | text                       | inline SVG markup                                |
| `png`           | file (m2o → directus_files)| nullable; uploaded only on user export           |
| `rating`        | string                     | nullable; one of `up` / `down`                   |
| `rating_reason` | string (max 150)           | nullable; required server-side when `down`       |
| `rating_at`     | timestamp                  | nullable                                         |

A scoped Directus role (`chordl_service`) gets create + read + update on these two collections only, no other access. The token belonging to that role is what Coolify injects.

## 4. Data flow

**Cache hit path (debounced input change):**
1. Client computes `cache_key`.
2. `GET /api/cache/:key` → hit.
3. Render chordl with cached `parsed_json` (avoids re-parse).
4. `RatingButtons` mount with known `variation_id`s from the response.

**Cache miss path:**
1. Client computes `cache_key`, GET returns 404.
2. chordl renders normally from input string.
3. `onVariation` fires once per `(chord, voicing)` cell; island accumulates the contexts into a ref keyed by `cache_key`.
4. After all variations have reported (one tick after render), `POST /api/cache` writes the cache row + variations.
5. Returned variation IDs unlock `RatingButtons`.

**Rating path:**
1. User clicks 👍 → optimistic state, `POST /api/ratings`.
2. User clicks 👎 → reveal textarea → Submit → `POST /api/ratings` with reason.
3. Server PATCHes the variation row.

## 5. Edge cases & policies

- **Directus down or 5xx:** never block render. Log to console, render locally, skip cache write.
- **PNG storage:** SVG always cached (small, text). PNG only uploaded if the user explicitly exports it (existing export flow). Avoids hammering Directus files on every keystroke.
- **Schema drift:** `schema_version` integer on cache rows. Read path discards rows whose `schema_version` ≠ current.
- **Cache key normalization:** `cacheKey.ts` lowercases + trims `user_string`, sorts object keys in `render_config` before hashing, so equivalent inputs collide.
- **Rating uniqueness:** a variation can be re-rated; latest rating wins (single mutable `rating` field). If we want history later, that's a follow-up `chordl_rating_events` collection — out of scope here.
- **Reason validation:** server enforces `length ≤ 150`. Client also enforces via `maxLength` for UX.
- **No auth, anonymous ratings:** single shared cache and rating pool. Acceptable for internal/dogfood use. Per-user ratings is a follow-up.

## 6. Non-goals

- Per-user accounts or auth.
- Admin UI for browsing thumbs-down feedback (use Directus admin directly for v1).
- Retry queues / offline buffering for failed cache writes.
- Migrating the existing `dev/App.tsx` controls (theme/scale/etc.) into the public package — they stay in ph-chordl's island for now.
- Chord generation via LLM. Cache layer is forward-compatible with this but we're not adding generation in this spec.

## 7. Order of execution (high level)

1. Public chordl: rename packages to `@pepperhorn/*`, add `renderVariationExtras` prop + types + tests, bump to `0.2.0`, publish to npm in dep order.
2. ph-apps: create `chordl_cache` + `chordl_variations` collections + `chordl_service` role/token via MCP.
3. New repo: scaffold `~/ph-chordl/` (Astro v6 + Node adapter + React + Tailwind), install `@pepperhorn/react`.
4. Implement `lib/directus.ts`, `lib/cacheKey.ts`, `lib/cache.ts`, `lib/schema.ts`.
5. Implement server endpoints (`/api/cache/[key].ts`, `/api/cache/index.ts`, `/api/ratings.ts`).
6. Build `ChordlIsland.tsx` (port input UI from current `dev/App.tsx`) + `RatingButtons.tsx`.
7. `index.astro` shell, README, `.env.example`, Coolify deploy notes.
8. Smoke test end-to-end against ph-apps.

Detailed step-by-step plan lives in the implementation plan that follows this spec.
