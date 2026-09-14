#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Prefer normal developer tools; support the bundled Codex runtime on this Mac.
if command -v node >/dev/null 2>&1 && command -v pnpm >/dev/null 2>&1; then
  breakglass_pnpm="$(command -v pnpm)"
else
  breakglass_runtime="${HOME}/.cache/codex-runtimes/codex-primary-runtime/dependencies"
  if [[ ! -x "${breakglass_runtime}/node/bin/node" || ! -x "${breakglass_runtime}/bin/fallback/pnpm" ]]; then
    echo 'Install Node.js 22.12+ and pnpm 11, then run ./dev.sh again.' >&2
    exit 1
  fi
  export PATH="${breakglass_runtime}/node/bin:${PATH}"
  breakglass_pnpm="${breakglass_runtime}/bin/fallback/pnpm"
fi

if [[ ! -x node_modules/.bin/vite ]]; then
  "${breakglass_pnpm}" install --frozen-lockfile
fi
exec "${breakglass_pnpm}" dev "$@"
