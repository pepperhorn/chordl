# Plan 0045 — Load notation, guitar and audio code on demand

- **Spec:** ../specs/0045-load-on-demand.md
- **Base:** main @ dc6f8d2
- **Verification (whole item):** `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site && node scripts/verify-board-package.mjs`

## Approach
- **Board:** drop the idle prefetch branch, wrap `GuitarChordPanel` in `React.lazy` with the marked fallback, and add the ready marker.
- **React:** make wav-export import `smplr` dynamically, matching playback, so the bundler can split it.

The tasks run in order because board consumes react's built dist.

## Tasks

### T1 — react: dynamic smplr in wav-export
- **Depends on:** —
- **Route:** implement (default)
- **Owns:** `packages/chordl-react/src/audio/**`, `packages/chordl-react/test/**` (audio tests only), `packages/chordl-react/package.json` (version only), `packages/chordl-react/CHANGELOG.md`
- **Acceptance:** AC2 (smplr part), AC5
- **Notes:** check whether `GuitarChordPanel`'s heavy imports can also go lazy inside react without changing its export. If so, do it here and report.

### T2 — board: no idle Verovio prefetch, lazy guitar panel, loading/ready markers
- **Depends on:** T1 merged
- **Route:** implement (default)
- **Owns:** `packages/chordl-board/src/BoardEditor.tsx`, `packages/chordl-board/src/ChordBoard.tsx`, `packages/chordl-board/src/BoardPlayer.tsx` (if it renders cards), `packages/chordl-board/test/**`, `packages/chordl-board/package.json` (version only), `packages/chordl-board/CHANGELOG.md`
- **Acceptance:** AC1–AC5

## Merge order
T1 → T2

## Risks
A waterfall on first notation or guitar use (a short loading state is accepted), and readiness misread by becreative (AC4).
