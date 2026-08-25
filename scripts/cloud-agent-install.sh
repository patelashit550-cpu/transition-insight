#!/usr/bin/env bash
# Idempotent Cloud Agent install for transition-insight.
# Installs npm deps from the lockfile and verifies Next.js is resolvable
# before any start/terminals command launches the dev server.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f package-lock.json ]]; then
  echo "error: package-lock.json missing; cannot run npm ci" >&2
  exit 1
fi

npm ci

if [[ ! -f node_modules/next/package.json ]]; then
  echo "error: next package missing after npm ci" >&2
  exit 1
fi

# Disable Next.js telemetry so the dev terminal boots non-interactively and
# without the first-run telemetry notice. Persisted to the user config, so it
# survives into snapshots and later boots. Non-fatal if it cannot be written.
node ./node_modules/next/dist/bin/next telemetry disable >/dev/null 2>&1 || true

node -e "const p = require('next/package.json'); console.log('cloud-agent-install: next', p.version)"
echo "cloud-agent-install: ok"
