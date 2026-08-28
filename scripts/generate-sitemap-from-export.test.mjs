import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

/**
 * Smoke: generate-sitemap-from-export must omit /cord even when out/cord exists.
 * Runs the script against a fake out/ tree.
 */
test("sitemap discovery omits cord export paths", () => {
  const root = mkdtempSync(join(tmpdir(), "ti-sitemap-"));
  const out = join(root, "out");
  const publicDir = join(root, "public");
  mkdirSync(join(out, "me", "connexion"), { recursive: true });
  mkdirSync(join(out, "cord", "compose"), { recursive: true });
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(out, "index.html"), "<html></html>");
  writeFileSync(join(out, "me", "connexion", "index.html"), "<html></html>");
  writeFileSync(join(out, "cord", "index.html"), "<html></html>");
  writeFileSync(join(out, "cord", "compose", "index.html"), "<html></html>");

  const script = join(process.cwd(), "scripts", "generate-sitemap-from-export.mjs");
  const result = spawnSync(process.execPath, [script], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NEXT_PUBLIC_SITE_URL: "https://ashitmilne.xyz" },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /me\/connexion/);
  assert.doesNotMatch(result.stdout, /\/cord/);

  rmSync(root, { recursive: true, force: true });
});
