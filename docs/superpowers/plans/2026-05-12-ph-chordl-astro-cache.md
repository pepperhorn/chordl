# ph-chordl Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the public chordl React lib in a private Astro v6 app (`~/ph-chordl/`) that caches generated chord/progression results in ph-apps Directus and adds per-variation thumbs-up/down ratings, with the Directus token kept server-side via `astro:env`.

**Architecture:**
- Public `chordl` (this repo) stays a pure React component lib. We add two optional props (`renderVariationExtras`, `onVariation`) to the components that render `(chord, voicing)` cells, rename packages from `@better-chord/*` to `@pepperhorn/*`, and publish to public npm.
- Private `~/ph-chordl/` is an Astro v6 app with the Node SSR adapter. A React island wraps `@pepperhorn/react`, a Tailwind `<RatingButtons>` component mounts on each variation via the new render-prop, and three server endpoints (`/api/cache/[key]`, `/api/cache`, `/api/ratings`) talk to ph-apps. Directus token never leaves the server.
- v1 cache scope: only variations the user has *actually viewed* are cached and become ratable (lazy-cache). Pre-rendering every voicing without the user navigating to it is out of scope.

**Tech Stack:**
- Public lib: TypeScript, React 19, Vite, pnpm workspaces, Vitest, Testing Library.
- Private app: Astro v6 (`@astrojs/node` SSR adapter, standalone), React 19 island, Tailwind, `@directus/sdk`, `@pepperhorn/react`.
- Backend: Directus on `https://apps.pepperhorn.com` (ph-apps), accessed via the ph-apps MCP for schema setup.

**Reference spec:** `docs/superpowers/specs/2026-05-12-ph-chordl-astro-cache-design.md`

---

## Phase A — Public chordl: extension + rename + publish

### Task A1: Add `VariationContext` types

**Files:**
- Modify: `packages/chord-react/src/types.ts`

- [ ] **Step 1: Add the new types**

Append to `packages/chord-react/src/types.ts`:

```ts
import type { ReactNode } from "react";

/**
 * Description of a single rendered (chord, voicing) cell.
 * Surfaced via `renderVariationExtras` and `onVariation` so consumers
 * can attach per-variation overlays (rating UI, telemetry, etc.).
 */
export interface VariationContext {
  /** Chord symbol as rendered, e.g. "Cmaj7#5" */
  chordSymbol: string;
  /** Position in a progression; 0 for a single-chord render */
  chordIndex: number;
  /** Voicing identifier, e.g. "closed" / "drop2" / "open" / "default" */
  voicingId: string;
  /** Notes used in this variation (note-name strings as rendered) */
  notes: string[];
  /** Inline SVG markup of the rendered variation */
  svgString: string;
}

export type RenderVariationExtras = (ctx: VariationContext) => ReactNode;
export type OnVariation = (ctx: VariationContext) => void;
```

If `ReactNode` is already imported in this file, don't add a duplicate import — extend the existing one.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @better-chord/react lint`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add packages/chord-react/src/types.ts
git commit -m "feat(react): add VariationContext + render/callback prop types"
```

---

### Task A2: Wire props into `PianoChord` (the variation render seam)

`PianoChord` is the lowest-level component that renders a single (chord, voicing) cell to SVG. Adding the seam here means every higher-level wrapper (`VoicingVariantToggle`, `ChordGroup`, `ProgressionView`, `ChordSheet`) just needs to forward props.

**Files:**
- Modify: `packages/chord-react/src/components/PianoChord.tsx`
- Test: `packages/chord-react/test/PianoChord.variation-props.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/chord-react/test/PianoChord.variation-props.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PianoChord } from "../src/components/PianoChord";

describe("PianoChord variation props", () => {
  it("calls onVariation once per render with chord context", async () => {
    const onVariation = vi.fn();
    render(<PianoChord chord="Cmaj7" onVariation={onVariation} voicingId="default" />);
    // onVariation fires in a post-render effect
    await new Promise((r) => setTimeout(r, 0));
    expect(onVariation).toHaveBeenCalledTimes(1);
    const ctx = onVariation.mock.calls[0][0];
    expect(ctx.chordSymbol).toBe("Cmaj7");
    expect(ctx.voicingId).toBe("default");
    expect(ctx.chordIndex).toBe(0);
    expect(Array.isArray(ctx.notes)).toBe(true);
    expect(typeof ctx.svgString).toBe("string");
    expect(ctx.svgString).toContain("<svg");
  });

  it("renders renderVariationExtras output as a sibling to the SVG", async () => {
    render(
      <PianoChord
        chord="Cmaj7"
        renderVariationExtras={(ctx) => (
          <div data-testid="extras">extras for {ctx.chordSymbol}</div>
        )}
      />,
    );
    expect(await screen.findByTestId("extras")).toHaveTextContent("extras for Cmaj7");
  });

  it("is a no-op when neither prop is provided", () => {
    const { container } = render(<PianoChord chord="Cmaj7" />);
    expect(container.querySelector("svg")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @better-chord/react test:run -- PianoChord.variation-props`
Expected: FAIL — props don't exist yet, or `onVariation` never fires.

- [ ] **Step 3: Extend `ChordProps` in `PianoChord.tsx`**

In `packages/chord-react/src/components/PianoChord.tsx`, at the top with other imports, add:

```ts
import { useEffect, useRef } from "react";
import type { RenderVariationExtras, OnVariation, VariationContext } from "../types";
```

Find the `ChordProps` interface (it's the props type passed to `PianoChord`; if not exported as such, look for the inline type used by `isChordProps`). Add three optional fields:

```ts
  onVariation?: OnVariation;
  renderVariationExtras?: RenderVariationExtras;
  /** Voicing identifier reported in VariationContext; defaults to "default". */
  voicingId?: string;
  /** Position in a progression; defaults to 0. */
  chordIndex?: number;
```

- [ ] **Step 4: Wire the props in the render output**

Inside the `PianoChord` function, after destructuring props, destructure the new ones too. Wrap the component's existing return in a container that:
1. Captures the rendered SVG via a ref.
2. Calls `onVariation` in a post-render `useEffect`.
3. Renders `renderVariationExtras(ctx)` as a sibling to the SVG.

Add right after the existing prop destructuring near the top of the function body:

```ts
  const { onVariation, renderVariationExtras, voicingId = "default", chordIndex = 0 } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastReportedRef = useRef<string>("");
```

Then locate every `return (...)` in `PianoChord` (there are multiple — scale path, error path, main path). Wrap each top-level returned JSX in a single wrapping `<div ref={containerRef} className="bc-pianochord-root">...</div>` (preserving existing className/style on the inner content). After the wrapping div, add the extras call inline:

```tsx
return (
  <>
    <div ref={containerRef} className="bc-pianochord-root">
      {/* existing JSX */}
    </div>
    {renderVariationExtras?.(buildContextSnapshot())}
  </>
);
```

Add a single helper at the top of the function body (above the early returns) so all return paths share it:

```ts
  // Notes that this PianoChord render uses — derived per branch below.
  // Each return path sets `currentNotes` before returning so the helper has data.
  let currentNotes: string[] = [];
  const buildContextSnapshot = (): VariationContext => ({
    chordSymbol: typeof chord === "string" ? chord : String(chord),
    chordIndex,
    voicingId,
    notes: currentNotes,
    svgString: containerRef.current?.querySelector("svg")?.outerHTML ?? "",
  });
```

In each branch, set `currentNotes` to the list of notes that branch renders. Two main branches:
- Scale branch (around line 96): `currentNotes = scaleKeyboardNotes;`
- Main chord branch: `currentNotes = highlightKeys ?? notes ?? [];` — set this immediately before the return.

Add the effect once near the top of the function body (after `containerRef` is declared):

```ts
  useEffect(() => {
    if (!onVariation) return;
    const snapshot = buildContextSnapshot();
    // Avoid duplicate emissions when nothing meaningful changed
    const fingerprint = `${snapshot.chordSymbol}|${snapshot.voicingId}|${snapshot.chordIndex}|${snapshot.notes.join(",")}|${snapshot.svgString.length}`;
    if (fingerprint === lastReportedRef.current) return;
    lastReportedRef.current = fingerprint;
    onVariation(snapshot);
  });
```

Note: `useEffect` with no dependency array runs after every render, which is correct here — we want to re-emit whenever the rendered SVG changes. The `fingerprint` guard suppresses true no-ops.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @better-chord/react test:run -- PianoChord.variation-props`
Expected: PASS, all 3 tests.

Run full suite: `pnpm --filter @better-chord/react test:run`
Expected: PASS — existing tests must not regress.

- [ ] **Step 6: Commit**

```bash
git add packages/chord-react/src/components/PianoChord.tsx packages/chord-react/test/PianoChord.variation-props.test.tsx
git commit -m "feat(react): add onVariation + renderVariationExtras props to PianoChord"
```

---

### Task A3: Forward props through `VoicingVariantToggle`

`VoicingVariantToggle` renders one `PianoChord` per active variant. It must pass through the new props and supply `voicingId` from the active variant's label.

**Files:**
- Modify: `packages/chord-react/src/components/VoicingVariantToggle.tsx`

- [ ] **Step 1: Add props to interface**

In `VoicingVariantToggleProps` (top of file), add:

```ts
  onVariation?: import("../types").OnVariation;
  renderVariationExtras?: import("../types").RenderVariationExtras;
  /** Position in progression, forwarded to PianoChord. Default 0. */
  chordIndex?: number;
```

- [ ] **Step 2: Forward to both `<PianoChord>` instances**

There are two `<PianoChord ... />` call sites in this file (the early-return single-variant path around line 99 and the active-variant render around line 202). On both, add:

```tsx
        onVariation={props.onVariation}
        renderVariationExtras={props.renderVariationExtras}
        chordIndex={props.chordIndex ?? 0}
        voicingId={variants[activeIndex]?.label ?? "default"}
```

For the early-return single-variant path (no `variants` array), use `voicingId="default"`.

Update the function signature to receive `props` directly or destructure the new ones:

```ts
export function VoicingVariantToggle(props: VoicingVariantToggleProps) {
  const { chord, format, theme, highlightColor, scale, display, uiTheme, onExportStatus, onVariation, renderVariationExtras, chordIndex } = props;
  // ...rest unchanged
}
```

- [ ] **Step 3: Verify it compiles + tests pass**

Run: `pnpm --filter @better-chord/react lint && pnpm --filter @better-chord/react test:run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/chord-react/src/components/VoicingVariantToggle.tsx
git commit -m "feat(react): forward variation props through VoicingVariantToggle"
```

---

### Task A4: Forward props through `ChordGroup`, `ProgressionView`, `ChordSheet`

These render multiple chords. Each chord call should set `chordIndex` to its position and `voicingId="default"` (no voicing variants here in v1).

**Files:**
- Modify: `packages/chord-react/src/components/ChordGroup.tsx`
- Modify: `packages/chord-react/src/components/ProgressionView.tsx`
- Modify: `packages/chord-react/src/components/ChordSheet.tsx`

- [ ] **Step 1: Update each component's Props**

In each of the three files, add to the props interface:

```ts
  onVariation?: import("../types").OnVariation;
  renderVariationExtras?: import("../types").RenderVariationExtras;
```

- [ ] **Step 2: Plumb to inner `<PianoChord>` (or `<ChordGroup>`/`<VoicingVariantToggle>`) calls**

In each file, locate the inner render of `PianoChord` / `VoicingVariantToggle` / `ChordGroup`. For each chord cell:
- Set `chordIndex={i}` (where `i` is the position in the iteration; use `0` if non-iterated).
- Forward `onVariation={props.onVariation}` and `renderVariationExtras={props.renderVariationExtras}`.
- For `<PianoChord>` calls, also set `voicingId="default"`.

If a component delegates to another (e.g. `ChordSheet` → `ProgressionView` → `ChordGroup`), forward the props at every layer.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @better-chord/react lint && pnpm --filter @better-chord/react test:run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/chord-react/src/components/ChordGroup.tsx packages/chord-react/src/components/ProgressionView.tsx packages/chord-react/src/components/ChordSheet.tsx
git commit -m "feat(react): forward variation props through progression components"
```

---

### Task A5: Export the new types from the package

**Files:**
- Modify: `packages/chord-react/src/index.ts`

- [ ] **Step 1: Add re-exports**

At the top of the type re-exports block in `packages/chord-react/src/index.ts`, add:

```ts
export type { VariationContext, RenderVariationExtras, OnVariation } from "./types";
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @better-chord/react build`
Expected: PASS, `dist/index.d.ts` contains `VariationContext`.

Verify: `grep -q "VariationContext" packages/chord-react/dist/index.d.ts && echo OK`

- [ ] **Step 3: Commit**

```bash
git add packages/chord-react/src/index.ts
git commit -m "feat(react): export VariationContext and friends"
```

---

### Task A6: Rename packages from `@better-chord/*` to `@pepperhorn/*`

**Files:**
- Modify: `packages/voicings/package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/chord-react/package.json`
- Modify: `packages/render-cli/package.json`
- Modify: root `package.json` (script filters)
- Modify: every `.ts`/`.tsx`/`.json` file with `@better-chord/` references

- [ ] **Step 1: Find every reference**

Run:

```bash
grep -rln "@better-chord" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" .
```

Expect ~25 files (matches the inventory captured during planning). Save the list.

- [ ] **Step 2: Rename in `package.json` files**

In each of `packages/voicings/package.json`, `packages/core/package.json`, `packages/chord-react/package.json`, `packages/render-cli/package.json`:
- Change `"name": "@better-chord/X"` → `"name": "@pepperhorn/X"`.
- Update any `dependencies`/`peerDependencies`/`devDependencies` entries `@better-chord/X` → `@pepperhorn/X`.
- Add `"publishConfig": { "access": "public" }` to each of the three publishable packages (voicings, core, chord-react). `render-cli` is internal; mark it `"private": true` if not already.

- [ ] **Step 3: Update root `package.json` script filters**

In `package.json`, replace every `--filter @better-chord/X` with `--filter @pepperhorn/X` in `scripts`.

- [ ] **Step 4: Sweep import statements**

Run a global replace across `.ts`/`.tsx` source and test files:

```bash
grep -rl "@better-chord/" --include="*.ts" --include="*.tsx" packages/ | \
  xargs sed -i 's|@better-chord/|@pepperhorn/|g'
```

Then double-check: `grep -rn "@better-chord" packages/` → should be empty.

- [ ] **Step 5: Update README references**

Run: `grep -n "@better-chord" README.md` and replace any matches with `@pepperhorn`.

- [ ] **Step 6: Reinstall + rebuild + retest**

```bash
pnpm install
pnpm --filter @pepperhorn/voicings build
pnpm --filter @pepperhorn/core build
pnpm --filter @pepperhorn/react build
pnpm --filter @pepperhorn/voicings test:run
pnpm --filter @pepperhorn/core test:run
pnpm --filter @pepperhorn/react test:run
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: rename packages from @better-chord to @pepperhorn"
```

---

### Task A7: Bump versions, write CHANGELOG, publish to npm

**Files:**
- Modify: `packages/voicings/package.json` (version)
- Modify: `packages/core/package.json` (version)
- Modify: `packages/chord-react/package.json` (version)
- Create or modify: `CHANGELOG.md` (root)

- [ ] **Step 1: Bump all three package versions to `0.2.0`**

Edit the three `package.json` files: set `"version": "0.2.0"`.

- [ ] **Step 2: Add CHANGELOG entry**

Create or prepend to `CHANGELOG.md`:

```markdown
## 0.2.0 — 2026-05-12

### Breaking
- Renamed packages: `@better-chord/voicings|core|react` → `@pepperhorn/voicings|core|react`. Update your imports.

### Added
- `VariationContext`, `RenderVariationExtras`, `OnVariation` types exported from `@pepperhorn/react`.
- New optional props on `PianoChord`, `VoicingVariantToggle`, `ChordGroup`, `ProgressionView`, `ChordSheet`:
  - `onVariation?: (ctx) => void` — fired post-render for each rendered (chord, voicing) cell.
  - `renderVariationExtras?: (ctx) => ReactNode` — render arbitrary children alongside each variation cell.
- First public publish to npm under `@pepperhorn` scope.
```

- [ ] **Step 3: Confirm npm login + scope access (manual gate)**

Run: `npm whoami`
Expected: prints your npm username.

If not logged in, run `npm login` interactively. Confirm the `@pepperhorn` scope is yours / available; if not, **stop and ask the user** before publishing.

- [ ] **Step 4: Dry-run publish in dep order**

```bash
pnpm --filter @pepperhorn/voicings publish --access public --dry-run
pnpm --filter @pepperhorn/core publish --access public --dry-run
pnpm --filter @pepperhorn/react publish --access public --dry-run
```

Expected: all show the file list + version `0.2.0` with no errors.

- [ ] **Step 5: Real publish**

```bash
pnpm --filter @pepperhorn/voicings publish --access public --no-git-checks
pnpm --filter @pepperhorn/core publish --access public --no-git-checks
pnpm --filter @pepperhorn/react publish --access public --no-git-checks
```

Verify each: `npm view @pepperhorn/react version` → `0.2.0`.

- [ ] **Step 6: Commit + tag**

```bash
git add -A
git commit -m "chore: release @pepperhorn/* v0.2.0"
git tag v0.2.0
```

(Push the tag later when convenient: `git push --tags`.)

---

## Phase B — Directus collections in ph-apps

These tasks use the `mcp__claude_ai_ph-apps__*` MCP tools. Each call should be confirmed against ph-apps after creation.

### Task B1: Create the `chordl_service` role

**Tools:** `mcp__claude_ai_ph-apps__schema`, `mcp__claude_ai_ph-apps__operations`

- [ ] **Step 1: Inspect existing roles + permissions schema**

Call `mcp__claude_ai_ph-apps__system-prompt` first to confirm available actions. Then list roles via the appropriate operation.

- [ ] **Step 2: Create role `chordl_service`**

Create a Directus role named `chordl_service` with **no admin access** and no app access. Permissions will be granted to the two new collections after they're created.

- [ ] **Step 3: Create a static token for the role**

Create a user assigned to `chordl_service`, generate a static access token. Save the token — you'll paste it into ph-chordl's `.env` and Coolify env vars.

**Stop and report the token to the user (one-time secret).**

---

### Task B2: Create `chordl_cache` collection

- [ ] **Step 1: Create the collection**

Use `mcp__claude_ai_ph-apps__collections` to create `chordl_cache` with these fields. Use Directus standard `id` (uuid pk), `date_created`, `date_updated` automatically.

| Field            | Type      | Required | Notes                              |
|------------------|-----------|----------|------------------------------------|
| `cache_key`      | string    | yes      | unique index                       |
| `user_string`    | text      | yes      |                                    |
| `render_config`  | json      | yes      |                                    |
| `parsed_json`    | json      | yes      |                                    |
| `is_progression` | boolean   | yes      | default false                      |
| `schema_version` | integer   | yes      | default 1                          |
| `hit_count`      | integer   | no       | default 0                          |
| `last_hit_at`    | timestamp | no       | nullable                           |

- [ ] **Step 2: Add unique index on `cache_key`**

Either via Directus field meta (`unique: true`) or a separate index op.

- [ ] **Step 3: Verify**

Fetch the collection schema; confirm field list matches.

---

### Task B3: Create `chordl_variations` collection

- [ ] **Step 1: Create the collection**

| Field           | Type      | Required | Notes                                  |
|-----------------|-----------|----------|----------------------------------------|
| `cache`         | uuid (m2o → `chordl_cache.id`) | yes |                                        |
| `chord_symbol`  | string    | yes      |                                        |
| `chord_index`   | integer   | yes      | default 0                              |
| `voicing_id`    | string    | yes      | default "default"                      |
| `notes_json`    | json      | yes      |                                        |
| `svg`           | text      | yes      |                                        |
| `png`           | uuid (m2o → directus_files) | no |                                        |
| `rating`        | string    | no       | nullable; values: `up` / `down`        |
| `rating_reason` | string    | no       | nullable; max length 150               |
| `rating_at`     | timestamp | no       | nullable                               |

Use `relations` MCP op to wire the `cache` m2o and the `png` file relation.

- [ ] **Step 2: Verify**

Confirm both collections + the `cache → variations` o2m show up cleanly in the schema.

---

### Task B4: Grant `chordl_service` role permissions on both collections

- [ ] **Step 1: Permissions to add**

For role `chordl_service`:
- `chordl_cache`: `create`, `read`, `update` (no delete).
- `chordl_variations`: `create`, `read`, `update` (no delete).
- `directus_files`: `create`, `read` (needed to upload PNGs on user export).

No other collections accessible.

- [ ] **Step 2: Verify**

Try a `read` on `chordl_cache` with the token (curl or MCP `items` op): expect empty list, status 200. Try `read` on a non-allowed collection: expect 403.

---

## Phase C — Scaffold `~/ph-chordl/` Astro v6 app

### Task C1: Initialize the new private repo

**Files (all created):**
- `~/ph-chordl/.gitignore`
- `~/ph-chordl/package.json`
- `~/ph-chordl/tsconfig.json`
- `~/ph-chordl/astro.config.mjs`
- `~/ph-chordl/README.md`

- [ ] **Step 1: Scaffold via Astro CLI**

```bash
cd ~
pnpm create astro@latest ph-chordl -- --template minimal --typescript strict --no-install --no-git --skip-houston
```

If the CLI version differs slightly, use the equivalent flags. Result: `~/ph-chordl/` with a minimal Astro project.

- [ ] **Step 2: Add Node SSR adapter + React + Tailwind**

```bash
cd ~/ph-chordl
pnpm install
pnpm astro add node react tailwind --yes
```

Confirm `astro.config.mjs` now contains:
- `output: 'server'`
- `adapter: node({ mode: 'standalone' })`
- React + Tailwind integrations

If `output` is not set, edit `astro.config.mjs` to add `output: 'server'`.

- [ ] **Step 3: Add chordl + Directus deps**

```bash
pnpm add @pepperhorn/react @pepperhorn/core @pepperhorn/voicings @directus/sdk
```

Confirm versions are `0.2.0` for the @pepperhorn packages.

- [ ] **Step 4: Init git + first commit**

```bash
cd ~/ph-chordl
git init
git add -A
git commit -m "chore: scaffold Astro v6 + Node SSR + React + Tailwind"
```

- [ ] **Step 5: Create the GitHub private repo + push (manual gate)**

Use `gh` (or ask the user to create `pepperhorn/ph-chordl` private on GitHub). Then:

```bash
gh repo create pepperhorn/ph-chordl --private --source=. --remote=origin --push
```

If `gh` not available, stop and ask the user to create the repo and provide the SSH URL.

---

### Task C2: Add `astro:env` schema for the Directus secret

**Files:**
- Modify: `~/ph-chordl/astro.config.mjs`
- Create: `~/ph-chordl/.env.example`
- Create: `~/ph-chordl/.env` (gitignored)

- [ ] **Step 1: Edit `astro.config.mjs`**

Add the `env` block at the top level of the `defineConfig({ ... })` object:

```js
import { defineConfig, envField } from 'astro/config';

export default defineConfig({
  output: 'server',
  // ...adapter + integrations as scaffolded
  env: {
    schema: {
      DIRECTUS_PHAPPS_URL:   envField.string({ context: 'server', access: 'secret' }),
      DIRECTUS_PHAPPS_TOKEN: envField.string({ context: 'server', access: 'secret' }),
    },
  },
});
```

- [ ] **Step 2: Create `.env.example`**

```
# ph-apps Directus base URL (server-only; read by Astro at runtime)
DIRECTUS_PHAPPS_URL=https://apps.pepperhorn.com

# Static token for the chordl_service role (server-only; never expose to client)
DIRECTUS_PHAPPS_TOKEN=replace-me
```

- [ ] **Step 3: Create local `.env` from the values you have**

Copy `.env.example` to `.env` and fill in the real token from Task B1. Confirm `.env` is gitignored.

- [ ] **Step 4: Verify the build refuses client-side import of secrets**

Create a temporary `src/components/SecretLeak.tsx`:

```tsx
import { DIRECTUS_PHAPPS_TOKEN } from "astro:env/client";
export default function L() { return <span>{DIRECTUS_PHAPPS_TOKEN}</span>; }
```

Run: `pnpm astro check` (or `pnpm build`).
Expected: build/check FAILS with an error about importing a server-secret in client context.

Delete the temp file. Run again — should pass.

- [ ] **Step 5: Commit**

```bash
git add astro.config.mjs .env.example
git commit -m "feat: astro:env schema for Directus secrets"
```

---

## Phase D — Server lib + endpoints

### Task D1: `lib/cacheKey.ts` (with tests)

**Files:**
- Create: `~/ph-chordl/src/lib/cacheKey.ts`
- Create: `~/ph-chordl/src/lib/cacheKey.test.ts`
- Modify: `~/ph-chordl/package.json` (add vitest)

- [ ] **Step 1: Add vitest**

```bash
cd ~/ph-chordl
pnpm add -D vitest
```

Add `"test": "vitest run"` to `package.json` `scripts`.

- [ ] **Step 2: Write the failing test**

`src/lib/cacheKey.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeCacheKey, normalizeRenderConfig } from "./cacheKey";

describe("cacheKey", () => {
  it("produces the same key for equivalent configs regardless of property order", async () => {
    const a = await computeCacheKey({ user_string: "Cmaj7", render_config: { theme: "light", scale: 1.2 } });
    const b = await computeCacheKey({ user_string: "Cmaj7", render_config: { scale: 1.2, theme: "light" } });
    expect(a).toBe(b);
  });

  it("normalizes user_string (trim + lowercase)", async () => {
    const a = await computeCacheKey({ user_string: "  Cmaj7  ", render_config: {} });
    const b = await computeCacheKey({ user_string: "cmaj7", render_config: {} });
    expect(a).toBe(b);
  });

  it("differs when render_config differs", async () => {
    const a = await computeCacheKey({ user_string: "Cmaj7", render_config: { theme: "light" } });
    const b = await computeCacheKey({ user_string: "Cmaj7", render_config: { theme: "dark" } });
    expect(a).not.toBe(b);
  });

  it("returns a 64-char hex string", async () => {
    const k = await computeCacheKey({ user_string: "x", render_config: {} });
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });

  it("normalizeRenderConfig sorts keys deeply", () => {
    const out = normalizeRenderConfig({ b: 1, a: { y: 2, x: 1 } });
    expect(JSON.stringify(out)).toBe('{"a":{"x":1,"y":2},"b":1}');
  });
});
```

- [ ] **Step 3: Run test, expect failure**

Run: `pnpm test cacheKey`
Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement**

`src/lib/cacheKey.ts`:

```ts
export interface CacheKeyInput {
  user_string: string;
  render_config: Record<string, unknown>;
}

export function normalizeRenderConfig(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeRenderConfig);
  if (value && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[k] = normalizeRenderConfig((value as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return value;
}

export async function computeCacheKey(input: CacheKeyInput): Promise<string> {
  const normalized = {
    user_string: input.user_string.trim().toLowerCase(),
    render_config: normalizeRenderConfig(input.render_config ?? {}),
  };
  const data = new TextEncoder().encode(JSON.stringify(normalized));
  // Web Crypto works in both Node 18+ and browsers.
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 5: Run test, expect pass**

Run: `pnpm test cacheKey`
Expected: PASS, all 5 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/cacheKey.ts src/lib/cacheKey.test.ts package.json
git commit -m "feat(lib): cacheKey hashing with normalization + tests"
```

---

### Task D2: `lib/schema.ts` + `lib/directus.ts`

**Files:**
- Create: `~/ph-chordl/src/lib/schema.ts`
- Create: `~/ph-chordl/src/lib/directus.ts`

- [ ] **Step 1: Write `schema.ts`**

```ts
export interface ChordlVariationRow {
  id: string;
  cache: string;
  chord_symbol: string;
  chord_index: number;
  voicing_id: string;
  notes_json: { notes: string[]; midi?: number[] };
  svg: string;
  png?: string | null;
  rating?: "up" | "down" | null;
  rating_reason?: string | null;
  rating_at?: string | null;
}

export interface ChordlCacheRow {
  id: string;
  cache_key: string;
  user_string: string;
  render_config: Record<string, unknown>;
  parsed_json: Record<string, unknown>;
  is_progression: boolean;
  schema_version: number;
  hit_count: number;
  last_hit_at?: string | null;
  date_created?: string;
}

export interface DirectusSchema {
  chordl_cache: ChordlCacheRow[];
  chordl_variations: ChordlVariationRow[];
}

export const SCHEMA_VERSION = 1;
```

- [ ] **Step 2: Write `directus.ts`**

```ts
import { createDirectus, rest, staticToken } from "@directus/sdk";
import { DIRECTUS_PHAPPS_URL, DIRECTUS_PHAPPS_TOKEN } from "astro:env/server";
import type { DirectusSchema } from "./schema";

let _client: ReturnType<typeof build> | null = null;

function build() {
  return createDirectus<DirectusSchema>(DIRECTUS_PHAPPS_URL)
    .with(staticToken(DIRECTUS_PHAPPS_TOKEN))
    .with(rest());
}

export function directus() {
  if (!_client) _client = build();
  return _client;
}
```

- [ ] **Step 3: Verify `astro check`**

Run: `pnpm astro check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/schema.ts src/lib/directus.ts
git commit -m "feat(lib): typed Directus client + schema"
```

---

### Task D3: `lib/cache.ts` — read/write/rate helpers

**Files:**
- Create: `~/ph-chordl/src/lib/cache.ts`

- [ ] **Step 1: Implement**

```ts
import { readItems, createItem, updateItem, createItems } from "@directus/sdk";
import { directus } from "./directus";
import { SCHEMA_VERSION, type ChordlCacheRow, type ChordlVariationRow } from "./schema";

export interface CacheHit {
  cache: ChordlCacheRow;
  variations: ChordlVariationRow[];
}

export async function getCached(cacheKey: string): Promise<CacheHit | null> {
  const rows = await directus().request(
    readItems("chordl_cache", {
      filter: { cache_key: { _eq: cacheKey }, schema_version: { _eq: SCHEMA_VERSION } },
      fields: ["*", { variations: ["*"] } as any],
      limit: 1,
    } as any),
  );
  const row = (rows as any[])?.[0];
  if (!row) return null;
  const variations = (row.variations ?? []) as ChordlVariationRow[];
  // Fire-and-forget hit bump
  void directus()
    .request(updateItem("chordl_cache", row.id, {
      hit_count: (row.hit_count ?? 0) + 1,
      last_hit_at: new Date().toISOString(),
    }))
    .catch(() => {});
  return { cache: row as ChordlCacheRow, variations };
}

export interface SaveCacheInput {
  cache_key: string;
  user_string: string;
  render_config: Record<string, unknown>;
  parsed_json: Record<string, unknown>;
  is_progression: boolean;
  variations: Array<Pick<ChordlVariationRow, "chord_symbol" | "chord_index" | "voicing_id" | "notes_json" | "svg">>;
}

export async function saveToCache(input: SaveCacheInput): Promise<CacheHit> {
  const cache = (await directus().request(
    createItem("chordl_cache", {
      cache_key: input.cache_key,
      user_string: input.user_string,
      render_config: input.render_config,
      parsed_json: input.parsed_json,
      is_progression: input.is_progression,
      schema_version: SCHEMA_VERSION,
      hit_count: 0,
    }),
  )) as ChordlCacheRow;

  const variations = (await directus().request(
    createItems(
      "chordl_variations",
      input.variations.map((v) => ({ ...v, cache: cache.id })),
    ),
  )) as ChordlVariationRow[];

  return { cache, variations };
}

export async function recordRating(
  variationId: string,
  rating: "up" | "down",
  reason?: string,
): Promise<void> {
  if (rating === "down" && (!reason || reason.length === 0)) {
    throw new Error("rating_reason is required for thumbs-down");
  }
  if (reason && reason.length > 150) {
    throw new Error("rating_reason exceeds 150 characters");
  }
  await directus().request(
    updateItem("chordl_variations", variationId, {
      rating,
      rating_reason: reason ?? null,
      rating_at: new Date().toISOString(),
    }),
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm astro check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cache.ts
git commit -m "feat(lib): cache get/save + rating helpers"
```

---

### Task D4: `GET /api/cache/[key].ts`

**Files:**
- Create: `~/ph-chordl/src/pages/api/cache/[key].ts`

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from "astro";
import { getCached } from "../../../lib/cache";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key || !/^[0-9a-f]{64}$/.test(key)) {
    return new Response(JSON.stringify({ error: "invalid cache key" }), {
      status: 400, headers: { "content-type": "application/json" },
    });
  }
  try {
    const hit = await getCached(key);
    if (!hit) {
      return new Response(JSON.stringify({ hit: false }), {
        status: 404, headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ hit: true, ...hit }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[cache GET]", e);
    return new Response(JSON.stringify({ error: "cache backend error" }), {
      status: 502, headers: { "content-type": "application/json" },
    });
  }
};
```

- [ ] **Step 2: Smoke test**

Start dev server: `pnpm dev` (in another terminal).
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/api/cache/$(printf 'a%.0s' {1..64})`
Expected: `404` (cache miss for that key).

Run with an obviously bad key:
`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4321/api/cache/notavalidhex`
Expected: `400`.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/cache/\[key\].ts
git commit -m "feat(api): GET /api/cache/:key"
```

---

### Task D5: `POST /api/cache`

**Files:**
- Create: `~/ph-chordl/src/pages/api/cache/index.ts`

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from "astro";
import { saveToCache, type SaveCacheInput } from "../../../lib/cache";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: SaveCacheInput;
  try {
    body = (await request.json()) as SaveCacheInput;
  } catch {
    return json(400, { error: "invalid JSON" });
  }

  if (!body.cache_key || !/^[0-9a-f]{64}$/.test(body.cache_key)) return json(400, { error: "invalid cache_key" });
  if (typeof body.user_string !== "string" || body.user_string.length === 0) return json(400, { error: "user_string required" });
  if (!Array.isArray(body.variations) || body.variations.length === 0) return json(400, { error: "variations required" });
  for (const v of body.variations) {
    if (typeof v.chord_symbol !== "string" || typeof v.voicing_id !== "string" || typeof v.svg !== "string") {
      return json(400, { error: "variation missing required fields" });
    }
  }

  try {
    const result = await saveToCache(body);
    return json(201, result);
  } catch (e) {
    console.error("[cache POST]", e);
    return json(502, { error: "cache write failed" });
  }
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
```

- [ ] **Step 2: Smoke test**

With `pnpm dev` running, POST a cache row using one of the test keys against the live ph-apps backend. Use a key you can compute manually (e.g. via `node -e "import('./src/lib/cacheKey.ts').then(m => m.computeCacheKey({user_string:'Cmaj7', render_config:{}}).then(console.log))"` — adjust for ESM if needed).

```bash
KEY=<paste computed key>
curl -s -X POST http://localhost:4321/api/cache \
  -H 'content-type: application/json' \
  -d "{\"cache_key\":\"$KEY\",\"user_string\":\"Cmaj7\",\"render_config\":{},\"parsed_json\":{},\"is_progression\":false,\"variations\":[{\"chord_symbol\":\"Cmaj7\",\"chord_index\":0,\"voicing_id\":\"default\",\"notes_json\":{\"notes\":[\"C\",\"E\",\"G\",\"B\"]},\"svg\":\"<svg/>\"}]}"
```

Expected: HTTP 201 with the created cache row + variations array.

Then `curl http://localhost:4321/api/cache/$KEY` → expect 200 with the same data.

Confirm in Directus admin that rows landed in `chordl_cache` and `chordl_variations`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/cache/index.ts
git commit -m "feat(api): POST /api/cache write endpoint"
```

---

### Task D6: `POST /api/ratings`

**Files:**
- Create: `~/ph-chordl/src/pages/api/ratings.ts`

- [ ] **Step 1: Implement**

```ts
import type { APIRoute } from "astro";
import { recordRating } from "../../lib/cache";

export const prerender = false;

interface Body { variation_id: string; rating: "up" | "down"; reason?: string }

export const POST: APIRoute = async ({ request }) => {
  let body: Body;
  try { body = (await request.json()) as Body; }
  catch { return json(400, { error: "invalid JSON" }); }

  if (!body.variation_id || typeof body.variation_id !== "string") return json(400, { error: "variation_id required" });
  if (body.rating !== "up" && body.rating !== "down") return json(400, { error: "rating must be 'up' or 'down'" });
  if (body.rating === "down" && (!body.reason || body.reason.trim().length === 0)) return json(400, { error: "reason required for thumbs-down" });
  if (body.reason && body.reason.length > 150) return json(400, { error: "reason exceeds 150 chars" });

  try {
    await recordRating(body.variation_id, body.rating, body.reason);
    return json(204, null);
  } catch (e) {
    console.error("[ratings POST]", e);
    return json(502, { error: "rating write failed" });
  }
};

function json(status: number, body: unknown) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}
```

- [ ] **Step 2: Smoke test**

Pick a `variation_id` from the row you created in Task D5.

```bash
curl -s -X POST http://localhost:4321/api/ratings \
  -H 'content-type: application/json' \
  -d "{\"variation_id\":\"<id>\",\"rating\":\"up\"}"
```

Expected: HTTP 204. Confirm the row in Directus admin now has `rating: "up"` and `rating_at` set.

Try a thumbs-down without a reason → expect 400.
Try with a 200-char reason → expect 400.
Try with a valid reason → expect 204; row updated.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/ratings.ts
git commit -m "feat(api): POST /api/ratings"
```

---

## Phase E — UI: React island + RatingButtons + page shell

### Task E1: `RatingButtons.tsx`

**Files:**
- Create: `~/ph-chordl/src/components/RatingButtons.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useState } from "react";

export interface RatingButtonsProps {
  variationId: string | null;
  onRated?: (rating: "up" | "down") => void;
}

export function RatingButtons({ variationId, onRated }: RatingButtonsProps) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = !variationId || submitting;

  async function send(payload: { rating: "up" | "down"; reason?: string }) {
    if (!variationId) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/ratings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ variation_id: variationId, ...payload }),
      });
      if (!r.ok) throw new Error(await r.text());
      setRating(payload.rating);
      setShowReason(false);
      onRated?.(payload.rating);
    } catch (e) {
      setError("Couldn't save rating");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rating-buttons inline-flex flex-col items-start gap-1 mt-2">
      <div className="rating-buttons__row inline-flex gap-2">
        <button
          type="button"
          aria-label="Thumbs up"
          disabled={disabled}
          onClick={() => send({ rating: "up" })}
          className={`rating-thumb-up px-2 py-1 rounded-full border text-sm transition disabled:opacity-40 ${
            rating === "up" ? "bg-emerald-500 text-white border-emerald-500" : "bg-white border-slate-300 hover:bg-emerald-50"
          }`}
        >👍</button>
        <button
          type="button"
          aria-label="Thumbs down"
          disabled={disabled}
          onClick={() => setShowReason((s) => !s)}
          className={`rating-thumb-down px-2 py-1 rounded-full border text-sm transition disabled:opacity-40 ${
            rating === "down" ? "bg-rose-500 text-white border-rose-500" : "bg-white border-slate-300 hover:bg-rose-50"
          }`}
        >👎</button>
      </div>
      {showReason && (
        <form
          className="rating-reason flex items-start gap-2"
          onSubmit={(e) => { e.preventDefault(); if (reason.trim()) send({ rating: "down", reason: reason.trim() }); }}
        >
          <textarea
            className="rating-reason__input border border-slate-300 rounded p-1 text-sm w-64"
            maxLength={150}
            rows={2}
            placeholder="Why didn't this work? (≤150 chars)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button type="submit" disabled={!reason.trim() || submitting} className="rating-reason__submit px-2 py-1 rounded bg-slate-800 text-white text-sm disabled:opacity-40">Send</button>
        </form>
      )}
      {error && <span className="rating-buttons__error text-xs text-rose-600">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `pnpm astro check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/RatingButtons.tsx
git commit -m "feat(ui): RatingButtons component"
```

---

### Task E2: `ChordlIsland.tsx` — wraps chordl, wires cache + ratings

**Files:**
- Create: `~/ph-chordl/src/components/ChordlIsland.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ChordSheet, VoicingVariantToggle } from "@pepperhorn/react";
import type { VariationContext } from "@pepperhorn/react";
import { computeCacheKey } from "../lib/cacheKey";
import { RatingButtons } from "./RatingButtons";

interface RenderConfig {
  theme?: string;
  scale?: number;
  display?: string;
}

interface VariationKey { chordIndex: number; voicingId: string; }
function vkey(k: VariationKey) { return `${k.chordIndex}::${k.voicingId}`; }

export function ChordlIsland() {
  const [input, setInput] = useState("Cmaj7#5 starting on G#");
  const [renderConfig] = useState<RenderConfig>({ theme: "light", display: "keyboard" });

  const [cacheKey, setCacheKey] = useState<string>("");
  const [variationIds, setVariationIds] = useState<Record<string, string>>({});
  const collectedRef = useRef<Map<string, VariationContext>>(new Map());

  // Recompute cache key on input/config change (debounced).
  useEffect(() => {
    const handle = setTimeout(async () => {
      const key = await computeCacheKey({ user_string: input, render_config: renderConfig as Record<string, unknown> });
      setCacheKey(key);
      collectedRef.current = new Map();
      setVariationIds({});
      // Try to fetch a hit
      try {
        const r = await fetch(`/api/cache/${key}`);
        if (r.ok) {
          const data = await r.json();
          const ids: Record<string, string> = {};
          for (const v of data.variations as Array<{ id: string; chord_index: number; voicing_id: string }>) {
            ids[vkey({ chordIndex: v.chord_index, voicingId: v.voicing_id })] = v.id;
          }
          setVariationIds(ids);
        }
      } catch (e) { console.warn("cache lookup failed", e); }
    }, 400);
    return () => clearTimeout(handle);
  }, [input, renderConfig]);

  const handleVariation = useCallback((ctx: VariationContext) => {
    collectedRef.current.set(vkey({ chordIndex: ctx.chordIndex, voicingId: ctx.voicingId }), ctx);
    // Schedule a write attempt; debounce so all variations from one render coalesce.
    void scheduleFlush();
  }, [cacheKey, input, renderConfig]);

  const flushTimer = useRef<number | null>(null);
  const scheduleFlush = useCallback(async () => {
    if (flushTimer.current) window.clearTimeout(flushTimer.current);
    flushTimer.current = window.setTimeout(async () => {
      const collected = Array.from(collectedRef.current.values());
      if (collected.length === 0 || !cacheKey) return;
      // Only POST if we don't already have ids for every collected variation
      const haveAll = collected.every((c) => variationIds[vkey(c)]);
      if (haveAll) return;
      try {
        const body = {
          cache_key: cacheKey,
          user_string: input,
          render_config: renderConfig,
          parsed_json: { collected: collected.map((c) => ({ chord: c.chordSymbol, voicing: c.voicingId, notes: c.notes })) },
          is_progression: collected.some((c) => c.chordIndex > 0),
          variations: collected.map((c) => ({
            chord_symbol: c.chordSymbol,
            chord_index: c.chordIndex,
            voicing_id: c.voicingId,
            notes_json: { notes: c.notes },
            svg: c.svgString,
          })),
        };
        const r = await fetch("/api/cache", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) {
          const data = await r.json();
          const ids: Record<string, string> = {};
          for (const v of data.variations as Array<{ id: string; chord_index: number; voicing_id: string }>) {
            ids[vkey({ chordIndex: v.chord_index, voicingId: v.voicing_id })] = v.id;
          }
          setVariationIds(ids);
        }
      } catch (e) { console.warn("cache write failed", e); }
    }, 600);
  }, [cacheKey, input, renderConfig, variationIds]);

  const renderExtras = useCallback((ctx: VariationContext) => {
    const id = variationIds[vkey({ chordIndex: ctx.chordIndex, voicingId: ctx.voicingId })] ?? null;
    return <RatingButtons variationId={id} />;
  }, [variationIds]);

  const isProg = useMemo(() => /[-,]| then | to /i.test(input), [input]);

  return (
    <div className="chordl-island flex flex-col items-center gap-4 p-4">
      <input
        className="chordl-input w-full max-w-2xl px-4 py-3 rounded-full border border-slate-300 text-lg"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="e.g. Cmaj7#5 starting on G#"
      />
      <div className="chordl-output w-full max-w-4xl">
        {isProg ? (
          <ChordSheet
            input={input}
            onVariation={handleVariation}
            renderVariationExtras={renderExtras}
          />
        ) : (
          <VoicingVariantToggle
            chord={input}
            onVariation={handleVariation}
            renderVariationExtras={renderExtras}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compiles**

Run: `pnpm astro check`
Expected: PASS. If `ChordSheet`'s prop is `chord` instead of `input`, adapt to whatever the published API surface uses (check `node_modules/@pepperhorn/react/dist/index.d.ts`).

- [ ] **Step 3: Commit**

```bash
git add src/components/ChordlIsland.tsx
git commit -m "feat(ui): ChordlIsland — wraps chordl, wires cache + ratings"
```

---

### Task E3: `index.astro` shell

**Files:**
- Modify: `~/ph-chordl/src/pages/index.astro`

- [ ] **Step 1: Replace contents**

```astro
---
import { ChordlIsland } from "../components/ChordlIsland";
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ph-chordl</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" />
    <style is:global>
      :root { font-family: 'Poppins', sans-serif; }
      body { margin: 0; background: #f8fafc; }
    </style>
  </head>
  <body>
    <main class="ph-chordl-main min-h-screen">
      <ChordlIsland client:load />
    </main>
  </body>
</html>
```

- [ ] **Step 2: Smoke test end-to-end**

```bash
pnpm dev -- --host 0.0.0.0
```

Open `http://localhost:4321/`. Verify:
1. Input shows `Cmaj7#5 starting on G#`; chord renders.
2. Thumbs-up / thumbs-down buttons appear under the chord.
3. Click 👍 → button flips to active state. Confirm in Directus admin a `chordl_variations` row has `rating: "up"`.
4. Click 👎 → textarea appears → type "out of range" → Send → row gets `rating: "down"` + reason.
5. Refresh the page → cache hit, variation IDs reload, ratings persist.

Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(ui): index.astro mounts ChordlIsland"
```

---

### Task E4: README + Coolify deploy notes

**Files:**
- Modify: `~/ph-chordl/README.md`

- [ ] **Step 1: Write README**

```markdown
# ph-chordl

Private Astro v6 wrapper around the public [`@pepperhorn/react`](https://www.npmjs.com/package/@pepperhorn/react) chord renderer.
Adds a Directus-backed cache and human-in-the-loop ratings on top of every rendered (chord, voicing) variation.

## Stack

- Astro v6 with `@astrojs/node` SSR adapter (standalone)
- React 19 island for the chord UI
- Tailwind for styling
- `@directus/sdk` against ph-apps (`apps.pepperhorn.com`)
- Secrets enforced at build time via `astro:env` schema (server-secret context)

## Local dev

```bash
cp .env.example .env       # fill in DIRECTUS_PHAPPS_TOKEN
pnpm install
pnpm dev -- --host 0.0.0.0
```

## Env vars

| Var                       | Where           | Notes                                         |
|---------------------------|-----------------|-----------------------------------------------|
| `DIRECTUS_PHAPPS_URL`     | server (secret) | `https://apps.pepperhorn.com`                 |
| `DIRECTUS_PHAPPS_TOKEN`   | server (secret) | `chordl_service` role static token            |

Astro will fail the build if either is missing or imported on the client.

## Coolify deploy

1. Connect this repo to Coolify as a Node application (build cmd: `pnpm install && pnpm build`, start cmd: `node ./dist/server/entry.mjs`).
2. Set both env vars in the Coolify UI as **Build & Runtime** secrets.
3. Expose port `4321` (Astro Node default; override via `HOST=0.0.0.0 PORT=4321` if needed).
4. First deploy will fail-fast if vars are missing.

## Directus collections

Created via the ph-apps MCP during initial setup; see the design spec in `pepperhorn/chordl` repo.
- `chordl_cache`
- `chordl_variations`
- Role: `chordl_service` (create/read/update on those two + `directus_files`)
```

- [ ] **Step 2: Commit + push**

```bash
git add README.md
git commit -m "docs: README + Coolify deploy notes"
git push
```

---

## Self-review check (run mentally before starting execution)

- ✅ Spec § "Public chordl changes" → Tasks A1–A5
- ✅ Spec § "Package rename + first publish" → Tasks A6–A7
- ✅ Spec § "Directus collections" → Tasks B1–B4
- ✅ Spec § "ph-chordl repo layout" → Tasks C1, E3
- ✅ Spec § "Env schema (`astro:env`)" → Task C2
- ✅ Spec § "Server endpoints" → Tasks D4–D6
- ✅ Spec § "React island" → Task E2
- ✅ Spec § "RatingButtons" → Task E1
- ✅ Spec § "Data flow" → Validated in Task E3 smoke test
- ✅ Spec § "Edge cases & policies" — schema_version (Task B2 + D2), Directus-down handling (Task D4/D5/D6 swallow + console.error), reason validation server-side (D6) and client-side (E1), PNG-on-export-only (collections allow nullable png; UI does not upload — out of scope for this plan, lands when export hits the cache).

**Known v1 simplifications (carried from spec):**
- Lazy cache: only the variations the user actually views are cached / ratable.
- Anonymous ratings (no user FK).
- PNG upload not wired in this plan — only SVG goes into `chordl_variations.svg`. The schema supports adding it later.
