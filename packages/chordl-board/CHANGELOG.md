# Changelog

## 0.2.4

- Wait for pending card renders before PNG/PDF capture (bounded at 15 seconds); avoid the redundant editor guitar import boundary.
- Load guitar rendering/data on first use; expose additive loading and ready markers. Remove idle notation prefetch while retaining explicit Display warm-up.
