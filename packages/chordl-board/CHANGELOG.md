# Changelog

## 0.2.4

- Aggregate notation-card readiness from staff `data-chordl-state` markers: any error wins, all staves must be ready, and missing markers remain loading (#119).
- Wait for pending card renders before PNG/PDF capture (bounded at 15 seconds); avoid the redundant editor guitar import boundary.
- Load guitar rendering/data on first use; expose additive loading and ready markers. Remove idle notation prefetch while retaining explicit Display warm-up.
