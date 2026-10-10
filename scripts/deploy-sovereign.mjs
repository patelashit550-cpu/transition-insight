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
}

const upload = spawnSync(process.execPath, ["scripts/pinata-upload-dir.mjs"], {
  stdio: "inherit",
  shell: false,
  cwd: process.cwd(),
});
process.exit(upload.status ?? 1);
