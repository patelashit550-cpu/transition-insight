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

node -e "const p = require('next/package.json'); console.log('cloud-agent-install: next', p.version)"
echo "cloud-agent-install: ok"
