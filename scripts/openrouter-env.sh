#!/usr/bin/env bash
# Point Claude Code at OpenRouter's Anthropic-compatible API.
#
# Usage (must be sourced so the exports stay in your shell):
#   source scripts/openrouter-env.sh
#   claude
#
# Reads OPENROUTER_API_KEY from the environment or from a .env file at the repo root.

_repo_root="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"

if [ -z "${OPENROUTER_API_KEY:-}" ] && [ -f "$_repo_root/.env" ]; then
  set -a; . "$_repo_root/.env"; set +a
fi

if [ -z "${OPENROUTER_API_KEY:-}" ] || [ "$OPENROUTER_API_KEY" = "sk-or-v1-your-key" ]; then
  echo "OPENROUTER_API_KEY is not set. Create one at https://openrouter.ai/keys and put it in .env" >&2
  unset _repo_root
  return 1 2>/dev/null || exit 1
fi

export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"
export ANTHROPIC_API_KEY=""   # must be empty, otherwise it takes precedence over the token

echo "Claude Code configured for OpenRouter (ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL)"
unset _repo_root
