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
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

if (!uploadOnly) {
  console.log("local-sovereign: build:global …");
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

const uploadArgs = ["scripts/kubo-upload-dir.mjs"];
if (ipns) uploadArgs.push("--ipns");
const upload = spawnSync(process.execPath, uploadArgs, {
  stdio: "inherit",
  shell: false,
  cwd: process.cwd(),
});
process.exit(upload.status ?? 1);
