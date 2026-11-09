# Plan 0038 — Chord parser: only read a root from a standalone chord token

- **Spec:** ../specs/0038-parser-strict-roots.md
- **Base:** main @ 436e03e
- **Verification (whole item):** `pnpm build && pnpm lint && pnpm test:run && pnpm --filter @pepperhorn/chordl-react build:site`

## Approach
Anchor `CHORD_RE`'s root with a leading boundary (start, whitespace or punctuation) and require a trailing boundary after the match. Add `alt` aliases (` alt`, `(alt)`, `alt7` after the root) normalised to `7alt`. Pick the first token that satisfies both boundaries, skipping the article `a` per the spec rule.

## Tasks

### T1 — strict root + alt aliases
- **Depends on:** —
- **Route:** implement (default)
- **Owns:** `packages/chordl-core/src/parser/natural-language.ts`, `packages/chordl-core/test/natural-language.test.ts`
- **May read:** anything
- **Acceptance:** AC1–AC4
- **Verify:** as above
- **Notes / gotchas:** 0032 (#106) added `alt\b` to CHORD_RE and lowercases it in chordName (~line 983). Board/react tests have 30s budgets now (#107/#108); a timeout is a real signal.

## Merge order
T1

## Risks
Inputs that relied on a mid-word letter by accident change their parse. AC2's comparison is the guard; anything surprising goes in the return handoff, not a silent fix.
