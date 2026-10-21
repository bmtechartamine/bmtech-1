#!/bin/bash
# Prepares REA (MCP server + Ghidra engine) for Claude Code sessions.
# Never fails the session: missing pieces only disable native analysis.
set -u

GHIDRA_VERSION="12.1.4"
REA_VERSION="6.7.0"
INSTALL_ROOT="$HOME/.local/share/rea"
GHIDRA_DIR="$INSTALL_ROOT/ghidra_${GHIDRA_VERSION}_PUBLIC"

log() { echo "[install-rea] $*" >&2; }

# Warm the npm cache so the MCP server starts quickly.
npx -y "rea-agents@${REA_VERSION}" --version >/dev/null 2>&1 \
  || log "rea-agents@${REA_VERSION} could not be fetched from npm"

if ! command -v javac >/dev/null 2>&1; then
  log "JDK 21+ (javac) not found; Ghidra analysis will be unavailable"
elif [ ! -x "$GHIDRA_DIR/support/analyzeHeadless" ]; then
  mkdir -p "$INSTALL_ROOT"
  url=$(curl -fsS "https://api.github.com/repos/NationalSecurityAgency/ghidra/releases/tags/Ghidra_${GHIDRA_VERSION}_build" \
    | grep -o '"browser_download_url": *"[^"]*\.zip"' | head -1 | sed 's/.*"\(https[^"]*\)"/\1/')
  if [ -z "$url" ]; then
    log "cannot resolve Ghidra ${GHIDRA_VERSION} download (github.com blocked?)"
  else
    tmp=$(mktemp -d)
    if curl -fsSL "$url" -o "$tmp/ghidra.zip" && unzip -q "$tmp/ghidra.zip" -d "$INSTALL_ROOT"; then
      log "Ghidra installed at $GHIDRA_DIR"
    else
      log "Ghidra download or extraction failed"
    fi
    rm -rf "$tmp"
  fi
fi

if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export GHIDRA_INSTALL_DIR=\"$GHIDRA_DIR\"" >> "$CLAUDE_ENV_FILE"
fi
exit 0
