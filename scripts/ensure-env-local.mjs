/**
 * Create .env.local from the blank example. Does not overwrite. Never prints secrets.
 */
import { copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const examplePath = join(root, ".env.local.example");
const destPath = join(root, ".env.local");

if (!existsSync(examplePath)) {
  console.error("Missing .env.local.example — pull this branch and retry.");
  process.exit(1);
}

const dest = resolve(destPath);

if (existsSync(destPath)) {
  console.log(`Open this file and put your keys in it:\n  ${dest}`);
} else {
  copyFileSync(examplePath, destPath);
  console.log(
    `Created:\n  ${dest}\nOpen it to configure optional API keys and local IPFS settings.`,
  );
}
