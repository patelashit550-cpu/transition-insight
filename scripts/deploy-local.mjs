#!/usr/bin/env node
/**
 * Local Kubo sovereign deploy: build → local add (export is root-absolute; no path patch).
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
}

const uploadArgs = ["scripts/kubo-upload-dir.mjs"];
if (ipns) uploadArgs.push("--ipns");
const upload = spawnSync(process.execPath, uploadArgs, {
  stdio: "inherit",
  shell: false,
  cwd: process.cwd(),
});
process.exit(upload.status ?? 1);
