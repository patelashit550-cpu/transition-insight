#!/usr/bin/env node
/**
 * Local Kubo sovereign deploy: build → IPFS path patch → local add.
 *
 *   npm run deploy:local
 *   npm run deploy:local -- --upload-only
 *   npm run deploy:local -- --ipns
 */
import { spawnSync } from "node:child_process";

const uploadOnly = process.argv.includes("--upload-only");
const ipns = process.argv.includes("--ipns");

if (!uploadOnly) {
  console.log("local-sovereign: build:global …");
  const build = spawnSync("npm run build:global", {
    stdio: "inherit",
    shell: true,
    cwd: process.cwd(),
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
  const patch = spawnSync("node scripts/ipfs-relative-export.mjs", {
    stdio: "inherit",
    shell: true,
    cwd: process.cwd(),
  });
  if (patch.status !== 0) {
    process.exit(patch.status ?? 1);
  }
}

const uploadArgs = ["scripts/kubo-upload-dir.mjs"];
if (ipns) uploadArgs.push("--ipns");
const upload = spawnSync("node", uploadArgs, {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});
process.exit(upload.status ?? 1);
