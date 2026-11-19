# PongsoNoTao: AI collaboration rules

Shared by every AI agent that touches this repo (Claude Code, Codex, Grok bot, others).

## Reply style (all agents)
- Caveman style, full intensity, always on: short words, short sentences, no filler, answer first.
- Normal prose for code, commit messages, PR text, and security warnings.
- The owner reads Traditional Chinese (Taiwan) faster. Mix Chinese and English; use English when clearer.

## Start of session
1. Read `HANDOFF.md` at the repo root if it exists. It holds the goal, current state, failed attempts, and next steps.
2. If `.codegraph/` exists, query it (`codegraph explore "<symbols or question>"`, or the MCP tool `codegraph_explore`) before grep or reading files. No `.codegraph/`? Run `ai-setup/setup-ai.sh` once per device.
3. Do not re-derive a plan that is already written down.

## During work
- Read only the lines you need. Do not re-read unchanged files.
- Tag each plan phase with: model, mode (plan / edit / test / review), handoff point.
  - Opus-class: planning, architecture, hard debugging, final review.
  - Sonnet-class: normal implementation, edits, tests, docs.
  - Haiku-class: search, formatting, renames, log triage.

## End of session or near the usage limit
- Write or update `HANDOFF.md`: goal, state, files touched, failed attempts, next steps.
- Commit work in small commits. Do not push without the owner's approval. This repo is public (GitHub Pages).

## Not shared on purpose
- `.codegraph/` is a per-device SQLite index. Rebuild it on each device. Never sync it through Dropbox or git.
