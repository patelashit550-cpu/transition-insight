import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import { npmCliJs, resolveSpawn, runSync } from "./run-cmd.mjs";

test("npmCliJs resolves a real npm-cli.js for this Node install", () => {
  const cli = npmCliJs();
  assert.ok(existsSync(cli), `expected npm-cli.js at ${cli}`);
  assert.match(cli.replace(/\\/g, "/"), /\/npm-cli\.js$/);
});

test("resolveSpawn expands npm without shell", () => {
  const { command, args } = resolveSpawn("npm", ["--version"]);
  assert.equal(command, process.execPath);
  assert.equal(args[0], npmCliJs());
  assert.deepEqual(args.slice(1), ["--version"]);
});

test("runSync can invoke npm --version with shell:false", () => {
  const result = runSync("npm", ["--version"], { stdio: "pipe" });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(String(result.stdout), /^\d+\.\d+/);
});
