# Voicing editors

Single-chord React 18+ components. Import the CSS once; lazy-load the component package when your sheet opens. There is no storage or submission service.

```tsx
import { KeyboardSpeller, FrettedEditor, canUse } from '@pepperhorn/chordl-voicing-editor';
import '@pepperhorn/chordl-voicing-editor/editor.css';

// Keep onChange stable where possible. Key by chord/face/source to open a new draft.
<FrettedEditor key={`${chord}:${face}:${initial?.id}`} chord={chord} face={face}
  initial={initial} onChange={(voicing, checks) => setDraft({voicing, checks})} />
<button type="button" disabled={!draft || !canUse(draft.checks)}
  onClick={() => useVoicing(draft.voicing)}>Use this voicing</button>
```

`KeyboardSpeller` takes `keyboard` / `keyboard-hands`; `FrettedEditor` takes `guitar`, `guitar-top3`, `ukulele`, `bass4`. Both emit `(voicing | null, EditorChecks)` initially and on edits. Invalid text emits null. Checks include notes with degrees, hard failures, warnings and computed level. Initial voicings seed a draft and set `provenance.basedOn` to `id@rev`. Remount with a new key when changing chord, face or initial.

Keyboard input accepts natural-language chords, inversions, note lists and `rh` / `lh` / `//`. Rendering uses `PianoChord`, CRF theme, note names at `xl`, and size factor 2 (board `xl`). Override `theme`, `showNoteNames`, `noteNameSize`, `size`. Keys are display-only; PianoChord supplies playback. The keyboard scrolls inside its container.

Fret code is low string first: `x32000` or `x 10 12 12 11 10`. Fields and diagram edit absolute frets. Moving the starting fret moves stopped notes and barres by the same amount; open/muted strings remain open/muted. Barre endpoints display physical string numbers; the emitted JSON uses zero-based low-string-first indices. Fingers are optional 1–4. Top3 locks strings 4–6 muted. The diagram uses chordl-react's fretted renderer; labelled HTML buttons follow its measured fret and string lines. Playback uses chordl audio (hosts may configure sample URLs through chordl-react).

Styles are scoped under `.cve-editor`; override `--cve-ink`, `--cve-paper`, `--cve-line`, `--cve-accent`. No global keyboard handlers, form submit buttons or host persistence. Keyboard text Enter is suppressed inside host forms. Hosts own their use/save/cancel controls.

Run `pnpm --filter @pepperhorn/chordl-voicing-editor dev` for the demo at port 5770. The editor tests mock heavy renderers for deterministic DOM tests; browser evidence exercises the real renderer separately.
