#!/usr/bin/env node
/**
 * Thin wrapper — prefer `with-stashed-app-api.mjs` (stashes API + Chord paths).
 * Kept so older docs/commands still work.
 *
 * Usage: node scripts/with-export-safe.mjs <command> [args...]
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const cmd = process.argv[2];
const args = process.argv.slice(3);

if (!cmd) {
  console.error("usage: node scripts/with-export-safe.mjs <command> [args...]");
  process.exit(1);
}

const wrapper = join(process.cwd(), "scripts", "with-stashed-app-api.mjs");
const result = spawnSync(process.execPath, [wrapper, cmd, ...args], {
  stdio: "inherit",
  env: process.env,
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
