/**
 * Cross-platform wrapper: set NEXT_PUBLIC_CONTENT_TIER then run a command.
 * Usage: node scripts/with-content-tier.mjs <tier> <command...>
 */
import { spawnSync } from "child_process";

const tier = process.argv[2];
const cmd = process.argv[3];
const args = process.argv.slice(4);

if (!tier || !cmd) {
  console.error("usage: node scripts/with-content-tier.mjs <tier> <command> [args...]");
  process.exit(1);
}

process.env.NEXT_PUBLIC_CONTENT_TIER = tier;
const result = spawnSync(cmd, args, { stdio: "inherit", env: process.env, shell: true });
process.exit(result.status ?? 1);
