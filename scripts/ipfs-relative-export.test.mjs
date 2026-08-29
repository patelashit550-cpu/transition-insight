import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const exporterPath = join(repositoryRoot, "scripts", "ipfs-relative-export.mjs");

test("rewrites page assets without modifying generated Next runtime files", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "ipfs-relative-export-"));
  const pagePath = join(fixtureRoot, "out", "reading", "index.html");
  const runtimePath = join(fixtureRoot, "out", "_next", "static", "chunks", "runtime.js");
  const pageSource =
    '<script src="/_next/static/chunks/runtime.js"></script>' +
    '<script>self.__next_f.push([1,"I[\\"/_next/static/chunks/client.js\\"]"])</script>' +
    '<img src="/visuals/wheel.svg">';
  const runtimeSource = 'const assetPath="/_next/";';

  try {
    await mkdir(dirname(pagePath), { recursive: true });
    await mkdir(dirname(runtimePath), { recursive: true });
    await writeFile(pagePath, pageSource);
    await writeFile(runtimePath, runtimeSource);

    const result = spawnSync(process.execPath, [exporterPath], {
      cwd: fixtureRoot,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(pagePath, "utf8"),
      '<script src="../_next/static/chunks/runtime.js"></script>' +
        '<script>self.__next_f.push([1,"I[\\"/_next/static/chunks/client.js\\"]"])</script>' +
        '<img src="../visuals/wheel.svg">',
    );
    assert.equal(await readFile(runtimePath, "utf8"), runtimeSource);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
