# Guitar and ukulele frame orientation and lines

Both instruments share `GuitarChord` / `GuitarChordPanel`. Add two independent
appearance options: vertical/horizontal orientation and clean/hand-drawn lines.
The defaults remain vertical and clean for existing callers and saved cards.

Use SVGuitar's native orientation calculations so string ordering, fret labels,
open/muted markers, finger numbers and tuning labels are laid out correctly,
with upright text. Keep the native nut-left, frets-right layout and move tuning names to the
left of the open/muted markers with a 7px gap. Extend the SVG viewBox
to include the full label widths and outer padding, preventing clipping.
All labels remain upright. Horizontal frames have a wider maximum width (360 × scale,
versus 260 × scale vertically), constrained by the container.

Apply the hand-drawn treatment only to neck lines, including the nut. SVGuitar's
native rough renderer changes fonts and note shapes too; the line-only treatment
preserves the current typography and playback targets. Replace axis-aligned
SVG lines with deterministic cubic paths. Use restrained curvature, a lighter primary stroke and a fine, faint
broken companion stroke for pencil texture. Preserve colors and drawing order. Muted-string Xs are diagonal and remain untouched. SVGuitar 2.5's
normal renderer discards line classes, so tag the axis-aligned grid lines locally.

`GuitarChord` exposes `orientation` and `lineStyle`. `GuitarChordPanel` adds those
props plus `onOrientationChange` and `onLineStyleChange`, using the existing
instrument/position state synchronization convention. Accessible pill controls
appear when `showControls` is true. Appearance changes leave chord shape,
position, experience filtering and playback order intact.

Board items store `frameOrientation` and `frameLineStyle`. The editor restores
both on edit, and the board renderer passes both to static panels. JSON import
validates the values; export includes them in render configuration/cache keys.
These additive optional fields fit the existing v3 envelope, with v1/v2 imports
continuing to default to vertical/clean frames.

Validate real guitar and ukulele layouts, deterministic paths, unchanged note
targets, host callbacks/prop updates, board JSON/cache keys, and the browser's
save/reload path on desktop and mobile.
