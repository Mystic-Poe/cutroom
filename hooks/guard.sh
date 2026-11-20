#!/bin/sh
# Fail-closed shim: if Node is missing or the guard crashes, ask instead of allowing.
ASK='{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"cutroom could not run its safety check (Node.js missing or broken), so it is asking you instead. OK to run this?"}}'
ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
if ! command -v node >/dev/null 2>&1; then
  cat >/dev/null
  echo "$ASK"
  exit 0
fi
OUT=$(node "$ROOT/bin/cutroom-guard") || { echo "$ASK"; exit 0; }
[ -n "$OUT" ] && echo "$OUT"
exit 0
