#!/usr/bin/env node
/**
 * Static export cannot include App Router route handlers.
 * Chord write API is local-dev only — stash src/app/api during production builds,
 * restore afterward (even on failure).
 *
 * Usage: node scripts/with-stashed-app-api.mjs <command> [args...]
 */
import { cpSync, existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();
const apiDir = join(root, "src", "app", "api");
const stashDir = join(root, "src", "app", "_api.dev");

const cmd = process.argv[2];
const args = process.argv.slice(3);

if (!cmd) {
  console.error("usage: node scripts/with-stashed-app-api.mjs <command> [args...]");
  process.exit(1);
}

/** Windows often holds locks briefly after Turbopack; retry then copy+rm. */
async function moveDir(from, to, label) {
  let lastErr;
  for (let i = 0; i < 8; i++) {
    try {
      if (existsSync(to)) rmSync(to, { recursive: true, force: true });
      renameSync(from, to);
      return;
    } catch (error) {
      lastErr = error;
      await delay(150 * (i + 1));
    }
  }
  try {
    cpSync(from, to, { recursive: true });
    rmSync(from, { recursive: true, force: true });
    console.warn(`with-stashed-app-api: ${label} via copy (rename locked)`);
    return;
  } catch (error) {
    lastErr = error;
  }
  throw lastErr;
}

async function main() {
  const hadApi = existsSync(apiDir);
  const stashOccupied = existsSync(stashDir);

  if (hadApi && stashOccupied) {
    console.error(
      "with-stashed-app-api: both src/app/api and src/app/_api.dev exist — resolve manually, then retry.",
    );
    process.exit(1);
  }

  let stashed = false;
  if (hadApi) {
    await moveDir(apiDir, stashDir, "stash");
    stashed = true;
    console.log("with-stashed-app-api: stashed src/app/api → src/app/_api.dev (static export)");
  } else if (stashOccupied) {
    console.log("with-stashed-app-api: using existing stash at src/app/_api.dev");
    stashed = true;
  }

  let status = 1;
  try {
    const result = spawnSync(cmd, args, {
      stdio: "inherit",
      env: process.env,
      shell: true,
      cwd: root,
    });
    status = result.status ?? 1;
  } finally {
    if (stashed && existsSync(stashDir) && !existsSync(apiDir)) {
      await moveDir(stashDir, apiDir, "restore");
      console.log("with-stashed-app-api: restored src/app/api");
    } else if (stashed && existsSync(stashDir) && existsSync(apiDir)) {
      console.warn(
        "with-stashed-app-api: both dirs present after build — remove src/app/_api.dev if duplicate",
      );
    }
  }

  process.exit(status);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
