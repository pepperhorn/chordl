# Creative Ranges chord design system (shared)

The brand and card system that the **printed chord cards** (chordcards) and the
**chord library site** (chords.creativeranges.org) both follow. One source, two
media:

- **Values**: `themes/crf-default.json` in this package, imported as
  `@pepperhorn/chordl-cards/themes/crf-default.json` and validated by
  `parseTheme` (`src/theme.ts`). Every colour, size, font and motif number
  lives there, explicit; nothing is derived at load.
- **Rules**: this document. Why each value is what it is, where it may be used,
  and what code may do with it.

When the theme and this doc disagree, the theme is what ships; fix whichever is
wrong. Component rules stay with their medium: print components (title, plates,
footer, faces, geometry) in `chordcards/DESIGN.md`; site UI (White / Tiles
tokens, shell, rails, posters, motion catalogue) in the chords repo's
`CLAUDE.md`, `docs/animation.md` and `src/styles/globals.css`.

**Changing a value.** Edit `themes/crf-default.json`, run this package's tests
and build (`pnpm build`, which also runs `check-dist`), then refresh the
consumers: chordcards links the package (`npm` `file:` symlink, nothing to do
but rebuild its render host on `npm test`); the site copies it
(`pnpm install --force --offline` in chords, then `pnpm gen:motifs` if a motif
value changed). A theme change that alters a diagram request changes
chordcards' cache keys and reprints those faces; the motif blocks are read by
no request.

---

## 1. Foundations

### 1.1 Colour

- **Twelve pitch colours** (`pitches`, hex + CMYK) are the CRF pitch palette.
  They are the only saturated colours in the system. Flats take their sharp
  (Db = C#); the theme lists sharps only.
- **The card ground IS the root.** A card's background is its root's pitch
  colour at full strength (`roots.*.background` = `pitches.*.hex`,
  test-enforced). On the site a root's stage, channel band, chip and poster
  are filled with the same colour (`--root-*` tokens, pinned to the theme by
  `tokens.test.ts`). Why: the colour is how a learner finds the chord's home
  (every C card is the same red, on paper and on screen), and the saturated
  pigments are the deck's identity. Muted or tinted grounds were proposed and
  rejected.
- **Ink** (`ink`, `#231f20`) is the only text colour on a root colour. It
  clears every root at 5.78:1 (C, the worst) to 14.39:1 (E). **White text on a
  root is banned**: it bottoms out at 1.13:1 on E and peaks at 2.82:1 on C.
  White (`paper`, `#ffffff`) appears on a root only as furniture (plates,
  chips) or as a fill under an ink stroke (the title root, note names).
- **Paper** (`paper`) is white stock on a card and the light ground on the
  site (`--card`). On the dark site shell, the motif role `paper` maps to the
  shell's off-white text colour (`--shell-foreground`): a light line on a dark
  ground. White off-white text appears only on the shell, never on a root.
- **Pitch mode collides with the ground by construction.** Chord tones are
  coloured by their own pitch (`colorMode: "pitch"`), so the root tone is
  filled with exactly the card colour (1.00:1). Markers survive by their ink
  stroke, and diagrams sit on white plates so tone colours read at a ratio set
  by the palette, not by the card. See `src/theme.ts`'s module comment.
- **Nothing in the palette clears WCAG 1.4.11's 3:1 for non-text art**
  against white or each other: deliberate, known, judged on proof prints.

### 1.2 Contrast floors

`contrast` in the theme states them; `parseTheme` enforces them on every
colour it derives (the sheen, §2.3):

| Key | Value | Rule |
|---|---|---|
| `body` | 4.5 | Any text under 24px (18pt) |
| `large` | 3.0 | Text 24px+ (`largeTextPx`) |
| `mutedInkOpacity` | 0.7 | Ink at 70% (the card's full-name line, `fonts.titleFullName.opacity`) only clears `large`, so it is large-text only on the site |

Ink per root, flat and on the sheen (WCAG 2.x, computed by `gradientContrast`;
the site measured the same numbers in Chromium):

| Root | Colour | Ink flat | Ink, darkest sheen point | 70% ink, darkest point | Ink, brightest tint | White (banned) |
|---|---|---|---|---|---|---|
| C | #f86e6e | 5.78 | **5.05** (worst) | **3.21** (worst) | 9.49 | 2.82 |
| C# | #f58841 | 6.58 | 5.70 | 3.44 | 10.20 | 2.48 |
| D | #ffbc57 | 9.77 | 8.32 | 4.27 | 12.39 | 1.67 |
| D# | #b8a334 | 6.46 | 5.60 | 3.37 | 10.14 | 2.52 |
| E | #fff56d | 14.39 | 12.12 | 5.20 | 15.29 | 1.13 |
| F | #b3f888 | 12.96 | 10.89 | 4.97 | 14.40 | 1.26 |
| F# | #93d154 | 8.92 | 7.61 | 4.05 | 11.88 | 1.83 |
| G | #6bc6a0 | 7.93 | 6.81 | 3.81 | 11.17 | 2.06 |
| G# | #7ee8df | 11.25 | 9.54 | 4.64 | 13.36 | 1.45 |
| A | #88a7f8 | 6.93 | 5.99 | 3.53 | 10.46 | 2.35 |
| A# | #cc97e8 | 7.11 | 6.17 | 3.58 | 10.60 | 2.29 |
| B | #e277b1 | 5.83 | 5.10 | 3.21 | 9.60 | 2.80 |

### 1.3 Typography

| Face | Where it is allowed | Never |
|---|---|---|
| **Poppins** (400 / 600 / 700) | Everything on the cards; all site body, controls and labels; the chord title lockup on both (root 700, quality 600, full name 400 at 70%) | Synthesised weights: only the three static weights are bundled |
| **Archivo Black** | Site `h1` / `h2` only (one weight, `font-synthesis: none`) | Cards; chord symbols; text inside `.prose` |
| **Space Mono** (700, uppercase, 0.12em tracking) | Site `h3` labels only, no size or weight utilities | Cards; anything a learner reads as music |
| **Petaluma** | Engraved notation (the card's `notation` face, Verovio) | UI text |
| **Big Shoulders Display**, **Roboto Mono** | Retired template faces. Registered in chordcards' `FONT_FACES` (theme family keys `display`, `mono`) so a theme can still reach them | New work. White Roboto Mono failed at ~1.1:1 on light roots; Big Shoulders is variable with `wght` defaulting to 100 (Thin), so its `weight` must always be set |

Card size tiers: **100 / 38 / 26 / 18** pt (root / quality / keyboard note
names / everything small), test-enforced. Sizes between tiers read as a mistake.
The site's chord title lockup mirrors the card in Poppins because it is the
product's identity, not page chrome.

### 1.4 Note-text SVG style

A note letter over a coloured dot, key or circle always uses this style, on
cards and on screen:

```css
text-anchor: middle;
dominant-baseline: central;
fill: rgb(255, 255, 255);
font-size: 20;            /* the role's size; 20 is the screen default */
font-family: Poppins, sans-serif;
font-weight: 600;
stroke: rgba(0, 0, 0, 0.35);
stroke-width: 3;
paint-order: stroke;
```

Theme: `keyboard.textColor` (`#ffffff`), `keyboard.textStroke`
(`rgba(0,0,0,0.35)`), `keyboard.textStrokeWidth` (3). The title root uses the
same technique with a solid ink stroke (`fonts.titleRoot.strokeWidth`, 7pt).

**Renderers that ignore `paint-order`** (svg2pdf.js) get a three-pass render:
(1) a stroke-only outline pass, (2) a shadow pass, (3) the solid white fill on
top. chordcards prints through Chromium, which honours `paint-order`, so it
needs none of this; any other print path must emulate it.

### 1.5 Accidentals

Sharps, flats and naturals are **drawn glyphs**, never a letter b or a `#`
typed in Poppins (Poppins has no ♭/♯; a flat set as "b" read as a letter).
`accidentalGlyphs` draws them on Poppins' grid at 400/600/700; a role in
another face that needs them throws. The title root's accidental is "raised"
(62%, hung from cap height; `fonts.titleRoot.accidental`), everything else is
full height. On the site, chord symbols and note names go through
`<ChordText>`, which pairs the drawn glyph with a **spoken twin** ("E flat")
and gives accessible names in words. The full chord name is always words
("e flat minor seventh"). Specimens: `review/accidentals-specimen*.png`.

### 1.6 Diagram colour rules

- Tone colours come from the theme only (`toneColor`): `pitches` in pitch
  mode, `roots.*` in single mode. Neither the site nor the render host carries
  a palette literal; a literal there silently outranks the theme.
- Fret markers always carry `fret.circleStrokeColor` / `circleStrokeWidth`
  (an unstroked root marker vanishes in pitch mode).
- Diagrams sit on white plates with the sticker finish (ink outline, hard ink
  offset shadow, no blur): `fret.panel*`, `qrChip`. Soft shadows are not in
  this system on either medium.
- The site's player maps its `--ccp-*` UI colours to site tokens; the
  diagram's pitch colours still come from this theme, as on print.
- Neither motif (§2) is ever drawn inside a diagram, a plate, a chip or behind
  a QR code.

---

## 2. Motifs

Two motifs carry the brand between the media (the groove also gives the
loading skeleton, §2.4). Both are defined once in the
theme, medium-neutral: lengths in screen px **and** print pt, colours as
**roles** (`ink`, `paper`, `root`) that each medium maps to its own tokens.

### 2.1 Groove fingerprint (`groove.fingerprint`)

A 45's grooves, label and spindle as a big, quiet partial circle bleeding off
an edge or corner. It says "record" (the pathways' crates and 45s) without a
picture.

| Key | Value | Meaning |
|---|---|---|
| `ringPitch` | 7.25px / 2.9pt | Centre-to-centre distance between grooves (ring count = radius / pitch: ~48 at `md`) |
| `stroke` | 1.25px / 0.5pt | Groove line thickness (pt floored at `MIN_PRINT_STROKE_PT` = 0.25; line-to-pitch ratio 0.17 on both media) |
| `fadeFrom` | 0.82 | Grooves fade out from 82% of the radius to the edge |
| `label` | hole 0.035, holeRim 0.045, radius 0.26, rim 0.27 | Fractions of the radius: spindle hole, its rim, the label disc, the label rim |
| `grounds.dark` | `paper`, line 0.13, label 0.05, sheen 0.07 | On the dark shell, raised panels and dialogs |
| `grounds.light` | `ink`, line 0.09, label 0.035, sheen 0.05 | On white cards and panels |
| `sizes` | sm 12, md 22, lg 34 (rem, record radius) | Screen sizes; print sizes are in the proposal (§5) |
| `presets` | `corner-tl/tr/bl/br` (0/1, 0/1), `edge-l/r` (0/1, 0.5), `centre` (0.5, 0.5) | Record centre as fractions of the surface; values outside 0..1 push it further off |
| `defaultPreset` | `corner-tr` | |
| `spin` | 90s per turn, default `static` | Screen only. Print is always static |

**Bleed share.** A corner preset leaves 75% of the disc off the surface, an
edge preset 50%, `centre` none. The record always reads as part of something
larger; a whole, centred record is allowed only as a hero object (the /today
spinning record), never as texture.

**Construction.**

- CSS: one pseudo layer behind the content. Grooves are
  `repeating-radial-gradient(circle at X Y, transparent 0 <pitch - stroke>, <line> <pitch - stroke> <pitch>)`;
  the label is a `radial-gradient` with hard stops at the label ratios times
  the radius; a radial `mask-image` fades the grooves from `fadeFrom` to the
  edge. Line colours are translucent mixes,
  `color-mix(in oklab, <role token> <line>, transparent)`, so one record reads
  on the shell, raised panels and dialogs alike. Spinning: a `conic-gradient`
  light catch at `sheen` strength is what you see turn (the rings are radially
  symmetric, so rotating them alone shows nothing).
- SVG (cards, or any vector export): concentric `<circle>`s at
  `r = k × ringPitch` for k = 1..⌊radius / pitch⌋, `fill="none"`,
  `stroke-width` = `stroke`, stroke = the role colour at `line` opacity; label
  as two filled circles; the fade as a radial `<mask>`; clip to the surface.
  Never rasterise the rings for print: fine lines must stay vector.

**Do / don't.**

- Do keep it behind content, on large quiet areas: section backgrounds,
  panels, dialogs, the footer, the space beside the player.
- Do vary the corner between neighbouring sections (alternate tr / bl) so a
  page doesn't stamp the same mark repeatedly.
- Don't put it on posters or anything that repeats in a rail (cost, and noise).
- Don't put it under small text at more than the `grounds` strengths: those
  were measured with text exactly on a groove line (worst: muted text on a
  raised shell panel 8.50 → 5.86:1; on a white card 7.28 → 6.05:1).
- Don't let it touch a diagram, plate, chip or QR code.

### 2.2 Ambient record (`groove.ambient`, screen only)

The giant record turning far behind root-colour surfaces (chord-page stage,
channel bands, hero slides). Coarser, tone-on-tone, elliptical.

| Key | Value |
|---|---|
| `ringPitch` / `stroke` | 12.5px / 1.5px (no pt: not printed) |
| `aspect` | 0.92 (`ellipse 50% 46%`) |
| `grounds.root` | `paper` mixed 14% into the root (opaque oklab mix) |
| `grounds.dark` | `paper` 7% on the shell |
| `mask` | fades in 14% → 26% of the radius, out 84% → 100% |
| `spin` | 60s per turn, default spinning (paused off screen, static under reduced motion) |

### 2.3 Root-colour sheen (`gradient`)

A broad diagonal light across a root-colour surface: shade, the root, a bright
tint, the root, shade. It makes the flat ground feel lit without changing its
identity.

| Key | Value | Meaning |
|---|---|---|
| `angle` | 105 | CSS degrees |
| `stops` | 12% ink 0.08 · 27% root · 38% paper 0.22 · 50% paper 0.45 · 62% paper 0.22 · 73% root · 88% ink 0.08 | Each stop is the root mixed `amount` toward ink or paper **in oklab** (`color-mix(in oklab, …)`); amount 0 is the root itself (CSS: `transparent` over the root ground) |
| `counterHighlight` | at (0.28, 0.30), radius 0.34, paper 0.40 | A soft radial highlight. On screen it rides the turning ambient record, so it orbits against the sheen's drift |
| `drift` | 44s per cycle, travel 0.22, overscan 0.5 | Screen only: the layer is 2× wide and slides ±22% (alternate, ease-in-out) |

**The hard rule.** Ink on any point of any root's sheen stays at or above
`contrast.body`, and 70% ink at or above `contrast.large`. `parseTheme`
computes every stop on every root (`gradientColours`, `gradientContrast`) and
**throws** if one falls short, so a stronger sheen cannot ship. Today the
8% shade is the cap: C, the worst root, is 5.05:1 (70% ink 3.21:1). A 10% shade
takes C to 4.86:1 and 12% to 4.70:1: legal, but the margin is gone. Tints only
add contrast.

**Construction.**

- CSS: `linear-gradient(<angle>deg, <stops>)` on a pseudo layer over
  `bg-tone`, using tokens (`hsl(var(--tone))`, `--root-ink`, `--card`). The
  site generates the exact expression from the theme (§6).
- SVG / print: a `<linearGradient>` whose stops are `gradientColours(theme, root)`
  as solid hex (no alpha, no `transparent`), so the print colour is exactly the
  checked colour.

**Do / don't.**

- Do use it on big root-colour surfaces only: stages, bands, hero slides.
- Don't use it on white or on the shell (there is no root to light), on
  posters in a rail, or behind diagrams, plates, chips or QR codes.
- Don't add a stop toward ink above what `parseTheme` accepts, and don't mix
  toward anything but ink or paper (a hue shift makes C read as C#).

### 2.4 Loading skeleton (`groove.skeleton`, screen only)

What a card image or a rail's next batch shows while it loads: the card's
footprint, fine grooves and a light band passing over it, then the image
fades in. It is the groove motif at its quietest, so waiting still looks like
the brand.

| Key | Value | Meaning |
|---|---|---|
| `ringPitch` / `stroke` | 8px / 1px (no pt: not printed) | Finer than the fingerprint: the placeholder is poster-sized |
| `centre` | (0.5, 0.6) | Groove centre, fractions of the placeholder (a little below the middle, where a card's diagram sits) |
| `fill` | 0.09 | Placeholder ground: the **surrounding text colour** at 9% (CSS `currentColor`), so one skeleton reads on the shell (off-white) and on a root band (ink) |
| `line` | 0.10 | Groove line, the surrounding text colour at 10% |
| `frame` | 0.42 | A card image's own frame while it loads: its root colour mixed 42% toward the dark ground (the site shell), in oklab |
| `shimmer` | `paper` 0.16, 100deg, transparent 0.30 → full 0.50 → transparent 0.70, 1.8s | A linear light band sweeping left to right (ease-in-out, repeating) |

**Construction.** Grooves are
`repeating-radial-gradient(circle at X Y, transparent 0 <pitch - stroke>, <line> <pitch - stroke> <pitch>)`
over the `fill` (or `frame`) ground; the shimmer is a pseudo layer with
`linear-gradient(<angle>deg, transparent <from>, color-mix(in oklab, <role token> <strength>, transparent) <peak>, transparent <to>)`
translated from -100% to 100% every `seconds`.

**Motion.** The shimmer is feedback ("on its way"), not ambient, so it runs
at UI speed and is exempt from `MIN_AMBIENT_SECONDS`. It runs only while the
thing is actually loading and on screen (a lazy image far along a rail waits
still); under reduced motion the skeleton is static. Without JavaScript there
is no skeleton: images show as usual.

**Do / don't.** Do keep the skeleton the exact footprint of what replaces it
(nothing jumps). Don't put text or a spinner on it, and don't use it for
anything that is not loading.

---

## 3. Motion principles (screen only)

Print never moves; every motif has a static state that is its print state.

- **Ambient is slow**: loops of 20–60s (sheen 44s, ambient record 60s; a
  groove fingerprint that spins takes 90s). `parseTheme` refuses any ambient
  period under 20s (`MIN_AMBIENT_SECONDS`). The skeleton shimmer (1.8s) is
  loading feedback, not ambient, and is exempt.
- **UI feedback is quick**: 300ms or less (presses, tabs, toolkit pop).
- Transform, opacity and clip-path only. Ambient layers run only on screen in
  a visible tab and start paused.
- **Reduced motion**: everything is gated; ambient layers stand still in their
  print state; feedback becomes a still state (a confetti burst becomes a
  check that fades in).
- **Confetti palette is the root colours**: pieces in the 12 root colours,
  leaning to the chord's root and its neighbours, drawn with the card's ink
  outline. Bursts come from the element that earned them, never full-screen.

The site's motion catalogue (what moves where, and what was rejected) is
`docs/animation.md` in the chords repo.

---

## 4. Print vs screen

| Topic | Screen | Print |
|---|---|---|
| Colour space | sRGB; sheen mixes in oklab | CMYK. Root colours have reference CMYK (`pitches.*.cmyk`); sheen stops are specified from the same oklab mixes and must be proofed |
| Sheen limits | stops as in §2.3 | Tints toward paper: no stop lighter than a 3% screen of any plate (finer tints drop out and band). Shade toward ink: never above the theme's ink amount (0.08), which adds at most ~8% K; never a rich black. Max total ink on any stop ≤ 140% (the roots peak at 121%: C# 0/44/73/4) |
| Gradient banding | none | A long, low-contrast blend bands on press; keep the blend over ≤ 60mm and ask the printer about noise/dither on the proof |
| Groove line | 1.25px | ≥ 0.25pt solid hairline floor (`MIN_PRINT_STROKE_PT`); shipped 0.5pt, because grooves are tints and a tinted hairline breaks into screen dots |
| Groove strength | translucent mixes | Specify as a flat tint of ink (or white on a root: needs a white plate, so prefer ink tint on a root card) at the `light` strength; never below a 5% screen |
| Motion | as §3 | none; the static state is the print state |
| QR codes | the site never draws one under a motif | **No gradient, groove or tint behind a QR code or its quiet zone, ever** (the white chip is the quiet zone) |
| Text panels | text sits on the sheen within the floors | No gradient or groove behind text plates, the diagram plate, the keyboard plate or the footer |
| Bleed | surfaces clip | Any motif reaching a card edge extends 3mm into bleed (corner and edge presets do by construction), and is clipped by the card's rounded mask like the keyboard |

---

## 5. Proposal: using the groove + gradient on printed cards

Status: **proposal only.** No card renders either motif today; nothing in
chordcards reads `groove` or `gradient`, so diagram requests and cache keys are
unchanged. This section is what to build and test if the deck adopts them.

**Where on the card.**

1. **A faint groove ring bleeding off the top-right corner, behind the title.**
   `corner-tr`, record radius ~0.55 × card width (≈205pt on the 373.4pt
   a4-fold card), ink at the `light` strength (9% line, 3.5% label),
   `ringPitch` 2.9pt / `stroke` 0.5pt (~70 rings). It sits under the title
   lockup's right edge and stops at `fadeFrom` before the diagram box. The
   title's white fill and 7pt ink stroke are unaffected by a 9% ink tint
   underneath (ink on the root stays ≥ 5.78:1 flat; a 9% ink line is the same
   order as the sheen's 8% shade).
2. **The sheen on the root ground.** The card background becomes a
   `<linearGradient>` of `gradientColours(theme, root)` at 105°, the brightest
   band crossing behind the title. Everything on the ground already passes the
   floors (§1.2), so the title, full name and badge stay legal.
3. Optionally a smaller `corner-bl` groove under the footer's icon third, for
   decks that want a back-of-card mark. Never under the logo third or the QR.

**Constraints.**

- Both motifs live in the ground layer only, under the plates. The diagram
  plate, keyboard plate, QR chip and footer row cover them; the QR chip keeps
  its full white quiet zone.
- Grooves stay vector (`<circle>` rings, §2.1), so the PDF stays sharp and
  small; a mask clipped to the card's rounded rect, with 3mm bleed.
- Unique SVG ids per face (`<thing>-<panel>-<chord>`): one PDF holds every
  sheet, and a shared `groove-mask` id would clip all cards with the first
  card's mask.
- A new render epoch is not needed (the ground is composed by the card, not
  the cached diagram), but the lockfile's face fingerprints will change.
- Theme switches: a `card.groove` / `card.gradient` opt-in in the theme (or a
  deck manifest flag), so a deck can print with or without them.

**What to test before adopting.**

- **Proof prints** on the production stock, all 12 roots: the 0.5pt 9% ink
  rings must read as texture, not as a moiré or as dirt; the sheen must not
  band; C, B and D# (the darkest roots) must not muddy at the 8% shade.
- **QR scan**: every proof's QR scanned at arm's length on two phones
  (chordcards' optional physical QR test), with the motif present.
- **Contrast**: `gradientContrast` already gates the sheen in `parseTheme`;
  add a card test that the groove's strength over the root keeps ink ≥
  `contrast.body` at the title and full-name positions.
- A side-by-side with and without, judged at arm's length, before any deck
  ships with them.

---

## 6. Where things live

| What | Where |
|---|---|
| Theme values | `packages/chordl-cards/themes/crf-default.json` (`@pepperhorn/chordl-cards/themes/crf-default.json`) |
| Schema + validation | `src/theme.ts` (`parseTheme`, `gradientColours`, `gradientContrast`, `resolveColourRef`, `MIN_PRINT_STROKE_PT`, `MIN_AMBIENT_SECONDS`) |
| Colour maths | `src/colour.ts` (`mixOklab` = CSS `color-mix(in oklab)`, `over`, `contrastRatio`) |
| Print loader | chordcards `src/theme-load.ts` (`DEFAULT_THEME_PATH` resolves the package file; `THEME_PATH` overrides) |
| Print component rules | chordcards `DESIGN.md` |
| Site theme | chords `src/lib/card-theme.ts` (parses the package file); `tokens.test.ts` pins `--root-*` to it |
| Site motif CSS | chords `src/lib/motifs.ts` → `pnpm gen:motifs` → `src/styles/motifs.generated.css` (`--motif-*` primitives at `:root`, including `--motif-skeleton-*`; `--motif-sheen-image` and `--motif-sheen-highlight-image` on `.ambient` / `.motif-sheen`); `motifs.test.ts` fails when the file is stale |
| Site UI rules | chords `CLAUDE.md` "Design system", crf-staff `docs/design.md` ("White / Tiles"), chords `docs/animation.md` |

---

## 7. Rejected alternatives (system level)

Component-level history (title outlines, logo chips and halos, badge
placement) stays in chordcards' `DESIGN.md`.

- **Muted or tinted card grounds.** Rejected: the saturated pigments are the
  identity. The sheen lightens and shades the ground around the root colour,
  it never replaces it.
- **White text on root colours** (the template's labels): 1.13:1 on E.
- **A three-family mix** (Big Shoulders, Roboto Mono, Poppins): no
  relationship between the faces. Poppins throughout.
- **Soft blur shadows**: print-hostile and off the sticker language.
- **Literal colours in a renderer or a stylesheet**: a literal silently
  outranks the theme. The render host gets everything in the request; the site
  goes through tokens (raw-colour guard) and generated motif variables.
- **Deriving per-root colours at load** (an adaptive white/shade title split
  was tried): one explicit value per root is reviewable as a diff. The motif
  mixes are the one computed colour, and they are gated by the contrast floors
  at load.
