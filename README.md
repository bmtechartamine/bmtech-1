# bmtech-1

## Using Claude Code with OpenRouter

Claude Code talks to an Anthropic-compatible API. OpenRouter provides one, so you can
run Claude Code with an OpenRouter key instead of an Anthropic key.

1. Create a key at <https://openrouter.ai/keys>.
2. Top up your OpenRouter account — Anthropic models on OpenRouter need a one-time
   $10 credit purchase before they can be used.
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

To set it up by hand instead:

```bash
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_AUTH_TOKEN="sk-or-v1-your-key"
export ANTHROPIC_API_KEY=""
```

Never commit a real key.
