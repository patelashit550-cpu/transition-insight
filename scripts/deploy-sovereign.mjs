#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const uploadOnly = process.argv.includes("--upload-only");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

if (!uploadOnly) {
  console.log("sovereign: build:global …");
  const build = spawnSync(npmCommand, ["run", "build:global"], {
    stdio: "inherit",
    shell: false,
    cwd: process.cwd(),
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
  const patch = spawnSync(process.execPath, ["scripts/ipfs-relative-export.mjs"], {
    stdio: "inherit",
    shell: false,
    cwd: process.cwd(),
  });
  if (patch.status !== 0) {
    process.exit(patch.status ?? 1);
  }
}

const upload = spawnSync(process.execPath, ["scripts/pinata-upload-dir.mjs"], {
  stdio: "inherit",
  shell: false,
  cwd: process.cwd(),
});
process.exit(upload.status ?? 1);
