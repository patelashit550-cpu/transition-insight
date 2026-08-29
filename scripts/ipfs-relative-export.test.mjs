import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));

test("standard exports do not apply IPFS-relative URL rewriting", () => {
  for (const scriptName of ["build", "build:global", "build:preprod"]) {
    assert.doesNotMatch(packageJson.scripts[scriptName], /ipfs-relative-export|export:ipfs/);
  }
});

test("IPFS-relative rewriting remains an explicit build path", () => {
  assert.equal(packageJson.scripts["export:ipfs"], "node scripts/ipfs-relative-export.mjs");
  assert.equal(packageJson.scripts["build:ipfs"], "npm run build:global && npm run export:ipfs");
});

test("explicit IPFS export rewrites root URLs relative to each document", () => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "ipfs-relative-export-"));
  const nestedHtml = join(fixtureRoot, "out", "chronicle", "entry", "index.html");
  mkdirSync(dirname(nestedHtml), { recursive: true });
  writeFileSync(
    nestedHtml,
    '<script src="/_next/static/chunk.js"></script><img src="/visuals/wheel.webp">',
  );

  try {
    execFileSync(process.execPath, [join(repoRoot, "scripts", "ipfs-relative-export.mjs")], {
      cwd: fixtureRoot,
    });
    assert.equal(
      readFileSync(nestedHtml, "utf8"),
      '<script src="../../_next/static/chunk.js"></script><img src="../../visuals/wheel.webp">',
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
