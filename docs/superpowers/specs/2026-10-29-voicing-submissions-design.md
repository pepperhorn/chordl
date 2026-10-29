# User voicing submissions: shared voicing format, editor overlay, review

**Date:** 2026-10-29
**Status:** design agreed in conversation; ready for a plan
**Next design (not this one):** the Directus v12 unified chord catalogue for CRF and PepperHorn, and the `chord-catalogue` publishing repo. Both build on the format defined here.

## Intent

A user looking at one of our chord voicings sometimes thinks it's wrong, too hard, or just not how they'd play it. Today they can only shrug. We want them to show us what they'd play instead — by tweaking ours or starting fresh, by placing fingers or keys, or by describing it in plain words ("open chord on the 3rd fret, sorry I don't speak guitar") — and submit it.

Each submission goes live as a clearly labelled user option, is scored by an AI reviewer against a fixed scorecard, and goes to staff when the AI is unsure or something looks wrong. The review records (code facts, AI verdict, staff decision) are kept so a separate improvement loop can later tune the AI reviewer.

Underneath that sits a bigger need: one flat, open JSON format that spells a voicing for **keyboard, fretted and bowed instruments** alike, with stable IDs, authorship, "same as" detection and versioning. CRF, PepperHorn and outside users of the open-source libraries all consume it and present it however they like. The submission flow is the first thing built on it.

## Goals

1. A **shared voicing format** (`chordl.chord/1`, `chordl.voicing/1`) published as JSON Schema with TypeScript types, validators, hashing and deterministic musical checks.
2. An **editor overlay** that lets a user build a fretted or keyboard voicing by hand or from plain English, starting either from one of our voicings or from scratch.
3. A **submission pipeline** behind an adapter interface, so the store can be ph-apps now, the unified catalogue later, or anything a third party writes.
4. An **AI review** that fills in a fixed scorecard and routes the submission: stays live, goes to staff, or is hidden pending staff.
5. **Review records** complete enough that a later process can compare AI verdicts with staff decisions.

## Non-goals

- The Directus v12 catalogue service, the migration out of CRF Admin, and the `chord-catalogue` repo and release job. Next design. This one only fixes the format they will use.
- The improvement loop that learns from review records. Separate process. We only store what it needs.
- The voicing generator consuming submissions. Nothing here changes how chordl generates voicings.
- Bowed-string (violin, cello) **builder UI**. The format supports bowed voicings from day one; the builder doesn't yet.
- Thumbs-up/down voting as a standalone feature. The entry point here is the "suggest a better voicing" action; votes can be added later on the same records.
- Editable tunings in the builder. Instruments use their standard tuning (with existing alternate-tuning support where chordl-guitar already has it).

## Anti-goals (would be failure even if it works)

- **Wrong notes shown as a real option.** A submission that doesn't spell the chord must never sit live unchecked.
- **The AI counting notes.** Anything that can be computed from the voicing (pitches, intervals, stretch, finger count) is computed in code. The AI judges, it doesn't measure.
- **A format that only works for guitar.** If keyboard or cello needs a bolt-on, the format is wrong.
- **Personal data in the open format.** Exports carry prefixed IDs and optional display names, never emails.
- **The library depending on a server.** The open-source packages must work with a local/memory adapter and no network.

## Decisions made in conversation

### The user flow

1. The user is on a chord with one of our voicings and taps "suggest a better voicing" (exact label is the builder's call).
2. The overlay opens like a short onboarding with one question: **"Tweak this frame, or start fresh?"**
   - **Tweak:** a draft copy of our voicing opens in the builder, `basedOn` the source `id@rev`.
   - **Start fresh:** the builder opens empty, chord and instrument preset from where they came from. The draft still records which voicing it's an alternative to (`alternativeTo: id@rev`).
   - If the overlay is opened without a source chord, skip the question and start fresh with a chord picker.
3. The draft's author is the signed-in user, or `system` when signed out (the anonymous case — see visibility below).
4. The user builds the voicing (by hand or plain text), sees the code checks live, optionally adds a short note on why it's better, agrees to publish under CC0, chooses credit by display name or anonymous, and submits.
5. On submit the voicing is stored as a user submission and queued for AI review.

### Visibility on submit

- **Signed in:** live immediately as a user-submitted option, visibly labelled as such and separate from reviewed voicings.
- **Signed out:** held until the AI review passes, then live.
- Either way, a **hard fail** in the code checks (see routing) keeps it hidden.

### Instruments in the first release

- **Fretted:** guitar, bass (4 and 5 string), ukulele, guitar top-3 — the `chordl-guitar` instrument set.
- **Keyboard.**
- Bowed (violin, cello): format only. Note chordl-guitar has violin but no cello yet; cello needs an instrument definition when the bowed builder is done.

### Plain-English input

- A text box in the builder. An AI model turns the text into a candidate voicing for the selected instrument; the builder shows it on the diagram and the user corrects it by hand.
- Simple codes (`x32010`, or a note list like `C3 E3 G3 B3` for keyboard) are parsed directly, no AI.
- The text-to-voicing call runs on the host's server (it needs a key). The library defines the request/response shape and calls a host-supplied function; with no function supplied, the text box only accepts codes.

### The shared voicing format

One instrument per voicing, many voicings per file. A guitar Cmaj7 and a piano Cmaj7 are different note sets, so they are different voicings with different IDs. A file groups everything for one chord.

```json
{
  "schema": "chordl.chord/1",
  "chord": { "id": "C:maj7", "symbol": "Cmaj7", "root": "C", "quality": "maj7", "bass": null,
             "aliases": ["CΔ7", "CM7"] },
  "voicings": [
    {
      "schema": "chordl.voicing/1",
      "id": "v_01JBX9…", "rev": 1,
      "chordId": "C:maj7",
      "status": "live",
      "notes": [
        { "pitch": "C3", "degree": "I" }, { "pitch": "E3", "degree": "III" },
        { "pitch": "B3", "degree": "VII" }, { "pitch": "E4", "degree": "III" }
      ],
      "realization": {
        "kind": "fretted", "instrument": "guitar",
        "tuning": ["E2","A2","D3","G3","B3","E4"],
        "strings": [null, 3, 2, 0, 0, 0],
        "fingers": [null, 3, 2, null, null, null],
        "baseFret": 1, "barres": [], "capo": null
      },
      "level": "beginner",
      "tier": "community",
      "licence": "CC0-1.0",
      "externalIds": { "crf": "…chord_data uuid…" },
      "provenance": {
        "source": "user", "authorId": "ph:user:123", "createdAt": "2026-10-29T10:00:00Z",
        "basedOn": "v_01JBX4…@3", "alternativeTo": null, "note": "easier for small hands"
      },
      "relations": { "supersedes": null, "supersededBy": null, "duplicateOf": null },
      "hashes": { "shape": "sha256:…", "pitch": "sha256:…" }
    }
  ]
}
```

Realization kinds:

- **`fretted`:** instrument, tuning (low to high), `strings` per string (`null` = muted, `0` = open, n = absolute fret), `fingers`, `baseFret`, `barres`, `capo`.
- **`keyboard`:** `hands: { left: [pitches], right: [pitches] }`, optional `fingering`.
- **`bowed`:** instrument, tuning, `stops: [{ string, pitch, finger }]`, `position`. Fretless double/triple stops, so string + pitch, not frets.

Rules:

- **`notes` is the source of truth for what sounds.** The realization says how to play it; validation confirms the two agree.
- **Pitches are spelled** (E♭4, never D♯4 in an E♭ chord) and carry degree labels in jazz roman numerals with accidentals, derived from interval quality: I, bIII, III, #V, bVII, VII. Extensions keep their compound number: IX, bIX, #IX, XI, #XI, XIII, bXIII (never folded to II/IV/VI). Bb7#5 is I III #V bVII, not I III bVI bVII.
- Strings and string-order are low-to-high in the format, whatever a renderer does.

### IDs, authorship, "same as", versioning

- **Chord ID is derived from the music:** `<root>:<quality>[/<bass>]`, e.g. `C:maj7`, `C:maj7/E`. Deterministic, so independent projects agree. Aliases map onto it. *(Builder-check calls, mine:)* the quality token is chordl-core's canonical resolved quality, and `chordl-voicing` owns and publishes the token list; enharmonic roots are distinct IDs (`C#:maj7` ≠ `Db:maj7`) because spelling is part of the chord; altered chords use the explicit alterations in canonical order (`C:7#9b13`), while `C:7alt` is its own ID, because "alt" doesn't name specific notes.
- **Voicing ID is permanent and random:** ULID with a `v_` prefix. Never reused, never deleted, only retired (status).
- **Author IDs are namespaced by issuer:** `ph:user:123`, `crf:staff:45`, `system:chordl-guitar@0.3.0` (generator and version), `ai:review@<prompt-version>`, and plain `system` for anonymous submissions.
- **Hashes, always computed, never typed:**
  - `shape` = instrument + tuning + realization → identical grip = duplicate, whoever submitted it.
  - `pitch` = sorted sounding pitches → same sound, different grip (or a guitar and piano voicing with identical notes).
- **Relations:** `basedOn` (tweaked from `id@rev`), `alternativeTo` (fresh suggestion against `id@rev`), `supersedes`/`supersededBy`, `duplicateOf`.
- **Status:** `draft → submitted → live → approved`; terminal `rejected`, `withdrawn`, `superseded`. Plus `held` for signed-out submissions awaiting AI review and hard-failed ones awaiting staff.
- *(My call:)* **status is lifecycle, not content.** It sits beside the immutable revision, is excluded from `rev` and the hashes, and is read through the adapter. A status change never creates a revision; a saved `id@rev` reference shows current status on lookup.
- *(My call:)* a signed-in author may edit their own submission until it is `approved`; each edit is a new `rev` and is re-reviewed. Anonymous submissions can't be edited.
- **Three levels of versioning:**
  1. Schema version in `schema` — bumped only on breaking change.
  2. Record revision `rev` — every edit is an immutable new revision with author, time, change note and previous rev. References always use `id@rev`, so saved boards and printed cards keep exactly what they showed.
  3. Catalogue release (`2026.11.0`) — manifest of every `id@rev` with hashes and generator version. Defined by the next design; this one only reserves the shape.

### Where things live

| What | Where |
|---|---|
| Format: JSON Schema, types, validators, hashes, code checks, scorecard and review-record types | new package `@pepperhorn/chordl-voicing` in this monorepo |
| Editor overlay: onboarding question, fretted and keyboard builders, plain-text box, live checks, submit | new package `@pepperhorn/chordl-voicing-editor` in this monorepo |
| Submission adapter: ph-apps implementation; AI review runner; text-to-voicing endpoint | ph-apps (server side) |
| Published catalogue data | `chord-catalogue` repo — see `2026-10-30-chord-catalogue-publishing-design.md` |

Both new packages are open source and must be usable with a local/memory adapter and no server.

### Submission adapter

The library defines an interface; hosts implement it. Shape (names are the builder's call):

- `submit(voicing, context) → { id, rev, status }`
- `get(id, rev?)`
- `listFor(chordId, filters)` — so consumers can show live user options
- `status(id)` — for the overlay to show "under review" / "live"

Ships with `memorySubmissionAdapter` and `localStorageSubmissionAdapter` (mirroring `chordl-board`'s `StorageAdapter`). ph-apps provides the real one. IDs are opaque strings throughout so the source catalogue can be CRF today, the unified catalogue tomorrow, or a third party's.

### Review: code facts, AI judgement, routing

**Code-computed facts** (in `chordl-voicing`, pure functions, shown live in the builder and stored with the submission):

- Spelling: 3rd present; 7th present when the symbol has one; 5th and any extensions present and correct.
- Unwritten additions: any note the symbol doesn't name (e.g. a 9 in a plain C7). Not wrong, but flagged.
- Bass: lowest note matches root / inversion / slash bass; root omitted noted (fine for rootless grips, still recorded).
- Playable: fingers needed ≤ 4 (barre counts once); stretch within the level's limit; muted string between fretted strings; keyboard hand span per hand.
- Muddiness: 3rds and close intervals in the low register.
- Duplicate: `shape` hash matches an existing voicing; `pitch` hash matches (same sound, different grip); same shape transposed.
- Movable: no open strings, so it works in all 12 keys.

Reuse what exists: `chordl-guitar/src/voicingReview.ts` already computes many of these as `ReasonCode`s (`omits:*`, `rootless`, `bass-not-low`, `low-interval`, `span-4`, `finger-spacing`, `unison`, …) and `experience.ts` maps facts to `beginner | emerging | established`. `chordl-voicings/src/experience.ts` does the keyboard equivalent. The new checks generalise these to the format; they must not fork the rules.

**AI judgement** (scorecard, each item a value + one-line reason + confidence 0–1):

- Difficulty vs ours: `easier | same | harder`, and whether it suits the selected level better.
- Hand position: comfort, finger economy, closeness to neighbouring common chords.
- Sound: fuller/thinner/brighter; what the top note is doing.
- Idiom: is this how players in the style actually play it?
- Teaching value: does it show something reusable?
- What's different and why: a short written comparison with the source voicing.

The AI receives the code facts as input and must not contradict them.

**Routing:**

| Condition | Result |
|---|---|
| Hard fail: missing 3rd, notes that don't match the symbol (other than allowed omissions), physically unplayable | hidden (`held`), to staff |
| Flag: unwritten addition, any AI confidence below threshold, verdict "harder" yet claims better | stays live, to staff |
| Otherwise | stays live; signed-out submissions are released from `held` |

Exact thresholds are the builder's call, set in config, and recorded with each review.

### Review records (for the separate improvement loop)

Stored per submission revision, append-only:

- the code facts (and `chordl-voicing` version that produced them)
- the AI scorecard, the model ID and the review-prompt version
- the routing outcome
- the staff decision when there is one, including each scorecard item staff overrode

The review prompt lives in the repo, versioned, so scoring is transparent. Staff overrides are the improvement loop's main signal; nothing in this project acts on them.

**Superseded 2026-10-30:** the final human review now happens in the `chord-catalogue` pull request, with decisions written back to the intake record. Intake staff only clear hard-failed or flagged submissions for promotion. See `2026-10-30-chord-catalogue-publishing-design.md`.

## Constraints

- Monorepo conventions: TypeScript, React 19, Vitest, `@pepperhorn/` scope, contextual class names alongside Tailwind utilities, Poppins, the note-text SVG style from the global instructions for any note-letter-on-dot rendering.
- The overlay must embed cleanly, as `BoardEditor` does after PR #82: scoped styles, unique control IDs, no keyboard shortcuts leaking out of the overlay, no submitting a surrounding form.
- One fix per PR, reviewed and merged before the next (standing preference).
- Mocked wrappers have certified inert code before in this repo: budget a real browser pass for the overlay, not just unit tests.

## Porting the builder

The original builder is `/home/shaun/frames/src/components/ChordWorkbench.tsx` (≈850 LOC, React, svguitar `Chord` state, presets, fret-code input, barres, finger labels). chordl-guitar's instrument model was already ported from frames. Port the interaction, not the state shape: the builder edits a `chordl.voicing/1` fretted realization and renders through chordl's existing guitar rendering. Frames' styling, export (SVG/PNG/PDF) and scale/tab modes are out of scope.

The keyboard builder is new: click keys to toggle notes on a piano range, assign to left/right hand, live spelling against the chord.

## Integration points

- **First host:** the chordl board's chord cards (an action on a card opens the overlay with that card's chord, instrument and voicing). The CRF chords site and others follow once proven.
- **Existing voicings as sources:** chordl's generated/library voicings don't have catalogue IDs yet. Until the unified catalogue exists, a source is identified by `system:<package>@<version>` plus the shape hash, so a tweak can still record what it was based on. CRF `chord_data` UUIDs are accepted as opaque source IDs where the host has them.

## Left to the builder

- Package internals, file layout, component breakdown, exact API names.
- JSON Schema dialect and tooling; hashing details (canonicalisation must be documented and stable).
- UI layout and copy of the overlay and builders, within the constraints above.
- Confidence and stretch thresholds (config, recorded per review).
- Which model is used for the text box and the reviewer (default to the latest Claude models; record the model ID).
- ph-apps collection design for submissions and review records.
