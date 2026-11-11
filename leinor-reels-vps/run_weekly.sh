#!/usr/bin/env bash
# Lancé chaque dimanche par cron : Claude Code prépare les Reels de la semaine suivante.
cd "$(dirname "$0")"
export PATH="$HOME/.local/bin:$HOME/.npm-global/bin:/usr/local/bin:$PATH"
claude -p "$(cat WEEKLY_PROMPT.md)" \
  --allowedTools "Bash,Read,Write,Edit,mcp__higgsfield" \
  >> logs/weekly-claude.log 2>&1
