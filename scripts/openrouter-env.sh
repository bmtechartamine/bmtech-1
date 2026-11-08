#!/usr/bin/env bash
# Point Claude Code at OpenRouter's Anthropic-compatible API.
#
# Usage (must be sourced so the exports stay in your shell):
#   source scripts/openrouter-env.sh
#   claude
#
# Reads OPENROUTER_API_KEY (and optional ANTHROPIC_DEFAULT_*_MODEL pins) from the
# environment or from a .env file at the repo root.
# Only paid Anthropic Claude models are supported: https://openrouter.ai/models?q=anthropic

_repo_root="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"

if [ -z "${OPENROUTER_API_KEY:-}" ] && [ -f "$_repo_root/.env" ]; then
  set -a; . "$_repo_root/.env"; set +a
fi

if [ -z "${OPENROUTER_API_KEY:-}" ] || [ "$OPENROUTER_API_KEY" = "sk-or-v1-your-key" ]; then
  echo "OPENROUTER_API_KEY is not set. Create one at https://openrouter.ai/settings/keys and put it in .env" >&2
  unset _repo_root
  return 1 2>/dev/null || exit 1
fi

export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"
export ANTHROPIC_API_KEY=""   # must be empty, otherwise it takes precedence over the token

# Optional model pins (exported only if set, e.g. in .env)
[ -n "${ANTHROPIC_DEFAULT_SONNET_MODEL:-}" ] && export ANTHROPIC_DEFAULT_SONNET_MODEL
[ -n "${ANTHROPIC_DEFAULT_HAIKU_MODEL:-}" ] && export ANTHROPIC_DEFAULT_HAIKU_MODEL
[ -n "${ANTHROPIC_DEFAULT_OPUS_MODEL:-}" ] && export ANTHROPIC_DEFAULT_OPUS_MODEL

echo "Claude Code configured for OpenRouter (ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL)"
unset _repo_root
