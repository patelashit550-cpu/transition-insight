#!/usr/bin/env node
/**
 * Static export cannot include App Router route handlers (e.g. Chord write API).
 * Stash src/app/api → src/app/_api.dev for the duration of the command, then restore.
 *
 * Usage: node scripts/with-export-safe.mjs <command> [args...]
 */
import { existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const apiDir = join(process.cwd(), "src", "app", "api");
const stashDir = join(process.cwd(), "src", "app", "_api.dev");

const cmd = process.argv[2];
const args = process.argv.slice(3);

if (!cmd) {
  console.error("usage: node scripts/with-export-safe.mjs <command> [args...]");
  process.exit(1);
}

function restore() {
  if (!existsSync(stashDir)) return;
  if (existsSync(apiDir)) {
    rmSync(apiDir, { recursive: true, force: true });
  }
  renameSync(stashDir, apiDir);
  console.log("with-export-safe: restored src/app/api");
}

let stashed = false;
if (existsSync(apiDir)) {
  if (existsSync(stashDir)) {
    rmSync(stashDir, { recursive: true, force: true });
  }
  renameSync(apiDir, stashDir);
  stashed = true;
  console.log("with-export-safe: stashed src/app/api (incompatible with output: export)");
}

const result = spawnSync(cmd, args, {
  stdio: "inherit",
  env: process.env,
  shell: true,
});

if (stashed) {
  try {
    restore();
  } catch (error) {
    console.error(
      "with-export-safe: FAILED to restore src/app/api — run: move src\\app\\_api.dev src\\app\\api",
    );
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

process.exit(result.status ?? 1);
