/**
 * Create a laptop-only .env.local from the visible example.
 * Does not overwrite an existing file. Never prints secret values.
 */
import { copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const examples = ["env.local.example", ".env.local.example"];
const examplePath = examples.map((name) => join(root, name)).find((path) => existsSync(path));
const destPath = join(root, ".env.local");

if (!examplePath) {
  console.error("Missing env.local.example — checkout ashitmilne/jupiter-node-tokens-2a97 and retry.");
  process.exit(1);
}

const dest = resolve(destPath);

if (existsSync(destPath)) {
  console.log(`Already exists: ${dest}`);
} else {
  copyFileSync(examplePath, destPath);
  console.log(`Created: ${dest}`);
}

console.log(
  [
    "The file you can see in Cursor is env.local.example (no leading dot).",
    ".env.local is the secrets copy — Cursor and Explorer hide names that start with a dot.",
    "Open the secrets file in Notepad:",
    `  notepad "${dest}"`,
    "Paste:",
    "  JUPITER_API_KEY=     https://developers.jup.ag/portal",
    "  ETHERSCAN_API_KEY=   https://etherscan.io/apidashboard",
    "GitHub (this branch): https://github.com/patelashit550-cpu/transition-insight/blob/ashitmilne/jupiter-node-tokens-2a97/env.local.example",
    "Then: npm run eth:node-tokens -- USDC",
    "      npm run eth:node-tokens",
  ].join("\n"),
);
