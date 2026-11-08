# bmtech-1

## Using Claude Code with OpenRouter

Claude Code talks to an Anthropic-compatible API. OpenRouter provides one, so you can
run Claude Code with an OpenRouter key instead of an Anthropic key.

1. Create a key at <https://openrouter.ai/settings/keys>.
2. Top up your OpenRouter account. Only paid Anthropic Claude models are supported
   (e.g. `anthropic/claude-sonnet-4.6`, `anthropic/claude-opus-4`); they need a
   one-time $10 credit purchase. Browse them at <https://openrouter.ai/models?q=anthropic>.
3. Save the key locally (`.env` is git-ignored):

   ```bash
   cp .env.example .env
   # edit .env and set OPENROUTER_API_KEY=sk-or-v1-...
   ```

4. Load the settings into your shell and start Claude Code:

   ```bash
   source scripts/openrouter-env.sh
   claude
   ```

The script sets:

| Variable | Value |
| --- | --- |
| `ANTHROPIC_BASE_URL` | `https://openrouter.ai/api` |
| `ANTHROPIC_AUTH_TOKEN` | your OpenRouter key |
| `ANTHROPIC_API_KEY` | `""` (must be empty, or it overrides the token) |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` / `_HAIKU_MODEL` / `_OPUS_MODEL` | optional model pins, only if set in `.env` |

### Permanent setup (all shells)

To make it permanent instead, add this to `~/.zshrc` or `~/.bashrc`, then open a new
terminal and run `claude`:

```bash
export OPENROUTER_API_KEY="<your-openrouter-api-key>"  # https://openrouter.ai/settings/keys
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="$OPENROUTER_API_KEY"
export ANTHROPIC_API_KEY=""  # must be explicitly empty to avoid conflicts

# Optional: pin specific models for each role
# export ANTHROPIC_DEFAULT_SONNET_MODEL="anthropic/claude-sonnet-4.6"
# export ANTHROPIC_DEFAULT_HAIKU_MODEL="anthropic/claude-haiku-4.5"
```

Never commit a real key.
