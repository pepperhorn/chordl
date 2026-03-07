# Core Extraction + Chord Logging Design

Date: 2026-03-07
Branch: feat/core-extraction

## Problem

The chord engine (parser, resolver, voicing, layout, export) is locked inside `@better-chord/react`. We need it available to:

1. A **commercial API** (private repo, subscription-based) — accepts chord/progression strings, returns SVG/PNG/MIDI/JSON
2. A **public chord ledger** (separate service) — community-contributed append-only log of chord queries and results
3. The existing **React component library**

## Package Structure After Extraction

```
packages/
  core/          @better-chord/core     (NEW — pure TypeScript engine)
  voicings/      @better-chord/voicings (unchanged)
  chord-react/   @better-chord/react    (thin React wrapper, imports core)
```

## What Moves to Core

| Source (chord-react) | Destination (core) |
|---|---|
| `parser/natural-language.ts` | `src/parser/natural-language.ts` |
| `resolver/chord-resolver.ts` | `src/resolver/chord-resolver.ts` |
| `resolver/auto-layout.ts` | `src/resolver/auto-layout.ts` |
| `engine/keyboard-layout.ts` | `src/engine/keyboard-layout.ts` |
| `engine/svg-constants.ts` | `src/engine/svg-constants.ts` |
| `engine/highlight-mapper.ts` | `src/engine/highlight-mapper.ts` |
| `engine/auto-fingering.ts` | `src/engine/auto-fingering.ts` |
| `audio/midi-export.ts` | `src/audio/midi-export.ts` |
| `audio/svg-export.ts` | `src/audio/svg-export.ts` |
| `progression/` (resolver logic) | `src/progression/` |
| Non-React types from `types.ts` | `src/types.ts` |

## What Stays in chord-react

- `components/*.tsx` (PianoKeyboard, PianoChord, ChordGroup, ProgressionView)
- `ui-theme.ts` (React context)
- `config.ts` (UI theme tokens)
- React-specific types (ChordProps, KeyboardProps, etc.)

## New: Pipeline Entry Point

`packages/core/src/pipeline.ts` — unified programmatic entry point for non-React consumers.

```ts
export interface ChordRequest {
  input: string;
  format?: "svg" | "midi" | "json";
}

export interface ChordResult {
  chordName: string;
  root: string;
  notes: string[];         // MIDI note names: ["G3", "B4", "C5", "E5"]
  lhNotes?: string[];      // left hand MIDI notes
  rhNotes?: string[];      // right hand MIDI notes
  inversion?: number;
  voicingStyle?: string;
  keyboard: {
    startFrom: string;
    size: number;
    highlightKeys: string[];
  };
  svg?: string;
  midi?: Uint8Array;
}

export function processChordRequest(req: ChordRequest): ChordResult;
```

PNG rasterization is a server-side concern — handled by the commercial API, not core.

## New: Chord Logging

### Philosophy

Opt-in, fire-and-forget telemetry for shared learning. No personal data — just chord inputs, outputs, and an anonymized session hash (IP hashed server-side by the ledger endpoint). By pointing to a shared public ledger, the community can learn from the results and keep improving the voicing logic together.

### Config

```ts
// packages/core/src/config.ts

export const ENABLE_CHORD_LOGGING = false;

// To contribute to the shared public chord ledger, uncomment the line below.
// By pointing to the shared ledger we can all learn from the results
// and keep improving the logic together.
// To self-host, point this at your own compatible endpoint.
// export const CHORD_LOG_ENDPOINT = "https://ledger.betterchord.com/api/chord-log";
```

### Log Entry Schema

```json
{
  "logSchema": "1.0.0",
  "anonymousId": "a1b2c3...",
  "input": "Cmaj7 in 2nd inversion with the 5th in the bass",
  "versions": {
    "core": "1.0.0",
    "voicings": "1.1.0",
    "react": "1.2.0"
  },
  "pipeline": {
    "parser": "chord",
    "parsed": {
      "chordName": "Cmaj7",
      "inversion": 2,
      "bassDegree": 5,
      "styleHint": null,
      "format": "compact"
    },
    "resolver": {
      "method": "tonal",
      "type": "maj7",
      "root": "C",
      "pitchClasses": ["C", "E", "G", "B"]
    },
    "voicing": {
      "attempted": true,
      "style": null,
      "quality": "maj7",
      "found": false
    },
    "layout": {
      "startFrom": "F",
      "size": 10,
      "chordOctave": 1
    },
    "output": {
      "notes": ["G3", "B4", "C5", "E5"],
      "lhNotes": ["G3"],
      "rhNotes": ["B4", "C5", "E5"],
      "highlightKeys": ["G:0", "B:1", "C:2", "E:2"],
      "format": "svg"
    }
  },
  "success": true,
  "errorMessage": null,
  "durationMs": 12,
  "timestamp": "2026-03-07T14:30:00Z"
}
```

- `logSchema` — versioned so the ledger API can handle schema evolution across client versions
- `versions` — per-package versions, not monolithic. Traces bugs to specific components
- `pipeline.parser` — "chord" or "progression", identifies which parser handled the input
- `pipeline.resolver.method` — "tonal", "special-builder", or "fallback"
- `pipeline.voicing` — whether a voicing lookup was attempted and whether it matched
- `pipeline.output.notes` — full MIDI note names (C3, E4, etc.), not just pitch classes
- `durationMs` — processing time for performance tracking
- `anonymousId` — SHA-256(IP + server salt), computed server-side, not by the library

### Logging Implementation

```ts
// packages/core/src/logging.ts

export interface ChordLogEntry { /* full schema above */ }

export function logChordRequest(entry: ChordLogEntry): void {
  // fire-and-forget, never throws, never blocks
  // silently swallows errors — must never affect chord rendering
}
```

Called from `processChordRequest()` in the pipeline. Version detection is automatic from package.json; consuming packages (react, API) can pass their own version.

## Downstream Services (NOT in scope for this branch)

### Commercial API (private repo: better-chord-api)

- Subscription/API-key gated
- `POST /api/chord` — returns SVG, PNG, MIDI, or structured JSON
- `POST /api/progression` — same for progressions
- `GET /api/voicings` — query the voicing library
- Auth via API key header, tiered rate limits
- PNG via server-side SVG rasterization (resvg-js or sharp)
- Own DB for usage tracking/billing
- Also logs to public ledger

### Public Chord Ledger (separate repo: better-chord-ledger)

- Serverless function (Cloudflare Worker or Vercel Edge)
- `POST /api/chord-log` — validate payload, hash IP, insertOne() to MongoDB Atlas M0
- `GET /api/chord-log` — paginated public JSON
- `GET /api/chord-log?download=true` — full dataset download
- No auth for reads, rate-limited by IP for writes
- MongoDB Atlas free tier (512MB, ~1M entries)

### Architecture

```
Any @better-chord/core consumer
  (React lib, commercial API, self-hosted)
        │
        │  fire-and-forget POST
        ▼
  Public Ledger API ──→ MongoDB Atlas (public read)

  Commercial API (private)
        │
        ├──→ own DB (billing, usage)
        └──→ Public Ledger (same POST)
```

## Versioning Strategy

- Each package (`core`, `voicings`, `react`) has independent semver
- Log entries include all three versions
- Log schema has its own version (`logSchema: "1.0.0"`)
- Ledger API validates/routes by schema version

## Scope for This Branch

1. Extract `@better-chord/core` package
2. Add `pipeline.ts` — unified programmatic entry point
3. Add `logging.ts` — opt-in fire-and-forget with full pipeline telemetry
4. Add `config.ts` — logging config with commented-out shared endpoint
5. Per-package version detection
6. Update `chord-react` to import from core
7. All existing tests pass

## NOT in Scope

- MongoDB Atlas setup
- Ledger API server
- Commercial API server
- PNG rasterization
- Auth/billing
