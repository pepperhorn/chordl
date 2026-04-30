# chordl

A React component library for rendering interactive SVG piano chord diagrams with audio playback, MIDI export, and a comprehensive jazz voicing engine.

## Features

- **SVG Piano Keyboard** — responsive, themeable piano keyboard rendered as pure SVG
- **Natural Language Input** — describe chords in plain English: `"Cmaj7#5 starting on G#"`
- **Audio Playback** — block chord and arpeggiated playback via Web Audio (smplr)
- **MIDI Export** — download any chord as a standard MIDI file
- **SVG/PNG Export** — download chord diagrams as SVG or PNG (2x retina)
- **Jazz Voicing Library** — 46 voicings across 8 categories with artist/era metadata
- **Polychord & Slash Chord Solver** — upper structure triads, slash chords with LH/RH assignments
- **Locked Hands** — George Shearing block chord algorithm
- **Note Names & Fingering** — display note names and fingering numbers below keys, with auto-fingering engine
- **Progression Resolver** — roman numeral progressions with form templates (ii-V-I, blues, rhythm changes)
- **Color Themes** — Boomwhacker, CRF (Creative Ranges Foundation), Simple, or custom
- **UI Theme** — light/dark mode support for chrome elements
- **Scale Control** — 50%–100% display scaling in 10% increments
- **Chord Resolution** — Tonal.js with fallback resolver for compound jazz alterations

## Installation

```bash
npm install @better-chord/react
```

Peer dependencies: `react >= 18.0.0`, `react-dom >= 18.0.0`

## Quick Start

```tsx
import { PianoChord, PianoKeyboard } from "@better-chord/react";

// Natural language — auto-resolves chord, layout, voicing
<PianoChord chord="Cmaj7" />
<PianoChord chord="D minor seventh in first inversion" />
<PianoChord chord="G7 drop 2" />
<PianoChord chord="Dbmaj9 starting on the 9th with 3 notes on either side" />

// Explicit props — full control
<PianoKeyboard
  highlightKeys={["C", "E", "G"]}
  startFrom="C"
  size={8}
  format="compact"
/>
```

## Natural Language Parser

The parser extracts structured data from freeform text:

| Input | Parsed |
|-------|--------|
| `"Cmaj7#5 starting on G#"` | chord=Cmaj7#5, startingNote=G# |
| `"D minor seventh in first inversion"` | chord=Dm7, inversion=1 |
| `"G sharp augmented"` | chord=G#aug |
| `"C7 in the style of Bill Evans"` | chord=C7, style=Bill Evans |
| `"Dm7 like McCoy Tyner"` | chord=Dm7, style=McCoy Tyner |
| `"Cmaj7 with 3 notes on either side"` | chord=Cmaj7, padding=3 |
| `"C6/9 over D"` | chord=C6/9, bassNote=D |
| `"Cmaj7 with the 5th in the bass"` | chord=Cmaj7, bassDegree=5 |
| `"Dbmaj9 starting on the 9th"` | chord=Dbmaj9, startingDegree=9 |
| `"G7 drop 2"` | chord=G7, style=drop 2 |
| `"G7 drop 2+4"` | chord=G7, style=drop 2+4 |
| `"Cmaj7 spread"` | chord=Cmaj7, style=spread |
| `"G7 nestico"` | chord=G7, style=nestico |
| `"C spanning E to E compact"` | chord=C, span=E-E, format=compact |
| `"Cmaj7 with note names"` | chord=Cmaj7, showNoteNames=true |
| `"Cmaj7 with note names in xl"` | chord=Cmaj7, showNoteNames=true, noteNameSize=xl |
| `"Cmaj7 fingering 1 2 3 5"` | chord=Cmaj7, fingering=[1,2,3,5] |
| `"Cmaj7 with fingerings"` | chord=Cmaj7, autoFingering=true |
| `"Cmaj7 chord down an octave"` | chord=Cmaj7, chordOctaveShift=-1 |
| `"Cmaj7 bass up an octave"` | chord=Cmaj7, bassOctaveShift=+1 |
| `"Cmaj7 all inversions"` | chord=Cmaj7, allInversions=true |

### Starting Note / Degree

"Starting on" rotates the voicing so the specified note is lowest:

- `"Dbmaj9 starting on the 9th"` — Dbmaj9 voiced as Eb, F, Ab, C, Db
- `"Cmaj7 starting on E"` — Cmaj7 voiced as E, G, B, C

If the requested note or degree isn't in the chord, you get a helpful error:

> `Cmaj7 doesn't have a 9th — try: root (C), 3rd (E), 5th (G), 7th (B)`

## Audio Playback & MIDI

Every chord diagram includes five control buttons (top-right):

- **Speaker** — plays all notes simultaneously (block chord)
- **Arpeggio** — plays notes bottom-to-top with stagger
- **MIDI** — exports the chord as a `.mid` file
- **SVG** — downloads the chord diagram as an SVG file
- **PNG** — downloads the chord diagram as a PNG file (2x retina)

Controls appear automatically when notes are highlighted. Disable with `showPlayback={false}`.

### Programmatic API

```ts
import { playBlock, playArpeggiated, downloadMidi, generateMidiFile } from "@better-chord/react";

await playBlock(["C", "E", "G"]);
await playArpeggiated(["C", "E", "G"], 4, 100); // octave 4, 100ms delay

downloadMidi(["C", "E", "G"], "Cmaj"); // triggers browser download

const midiBytes = generateMidiFile({
  notes: ["C", "E", "G"],
  octave: 4,
  tempo: 120,
  arpeggiated: true,
});
```

### SVG/PNG Export

```ts
import { downloadSvg, downloadPng } from "@better-chord/react";

// Pass the SVG element from the DOM
const svgEl = document.querySelector("svg") as SVGSVGElement;
downloadSvg(svgEl, "Cmaj7.svg");
downloadPng(svgEl, "Cmaj7.png");        // 2x retina by default
downloadPng(svgEl, "Cmaj7.png", 3);     // custom pixel ratio
```

## Voicing Library

46 voicings across 8 categories, stored as semitone intervals relative to the root (key-agnostic):

| Category | Count | Era | Artists |
|----------|-------|-----|---------|
| Shell | 9 | Bebop | Bud Powell, Monk, Count Basie |
| Rootless Type A | 5 | Post-Bop | Bill Evans, Wynton Kelly |
| Rootless Type B | 5 | Post-Bop | Bill Evans |
| Quartal | 4 | Modal | McCoy Tyner |
| Upper Structure | 4 | Modern | Herbie Hancock |
| Drop 2 | 5 | Hard Bop | Barry Harris, Shearing, Duke Ellington |
| Drop 2+4 | 4 | Hard Bop | Big band arranging |
| Spread | 5 | Modern | Sax section writing |
| 4-Note Closed | 5 | Modern | Sammy Nestico |

### Style Hints

Use artist names or style keywords in your chord description:

```tsx
<PianoChord chord="Dm7 in the style of Bill Evans" />  // Rootless Type A
<PianoChord chord="G7 like McCoy Tyner" />              // Quartal
<PianoChord chord="Cmaj7 bebop" />                      // Shell
<PianoChord chord="G7 drop 2" />                        // Drop 2
<PianoChord chord="G7 drop 2+4" />                      // Drop 2+4
<PianoChord chord="Cmaj7 spread" />                     // Spread
<PianoChord chord="G7 nestico" />                       // 4-Note Closed
<PianoChord chord="C7 basie" />                         // Shell (sparse, high-register)
<PianoChord chord="Dm7 ellington" />                    // Drop 2
```

### Voicing API

```ts
import {
  findVoicing, realizeVoicing, realizeVoicingFull, voicingPitchClasses,
  queryVoicings, getAlternativeVoicings, autoSelectVoicing,
  mapToVoicingQuality, inferStyle,
} from "@better-chord/react";

// Find best voicing for quality + style
const voicing = findVoicing("dom7", "Bill Evans");
const notes = realizeVoicing("G", voicing, 3); // ["B3", "E4", "F4", "A4"]

// Full realization with hand assignments
const full = realizeVoicingFull("G", voicing, 3);
// [{ note: "B3", midi: 59, pitchClass: "B", hand: "LH" }, ...]

// Pitch classes for SVG highlighting
const pcs = voicingPitchClasses("G", voicing); // ["B", "E", "F", "A"]

// Range-aware auto-selection (Type A vs Type B)
const auto = autoSelectVoicing("C", "dom7", 3, "rootless");
```

### Polychord Solver

```ts
import { solvePolychord, solveSlashChord } from "@better-chord/react";

// D triad over C7 — LH gets tritone shell (E + Bb), RH gets D triad
const poly = solvePolychord(
  { root: "D", quality: "maj" },
  { root: "C", quality: "dom7" }
);

// C/E slash chord — E in LH (octave 3), C and G in RH (octave 4)
const slash = solveSlashChord(["C", "E", "G"], "E");
```

### Locked Hands (Block Chords)

```ts
import { generateLockedHands } from "@better-chord/react";

// G4 melody over Cmaj7 → 5-note voicing: G3, C4, E4, G4 (melody doubled)
const voicing = generateLockedHands("G4", "Cmaj7");
// Returns RealizedNote[] with LH/RH assignments
```

## Staff Notation Fonts

`<StaffNotation>` renders glyphs (clefs, accidentals, noteheads) using SMuFL-compliant music fonts. Consumers must load **Bravura** (default) and/or **Petaluma** themselves — the library does not bundle them.

Download the official woff2 files (OFL licensed):

- Bravura — https://github.com/steinbergmedia/bravura/raw/master/redist/woff/Bravura.woff2
- Petaluma — https://github.com/steinbergmedia/petaluma/raw/master/redist/woff/Petaluma.woff2

Host them and declare in your global CSS:

```css
@font-face {
  font-family: 'Bravura';
  src: url('/fonts/Bravura.woff2') format('woff2');
  font-display: block;
}
@font-face {
  font-family: 'Petaluma';
  src: url('/fonts/Petaluma.woff2') format('woff2');
  font-display: block;
}
```

Switch font via the `glyphs` prop:

```tsx
import { StaffNotation, BRAVURA_GLYPHS, PETALUMA_GLYPHS } from "@better-chord/react";

<StaffNotation notes={["C", "E", "G"]} glyphs={PETALUMA_GLYPHS} />
```

To use a different SMuFL font, pass any object matching `StaffGlyphSet` (`{ name, fontFamily, glyphs: { trebleClef, ... }, brace }`).

## Themes

```tsx
<PianoChord chord="C" theme="boomwhacker" />   // Chromatic pitch-class colors
<PianoChord chord="C" theme="crf" />           // Creative Ranges Foundation colors
<PianoChord chord="C" theme="simple" />        // Single highlight color (default)
<PianoChord chord="Am" highlightColor="#ff6b6b" /> // Custom highlight
```

### Custom Theme

```ts
import { PianoKeyboard } from "@better-chord/react";
import type { ColorTheme } from "@better-chord/react";

const myTheme: ColorTheme = {
  name: "custom",
  whiteKey: (note, highlighted) => highlighted ? "#ff0" : "#fafafa",
  blackKey: (note, highlighted) => highlighted ? "#f80" : "#222",
};

<PianoKeyboard highlightKeys={["C", "E", "G"]} theme={myTheme} />
```

## Note Names & Fingering

Display note names and fingering numbers below highlighted keys:

```tsx
// Via natural language
<PianoChord chord="Cmaj7 with note names" />
<PianoChord chord="Cmaj7 with note names in xl" />
<PianoChord chord="Cmaj7 fingering 1 2 3 5" />
<PianoChord chord="Cmaj7 with fingerings" />  // auto-computed

// Via props
<PianoKeyboard
  highlightKeys={["C", "E", "G", "B"]}
  showNoteNames
  noteNameSize="lg"
  fingering={[1, 2, 3, 5]}
  fingeringSize="xl"
/>
```

### Text Sizes

Note names and fingering sizes use a Tailwind-inspired scale and can be set independently:

| Size | Scale |
|------|-------|
| `base` | 1× (default) |
| `lg` | 1.25× |
| `xl` | 1.5× |
| `2xl` | 1.875× |

### Auto-Fingering

The auto-fingering engine scores candidate patterns based on:
- Thumb-on-black-key avoidance
- Stretch comfort between fingers
- Conventional hand positions (thumb start, pinky end)

Works for both hands — LH fingering mirrors RH (finger N → 6-N).

```ts
import { autoFingering } from "@better-chord/react";

autoFingering(["C", "E", "G", "B"], "rh"); // [1, 2, 3, 5]
autoFingering(["C", "Eb", "G"], "lh");     // [5, 3, 1]
```

## Chord Resolution

Resolves chord symbols using Tonal.js with a fallback for compound jazz alterations:

```ts
import { resolveChord } from "@better-chord/react";

resolveChord("Cmaj7");        // { notes: ["C","E","G","B"], root: "C", type: "major seventh" }
resolveChord("Dm7", 1);       // First inversion: { notes: ["F","A","C","D"], ... }
resolveChord("Cmaj9#5#13");   // Fallback resolver strips alterations and reapplies
resolveChord("Cm7sus");       // Special builder: [C, Eb, F, Bb]
resolveChord("C7omit3");      // Special builder: [C, G, Bb]
```

## Props

### `<PianoChord>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `chord` | `string` | required | Natural language chord description |
| `format` | `"compact" \| "exact"` | `"compact"` | Key height mode |
| `theme` | `string \| ColorTheme` | `"simple"` | Color theme |
| `highlightColor` | `string` | `"#a0c6e8"` | Shortcut for simple theme color |
| `padding` | `number` | `1` | Extra white keys on each side |
| `scale` | `number` | `1` | Display scale (0.5–1.0) |
| `uiTheme` | `"light" \| "dark"` | `"light"` | UI chrome theme |
| `className` | `string` | — | CSS class |
| `style` | `CSSProperties` | — | Inline styles |

### `<PianoKeyboard>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `format` | `"compact" \| "exact"` | `"compact"` | Key height mode |
| `size` | `number` | `8` | Number of white keys |
| `startFrom` | `WhiteNote` | `"C"` | First white key |
| `highlightKeys` | `string[]` | `[]` | Notes to highlight |
| `theme` | `string \| ColorTheme` | `"simple"` | Color theme |
| `highlightColor` | `string` | `"#a0c6e8"` | Shortcut for simple theme |
| `showPlayback` | `boolean` | `true` | Show audio/MIDI/export controls |
| `chordLabel` | `string` | — | Label for MIDI filename |
| `scale` | `number` | `1` | Display scale (0.5–1.0) |
| `showNoteNames` | `boolean` | `false` | Show note names below keys |
| `noteNameSize` | `TextSize` | `"base"` | Note name text size |
| `fingering` | `number[]` | — | Fingering numbers (aligned with highlightKeys) |
| `fingeringSize` | `TextSize` | `"base"` | Fingering text size |
| `handBrackets` | `HandBracket[]` | — | L.H./R.H. bracket annotations |
| `uiTheme` | `"light" \| "dark"` | `"light"` | UI chrome theme |
| `className` | `string` | — | CSS class |
| `style` | `CSSProperties` | — | Inline styles |

## Monorepo Structure

```
packages/
  chord-react/          @better-chord/react (main package)
    src/
      components/       PianoKeyboard, PianoChord, ChordGroup, ProgressionView
      engine/           SVG layout, highlight mapping, auto-fingering, constants
      resolver/         Chord resolution, auto-layout
      parser/           Natural language parser, progression parser
      audio/            Playback (smplr), MIDI export, SVG/PNG export
      themes/           Boomwhacker, CRF, Simple
    test/               Vitest tests
    dev/                Vite dev playground
  voicings/             @better-chord/voicings (standalone package)
    src/
      library.ts        46 voicing entries
      query.ts          Query, realize, style inference
      range-algorithm.ts Range-aware voicing selection
      polychord.ts      Polychord & slash chord solver
      locked-hands.ts   Locked hands block chord algorithm
      types.ts          VoicingEntry, RealizedNote, etc.
    test/               Vitest tests
```

## Development

```bash
npm install          # Install all workspace dependencies
npm run dev          # Start Vite dev playground (http://localhost:5173)
npm run build        # Build both packages
npm test             # Run all tests (watch mode)
```

Run tests once (CI):
```bash
npm run test -w @better-chord/voicings -- --run
npm run test -w @better-chord/react -- --run
```

## Test Coverage

170 tests across 10 test files:

- **Voicings** (43): library structure, query filtering, style inference (Basie/Ellington/Nestico/etc.), voicing realization, polychord solving, locked hands algorithm
- **Chord React** (127): NL parser (22), chord resolution (12), auto-layout (5), playback controls (5), keyboard rendering (6), progression resolver (54), progression stress tests (23)

## Acknowledgments

This project was inspired by and builds upon [amypellegrini/piano-chord-chart](https://github.com/amypellegrini/piano-chord-chart) — the original SVG piano chord rendering approach that served as the foundation for this library.

## License

MIT
