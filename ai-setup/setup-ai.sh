#!/usr/bin/env bash
# One-time AI tooling setup for PongsoNoTao on a new device.
# Safe to re-run. Never overwrites existing files.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Repo: $REPO_ROOT"

# 1. codegraph (local code knowledge graph)
if ! command -v codegraph >/dev/null 2>&1; then
  if command -v npm >/dev/null 2>&1; then
    echo "==> Installing codegraph (npm global)"
    npm i -g @colbymchenry/codegraph
  else
    echo "!! npm not found. Install Node.js first, then re-run." >&2
    exit 1
  fi
fi
codegraph telemetry off >/dev/null 2>&1 || true

# 2. Build this device's index (per-device, never synced)
echo "==> Building codegraph index"
( cd "$REPO_ROOT" && codegraph init -i )

# 3. Global Claude rules: only create if missing, never overwrite
GLOBAL="$HOME/.claude/CLAUDE.md"
if [ ! -f "$GLOBAL" ]; then
  mkdir -p "$HOME/.claude"
  cp "$REPO_ROOT/ai-setup/global-CLAUDE.md" "$GLOBAL"
  echo "==> Created $GLOBAL"
else
  echo "==> $GLOBAL exists, left unchanged. Merge ai-setup/global-CLAUDE.md by hand if wanted."
fi

# 4. Register codegraph MCP for installed agents (global)
codegraph install -t auto -l global -y || echo "!! codegraph install skipped"

cat <<'EOF'

Done. Manual steps left:
  - Install the claude-mem plugin in Claude Code (and claude-mem-grok-bot / Codex if used).
  - Restart your agents so the codegraph MCP server loads.
EOF
