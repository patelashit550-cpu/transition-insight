import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

import { Keypair } from "@solana/web3.js";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const signScript = join(repositoryRoot, "scripts", "sign-content.mjs");

function runSign(env) {
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", signScript],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        // Force laptop-key path under test; drop any ambient signing key.
        SOLANA_SIGNING_KEY: "",
        SOLANA_KEYPAIR_PATH: "",
        ...env,
      },
    },
  );
}

test("content:sign reads SOLANA_KEYPAIR_PATH (does not require SOLANA_SIGNING_KEY)", () => {
  const generated = Keypair.generate();
  const dir = mkdtempSync(join(tmpdir(), "sign-content-"));
  const filePath = join(dir, "id.json");
  writeFileSync(filePath, JSON.stringify([...generated.secretKey]));

  const result = runSign({ SOLANA_KEYPAIR_PATH: filePath });

  assert.notEqual(result.status, 0);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(
    output,
    /is not the corpus wallet|Signing key .* is not the corpus wallet/,
    "KEYPAIR_PATH must be loaded far enough to reach the corpus-wallet check",
  );
  assert.doesNotMatch(
    output,
    /Set SOLANA_SIGNING_KEY \(base58 secret key\)/,
    "must not claim only SOLANA_SIGNING_KEY is supported",
  );
});

test("content:sign still errors when neither laptop key source is set", () => {
  const result = runSign({});
  assert.notEqual(result.status, 0);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /SOLANA_SIGNING_KEY or SOLANA_KEYPAIR_PATH/);
});
