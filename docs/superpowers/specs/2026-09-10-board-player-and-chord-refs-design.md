# Board player, chord viewer and chord refs

**Date:** 2026-09-10
**Status:** decisions captured — sub-project A ready to spec in detail; B, C, D not yet designed
**Context:** builds on `2026-09-08-synchronised-playback-design.md` (the playback timeline and highlight channel) and on the board work in `2026-08-12-board-structure-design.md`.

## Problem

A board card already stores everything needed to sound the exact voicing it draws — `playbackNotes` (ordered MIDI), `playbackInstrument`, `arpeggioBpm`, `playbackHighlightColor`, all written on add, validated on import and read back when a card is opened for editing. `ChordBoard` never reads any of it. A board is a picture of sound it refuses to make.

Around that sit three further wants: finishing the follow-along surface so a played chord is recognised and reported, a single chord viewer that carries its own variations, and QR codes that point at a hosted chord.

## Scope: four sub-projects, not one

This is deliberately decomposed. Each gets its own spec, plan and implementation cycle.

| | what | depends on |
|---|---|---|
| **A** | display-only board with play mode and native-patch audio | fields already stored; `ensureInstrument` |
| **B** | follow-along finalisation — match/other highlight vocabulary, recognised-chord feedback, responsive placement | A's highlight channel |
| **C** | single chord viewer carrying its inversions and alternate voicings as a bundle | mirrors A and B |
| **D** | QR codes and chord refs via `phrn.link` | C's bundle shape |

Order is A → B → C → D. A is the foundation the others read from, and D's payload is C's bundle.

**Explicitly deferred:** play-all / sequence playback of a whole board. It needs tempo, time signature and barlines, which makes it lead-sheet work rather than a playback control. Its own spec.

---

## A. Board player

### Interaction

Play mode is a mode, entered with `p` on a keyboard or a button on touch. Outside it the board behaves as it does now and arrow keys belong to the page — a display component that permanently swallowed arrows would break scrolling for every reader.

Inside play mode there is one cursor:

| input | action |
|---|---|
| ← / → | step to previous/next chord, and sound it |
| ↓ / Space | sound the current chord again |
| tap / click a card | jump to it and sound it; tapping the current card replays |
| swipe left/right | step, and sound it |

Moving sounds the chord — stepping and hearing are one action, so a learner walks a progression at their own pace without a second input. Each move cuts the previous voices, or holding an arrow down stacks a chord cluster.

Swipe follows reading order, the same as arrows; there is no separate row gesture. The cursor stops at both ends rather than wrapping: with auto-play on move, wrapping restarts the progression and sounds an unexpected chord.

Binding ↓ to replay means **arrows are not grid navigation** — ← / → walk reading order across row breaks, and ↑ stays unbound. That is the right trade for a practice tool, where a progression is a sequence rather than a grid, but it forecloses row-wise movement.

Space must be `preventDefault`ed on the board or it scrolls the page.

Text cards are skipped by the cursor. There is nothing to sound.

### Component shape

`BoardPlayer` is its own exported component, not a mode on `ChordBoard`. `ChordBoard` is ~1400 lines and substantially all of it — toolbar, selection, meta editing, import/export, storage, drag — is what display-only does not want.

`BoardPlayer` takes a `BoardState` and renders the same grid by reusing `BoardCardContent` and the existing layout and card-size logic, which is lifted out of `ChordBoard.tsx` into a shared module rather than duplicated. That extraction is the only refactoring in this sub-project and exists to serve it.

The cursor is drawn with the `:focus-visible` treatment introduced for card selection, rather than inventing a second selection idiom on the same surface.

### Audio

Each card sounds in its own patch, taken from its stored `playbackInstrument` and played through the existing `ensureInstrument` map in `playback.ts`. That map already caches patches independently per instrument, so a board mixing piano and guitar cards needs no new capability — the question of "two patches at once, or pre-render" does not arise.

What it does need: **on entering play mode, preload the distinct set of instruments the board's cards reference.** Typically one or two. Without it, the first card of each type pays a soundfont download in the middle of a gesture.

While a card sounds, its notes highlight through the `activePlaybackIndices` prop that `PianoKeyboard`, `StaffNotation` and `GuitarChord` already accept. `BoardCardContent` gains that single pass-through. This is deliberately the same channel B builds its match/other vocabulary on.

### Legacy cards

Cards saved before playback fields existed have no `playbackNotes`. They are re-resolved from the card's `nl`, with the patch derived from `display` (`guitar` → `electric_guitar_clean`, or `ukulele` where `instrument` says so; everything else → `acoustic_grand_piano`).

**Hard constraint:** the resolve must be the same one the card renders through, not a parallel path. A second path that drifts is the bug class of PRs #63 and #64, and here it would be inaudible-until-wrong — the card draws one voicing and sounds another, with nothing on screen to contradict it. The regression test is a parity assertion: a legacy card resolves to the same MIDI its rendered card reports, following the approach in `playback-notation-parity.test.tsx`.

### The `more` seam

`more` is a show/hide flag. `BoardPlayer` takes `canShowMore` (a boolean the host resolves however it likes) and `onShowMore(item)` (a callback). The board decides *whether to draw the affordance*; the host decides *who is entitled* and *what happens*.

`chordl-board` is published MIT (`publishConfig.access: public`). It must not contain a paywall check, a vendor endpoint, or any knowledge of ph-apps. Inversion of control keeps entitlement out of the open-source surface and lets the same component work unpaywalled for anyone embedding it.

The overlay this seam eventually opens is C.

### Reserved schema field

`bundleId` is added to `BoardItem` now: validated as an opaque URL-safe id, round-tripped by `importBoardJson` / `exportBoardJson`, and read by nothing.

This follows the precedent already set by `level`, whose comment records the same reasoning — stored before anything read it, so that "a card saved before that lands should not need a migration". Boards are exported to JSON files that users keep; a field added later forces a migration on files already on disk.

Reserving the field does not commit to what a bundle contains. That is C.

### Out of scope for A

Play-all, the follow-along highlight vocabulary (B), the chord viewer overlay (C), and anything about bundles, QR codes or entitlement checks (C and D).

---

## B. Follow-along finalisation

Not yet designed. Known wants:

- A highlight vocabulary with at least three states — matched notes, expected-but-unplayed notes, and other sounding notes — built on the same `activePlaybackIndices` channel A uses.
- Feedback naming the chord recognised from what was played.
- The recognised-chord readout floats at the bottom of the viewport on desktop and mobile portrait, and to the right of the board in mobile landscape, because board cards have limited width and fret space.

Existing material: `chordl-listen` (`chordListener`, `chroma`, `stabilizer`, `templateMatch`, `templates`), `follow/sequenceFollower`, and in `chordl-react` `useFollowAlong`, `sequenceFromChords`, `FollowAlongOverlay`, `ListenOverlay`.

Open: whether the three states are enough, and what happens when the recognised chord is right but the voicing is not.

---

## C. Single chord viewer

Not yet designed. Known wants:

- A chord-only viewer mirroring A's presentation and B's follow-along treatment.
- It carries its inversions and alternate voicings in a JSON bundle.
- It is what A's `onShowMore` opens.

Open: the bundle's contents and version marker; how much is shared with `BoardPlayer` versus duplicated; whether the bundle is the same shape as, or a subset of, the existing `bcs1.` chord-sheet token.

---

## D. Chord refs and QR codes

Not yet designed. Decisions already taken:

**Short ids with a backend, not self-contained tokens.** A 6–8 character id cannot hold a bundle, so it must point at stored data. That is a deliberate trade against the existing self-contained `bcs1.<base64url(deflate(JSON))>` codec in `chord-sheet/codec.ts`, which needs no server and works offline forever but produces a long URL. Short ids were chosen so PepperHorn owns the links and gets the analytics.

**Routed at the edge by prefix.** `phrn.link` is served by `platform-links` (`pepperhorn/pepperhorn-platform`, `/apps/links`, Astro SSR, already recording each click as a `demand_event`). It gains a router: `cdl-`-prefixed codes resolve against a ph-apps short-link resolver; everything unprefixed continues to ph-connect, which is the current backend. Two id spaces that cannot collide, and no change to ph-connect.

**The URL is `phrn.link/cdl-<code>`, with no chord spelling.** An earlier idea to include a readable slug is dropped. Shorter URLs mean lower QR module density, which matters when these are printed small on a worksheet and scanned off paper.

**No static API key in the client.** chordl is a static SPA; anything in the bundle is public, so a shipped key is a given-away key and a paywall in front of it is decorative. If "more" is a paid add-on, the workable shape is ph-apps issuing a short-lived scoped token, or proxying the call server-side, with the client holding nothing durable.

Open:

- Whether link records live in the links service's own store or in ph-connect's Directus, with `apps/links` only resolving. This decides where chordl writes a bundle.
- Bundle lifecycle: ownership, expiry, and what a printed QR code does when its row is gone. A QR on a worksheet outlives the session that made it.
- Whether `cdl-` is the prefix to live with. It ends up printed on worksheets and instrument cases, and is permanent from the first one.
- `apps/links` is already shared fate for every `phrn.link` request; adding chordl gives a second team a reason to deploy it.
