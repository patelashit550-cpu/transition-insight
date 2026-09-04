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

test("leaves Next App Router flight .txt payloads byte-for-byte intact", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "ipfs-relative-export-txt-"));
  const pagePath = join(fixtureRoot, "out", "governance", "identity", "index.html");
  const flightPath = join(fixtureRoot, "out", "governance", "identity", "index.txt");
  const segmentPath = join(fixtureRoot, "out", "governance", "identity", "__next.$d$full.txt");
  const rootFlightPath = join(fixtureRoot, "out", "index.txt");
  const robotsPath = join(fixtureRoot, "out", "robots.txt");
  const flightSource = '1:"$Sreact.fragment"\n2:I["/_next/static/chunks/client.js"]\n';
  const robotsSource = "User-Agent: *\nAllow: /\n";

  try {
    await mkdir(dirname(pagePath), { recursive: true });
    await writeFile(pagePath, '<img src="/visuals/wheel.svg">');
    await writeFile(flightPath, flightSource);
    await writeFile(segmentPath, flightSource);
    await writeFile(rootFlightPath, flightSource);
    await writeFile(robotsPath, robotsSource);

    const result = spawnSync(process.execPath, [exporterPath], {
      cwd: fixtureRoot,
      encoding: "utf8",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(await readFile(flightPath, "utf8"), flightSource);
    assert.equal(await readFile(segmentPath, "utf8"), flightSource);
    assert.equal(await readFile(rootFlightPath, "utf8"), flightSource);
    assert.equal(await readFile(robotsPath, "utf8"), robotsSource);
    assert.equal(await readFile(pagePath, "utf8"), '<img src="../../visuals/wheel.svg">');
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
