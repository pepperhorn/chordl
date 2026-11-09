<!-- ph-orch:begin v3 — managed by orch-init -->
@AGENTS.md

## Claude-specific notes

- **As lead**, use the `orch-dispatch` and `orch-sweep` skills. Ask the human questions with AskUserQuestion, but only decisions that are theirs. Do read-only research (repos, packages, GBrain, docs) without asking first (AGENTS.md §5a). Dispatch through T3 `delegate_task`, not the native Agent tool, because native subagents can't target Codex or apply T3 model options. Native subagents are fine for read-only research. Never use them to edit code in the main checkout.
- **Hooks** guard the lead's checkout: `lead-guard` denies edits outside docs and the ledger (and pushes of code commits), `lead-post` flags code that a shell command changed or committed, and `lead-stop` blocks ending the turn while ledger rows or open PRs need you. A block means act on what it lists (dispatch, review, merge, close, or set Waiting on to `human: <why>`). Don't argue with it or work around it.
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
