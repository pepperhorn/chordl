# Synchronised piano and frame playback

**Date:** 2026-09-08
**Status:** approved — decisions confirmed, ready for implementation
**Context:** extends the existing smplr piano playback and the guitar-frame work in `2026-09-07-experience-levels-and-frame-options-design.md`.

## Problem

Chordl can schedule piano audio, but playback is disconnected from the diagram it describes. The keyboard paint is static, the arpeggio interval is fixed at 120 BPM, and guitar frames have neither audio nor a way to show which string is sounding.

That creates three related faults:

1. A learner hears a sequence but cannot pair each sound with its painted key.
2. The one useful timing variable is compiled into `config.ts`, rather than being part of the chord's educational specification.
3. A guitar frame contains an exact playable voicing but throws that information away at the playback boundary.

## Decisions

### One audio timeline drives sound and paint

The scheduler produces an ordered timeline before it starts playback. Every event carries an index, MIDI pitch, scheduled `AudioContext` time and duration. smplr and the visual renderer consume the same events.

The animation follows `AudioContext.currentTime` through `requestAnimationFrame`. smplr's `onStart` hook is not the clock: it may fire early by the scheduler lookahead. Timers may perform final cleanup, but they do not decide which note is current.

Starting new playback cancels the previous visual run and stops its voices. Unmounting does the same. Loading failure restores the idle state and leaves the static diagram intact.

### Paint remains semantic; playback adds a transient layer

The existing highlight colour continues to mean “this note belongs to the chord.” Playback adds a pulse/halo in `playbackHighlightColor`; it never replaces the base paint.

- Block playback activates every sounding note together.
- Arpeggio playback activates each event as it starts. Earlier notes may continue sounding, but only the current attack remains visually active; this teaches the order rather than turning the whole chord into a permanent active state.
- At the end, the renderer returns exactly to its pre-playback paint.
- Under `prefers-reduced-motion: reduce`, the active colour changes without scale, glow expansion or repeated pulsing.

On a guitar barre, the played string is highlighted at its intersection with the barre. The whole barre does not flash for every constituent note.

### Tempo and playback colour are chord-spec data

Add these additive fields to `DisplayDefaults` and `ChordData`:

- `arpeggioBpm?: number`
- `playbackHighlightColor?: string`

Resolution follows the existing chord → section → sheet → system order. System defaults are 120 BPM and `#f59e0b`. Valid BPM is an integer from 40 through 300; import boundaries reject invalid values rather than allowing zero, negative or unusably high timing.

The reusable React components expose the same values as optional props. The editor presents one global slider and colour input, then snapshots their resolved values when a chord is added to the board.

### Persist exact playable voicings

Add these chord-only fields to `ChordData` and `BoardItem`:

- `playbackNotes?: number[]` — ordered MIDI pitches, exactly as performed
- `playbackInstrument?: "acoustic_grand_piano" | "electric_guitar_clean"`

MIDI numbers, not pitch classes, preserve register, inversion and doubled strings. Array order is performance order: piano voicing order or guitar low-string-to-high-string order. Muted guitar strings are omitted.

These are a rendered snapshot for consumers such as a future playback-only teaching display. The natural-language chord remains the editing source of truth. Editing or changing a voicing refreshes the snapshot; imported older data with no snapshot still renders normally and can derive playback at runtime.

Board cards remain static in this change. They persist playback fields but continue to pass `showPlayback={false}` and render no active-note animation. Because older board readers would silently discard the new educational data, board export advances to `chordl.board/v3`; imports continue to accept v1 and v2.

### Guitar uses smplr's bundled clean electric guitar

Frame playback uses `electric_guitar_clean` from smplr's existing General MIDI sample set. It is lazy-loaded after user interaction and shares the AudioContext with piano.

The linked Musical Artifacts bank is not shipped: although it contains jazz, clean and muted guitar programs, it is labelled with a mixed/“various” licence, requires the optional raw-SF2 parser path, and its host currently challenges direct file requests. The playback engine keeps instrument selection explicit so a reviewed replacement can be added later.

### Guitar playback mirrors piano controls

Interactive guitar frames receive block and arpeggio buttons. The arpeggio is a low-to-high strum in physical string order. Muted strings do not schedule events. Open, fretted and doubled pitches remain separate events because each belongs to a different visible string.

Ukulele and top-three guitar use the same pitch derivation and visual targeting. The initial timbre remains clean electric guitar for every guitar-family frame; timbre-per-instrument is a later refinement.

### Slider placement

The editor owns one always-visible “Arpeggio speed” range input, 40–300 BPM, with a numeric output. It configures both piano and frame playback. Reusable components remain independently configurable through props, so embedding a diagram does not require the editor.

Playback controls inside exported SVG remain buttons only. The HTML slider is application chrome and is excluded from SVG/PNG/WAV exports.

## Public API

Additive changes:

- `DisplayDefaults` and `ChordData`: `arpeggioBpm`, `playbackHighlightColor`; chord data also accepts `playbackNotes`, `playbackInstrument`.
- `KeyboardProps` and `ChordProps`: `arpeggioBpm`, `playbackHighlightColor`, and `onPlaybackSpecChange`.
- `GuitarChordPanelProps`: the same playback options plus `showPlayback`, defaulting to true.
- `GuitarChordProps`: an active low-to-high string index used only for the transient overlay.
- `VariationContext`: gains ordered `playbackNotes` so hosts can persist the exact rendered voicing.
- `BoardItem`: the four playback fields; board JSON v3 validates and preserves them.

No existing required property changes. A consumer that supplies none of the new fields receives the current 120 BPM timing and static idle appearance.

## Accessibility

- Buttons retain explicit accessible names and expose disabled/loading state.
- The range input is keyboard operable and announces BPM.
- Active paint is supplemental: audio order is not communicated by colour alone because the controls already identify playback state, and reduced-motion users still receive a static active-colour change.
- Invalid persisted colours fall back rather than being interpolated into SVG/CSS unchecked.

## Testing

1. Pure scheduler tests pin block and arpeggio event times, BPM conversion, cancellation and completion.
2. Piano component tests pin active indices for duplicate pitches, octave-qualified highlights and split hands.
3. Guitar tests cover low-to-high order, muted/open/fretted strings, doubled pitches and individual barre intersections.
4. Reduced-motion tests assert the non-animated active state remains visible.
5. Chord-sheet default tests pin chord → section → sheet → system fallback.
6. Board v3 round trips playback data, validates MIDI/BPM/colour/instrument fields, reads v1/v2, and keeps board rendering static.
7. React, guitar, core and board lint/tests/builds pass, followed by a browser check of audible/visual synchronisation.

## Out of scope

- Playback controls on board cards.
- A playback-only display mode.
- User-selectable guitar amp/effect or timbre.
- Shipping or redistributing artifact 3771.
- Exporting the transient animation into SVG, PNG or PDF.
