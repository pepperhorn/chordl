# Handoff: 0045-t2 — lead answers to the blocked return (lead → sol)

- **Date:** 2026-11-09
- **Type:** dispatch (answers)
- **Ledger:** 0045 · **Spec:** docs/specs/0045-load-on-demand.md · **PR:** https://github.com/pepperhorn/chordl/pull/114 (head 1cf3f84)
- **Status:** open

## Answers
1. **The cards test: ownership granted.** You now also own `packages/chordl-cards/test/ChordCardPlayer.test.tsx`. Make the guitar assertions (~line 160, and any others that read the guitar SVG) await rendering: `findBy…` or `waitFor`, or better, wait for `data-chordl-state="ready"` on `.bc-guitar-chord`. Don't add a test-only eager path.
2. **Check one more consumer for timing assumptions.** `packages/chordl-cards/src/ChordCardPlayer.tsx` (~127, and ~365 where `<GuitarChord>` is rendered) adds the "sounding" class to GuitarChord's string markers during playback. Make sure playback started on the first render, before the lazy guitar has painted, doesn't throw or leave markers unset once the diagram appears. Write a test for that case. If it fails, you also own `ChordCardPlayer.tsx` for the smallest fix: re-apply marking once the guitar root reports `ready`. Otherwise leave it untouched and say so.
3. **Finish AC3** in headless Chromium on port 5652:
   - switch to notation (Verovio loads on first use, not before)
   - add a guitar card (the guitar chunk loads then)
   - play audio
   - WAV/ZIP export
   - PDF export
   
   Paste the request log for each step showing when each lazy chunk loads.
4. **Run the full verify command** plus `node scripts/verify-board-package.mjs`.

## Then
Push to the same branch, mark the return handoff done with a "Lead answers response" section, reply on the PR. The becreative readiness rule in your handoff is good. Keep it as written.
