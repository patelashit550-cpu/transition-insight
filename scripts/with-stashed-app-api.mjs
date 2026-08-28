#!/usr/bin/env node
/**
 * Static export must not ship local-only Chord surfaces:
 *   - src/app/api          (write API)
 *   - src/app/(reading)/cord (feed + compose pages)
 *   - public/cord          (feed.json mirror)
 *
 * Stash those paths for the duration of the command, restore afterward
 * (even on failure).
 *
 * Usage: node scripts/with-stashed-app-api.mjs <command> [args...]
 */
import { cpSync, existsSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();

/** @type {{ readonly live: string; readonly stash: string; readonly label: string }[]} */
const STASH_TARGETS = [
  {
    live: join(root, "src", "app", "api"),
    stash: join(root, "src", "app", "_api.dev"),
    label: "src/app/api",
  },
  {
    live: join(root, "src", "app", "(reading)", "cord"),
    stash: join(root, "src", "app", "(reading)", "_cord.dev"),
    label: "src/app/(reading)/cord",
  },
  {
    live: join(root, "public", "cord"),
    stash: join(root, "public", "_cord.dev"),
    label: "public/cord",
  },
];

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
  for (const target of STASH_TARGETS) {
    if (existsSync(target.live) && existsSync(target.stash)) {
      console.error(
        `with-stashed-app-api: both ${target.label} and stash exist — resolve manually, then retry.`,
      );
      process.exit(1);
    }
  }

  /** @type {{ live: string; stash: string; label: string }[]} */
  const stashed = [];
  try {
    for (const target of STASH_TARGETS) {
      if (existsSync(target.live)) {
        await moveDir(target.live, target.stash, `stash ${target.label}`);
        stashed.push(target);
        console.log(`with-stashed-app-api: stashed ${target.label} (static export)`);
      } else if (existsSync(target.stash)) {
        stashed.push(target);
        console.log(`with-stashed-app-api: using existing stash for ${target.label}`);
      }
    }

    const result = spawnSync(cmd, args, {
      stdio: "inherit",
      env: process.env,
      shell: true,
      cwd: root,
    });
    process.exitCode = result.status ?? 1;
  } finally {
    for (const target of [...stashed].reverse()) {
      if (existsSync(target.stash) && !existsSync(target.live)) {
        await moveDir(target.stash, target.live, `restore ${target.label}`);
        console.log(`with-stashed-app-api: restored ${target.label}`);
      } else if (existsSync(target.stash) && existsSync(target.live)) {
        console.warn(
          `with-stashed-app-api: both live and stash present for ${target.label} — remove the stash dir if duplicate`,
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
