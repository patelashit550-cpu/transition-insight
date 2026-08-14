/**
 * Create .env.local from the blank example. Does not overwrite. Never prints secrets.
 */
import { copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const examples = ["env.local.example", ".env.local.example"];
const examplePath = examples.map((name) => join(root, name)).find((path) => existsSync(path));
const destPath = join(root, ".env.local");

if (!examplePath) {
  console.error("Missing env.local.example — pull this branch and retry.");
  process.exit(1);
}

const dest = resolve(destPath);

if (existsSync(destPath)) {
  console.log(`Open this file and put your keys in it:\n  ${dest}`);
} else {
  copyFileSync(examplePath, destPath);
  console.log(`Created:\n  ${dest}\nOpen it and paste JUPITER_API_KEY and ETHERSCAN_API_KEY.`);
}
