#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const uploadOnly = process.argv.includes("--upload-only");

if (!uploadOnly) {
  console.log("sovereign: build:global …");
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

const upload = spawnSync("node scripts/pinata-upload-dir.mjs", {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
});
process.exit(upload.status ?? 1);
