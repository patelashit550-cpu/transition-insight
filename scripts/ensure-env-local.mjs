/**
 * Create a laptop-only .env.local from the visible example.
 * Does not overwrite an existing file. Never prints secret values.
 */
import { copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const examplePath = join(root, ".env.local.example");
const destPath = join(root, ".env.local");

if (!existsSync(examplePath)) {
  console.error("Missing .env.local.example — pull the latest branch and retry.");
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
    "Cursor will not list .env.local in the file tree.",
    "Windows Explorer hides names that start with a dot unless View → Show → Hidden items is on.",
    "Open that path in Notepad:",
    `  notepad "${dest}"`,
    "Paste:",
    "  JUPITER_API_KEY=     https://developers.jup.ag/portal",
    "  ETHERSCAN_API_KEY=   https://etherscan.io/apidashboard",
    "Then: npm run eth:node-tokens -- USDC",
    "      npm run eth:node-tokens",
  ].join("\n"),
);
