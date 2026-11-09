# Changelog

## 0.5.3

- Expose `StaffNotation` loading/ready/error states through `data-chordl-state`; ready follows SVG injection, and failed requests return to loading on retry (#119).
- Mark finished guitar notices ready and retain public component JSDoc.
- Load guitar rendering/data on first use; expose additive loading and ready markers.

## 0.5.2

- Load smplr on first WAV export instead of importing it eagerly, allowing audio playback and export code to share an on-demand sampler chunk.
