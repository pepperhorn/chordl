<!-- ph-orch:begin v2 — managed by orch-init -->
@AGENTS.md

## Claude-specific notes

- **As lead**, use the `orch-dispatch` skill. Ask the human questions with AskUserQuestion. Dispatch through T3 `delegate_task`, not the native Agent tool, because native subagents can't target Codex or apply T3 model options.
- **As implementer or reviewer**, your brief is the handoff doc whose path you were given, not this conversation. The `.claude/agents/orch-implementer.md` and `orch-reviewer.md` definitions encode the same rules for native use.
- Don't poll async tasks. The completion notification wakes this thread.
<!-- ph-orch:end -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

chordl — a React project (details to be filled in once the codebase is initialized).

## Commands

<!-- Update these once the project is scaffolded -->
- **Install dependencies**: `npm install`
- **Dev server**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Test**: `npm test`
- **Single test**: `npm test -- --grep "test name"`

## Workflow

- **Commit as you go**: Make commits incrementally as features/fixes are completed. Don't batch everything into one big commit at the end.

## Architecture

<!-- Document key architectural decisions here as the project takes shape -->
