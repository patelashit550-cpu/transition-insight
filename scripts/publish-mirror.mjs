#!/usr/bin/env node
/**
 * Mirror out/ to the GitHub Pages repo that serves transition-insight.sol.site.
 *
 *   node scripts/publish-mirror.mjs             # orphan-commit out/ (CNAME replaced) and force-push the mirror
 *   node scripts/publish-mirror.mjs --dry-run   # build the commit in a temp dir, don't push
 *   npm run ship -- --push --sol                # ship runs this after publish-sol (--no-mirror to skip)
 *
 * The mirror repo is a deploy target: one orphan commit on gh-pages, force-pushed every time.
 * Only the mirror is ever force-pushed (refuses this repo's own origin).
 * Env: MIRROR_REPO (default patelashit550-cpu/transition-insight-sol), MIRROR_CNAME
 * (default transition-insight.sol.site), OUT_DIR (default out).
 */
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { loadEnvFiles } from "./lib/load-env.mjs";
import { DEFAULT_MIRROR_CNAME, DEFAULT_MIRROR_REPO, MIRROR_BRANCH, validateMirrorTarget } from "./lib/mirror.mjs";
import { runSync } from "./lib/run-cmd.mjs";

loadEnvFiles();
const dryRun = process.argv.includes("--dry-run");
const tag = dryRun ? "publish-mirror [dry-run]" : "publish-mirror";
const log = (msg) => console.log(`${tag}: ${msg}`);
class MirrorError extends Error {}
function fail(msg) {
  throw new MirrorError(msg);
}
function git(gitArgs, cwd = process.cwd()) {
  const result = runSync("git", gitArgs, { cwd, encoding: "utf8", stdio: "pipe" });
  if (result.status !== 0) fail(`git ${gitArgs[0]}: ${(result.stderr || result.stdout || "").trim()}`);
  return (result.stdout ?? "").trim();
}
function gitOptional(gitArgs) {
  const result = runSync("git", gitArgs, { encoding: "utf8", stdio: "pipe" });
  return result.status === 0 ? (result.stdout ?? "").trim() : "";
}

function main() {
  const outDir = join(process.cwd(), process.env.OUT_DIR?.trim() || "out");
  const remote = process.env.MIRROR_REPO?.trim() || DEFAULT_MIRROR_REPO;
  const cname = process.env.MIRROR_CNAME?.trim() || DEFAULT_MIRROR_CNAME;

  const check = validateMirrorTarget({ remote, originUrl: gitOptional(["remote", "get-url", "origin"]), cname });
  if (!check.ok) fail(check.problems.join("; "));
  if (!existsSync(join(outDir, "index.html"))) fail(`${outDir}/index.html missing — build first`);

  const head = gitOptional(["rev-parse", "--short", "HEAD"]) || "unknown";
  const dirty = gitOptional(["status", "--porcelain", "--untracked-files=no"]) ? " (+ uncommitted changes)" : "";
  const name = gitOptional(["config", "user.name"]) || "transition-insight ship";
  const email = gitOptional(["config", "user.email"]) || "ship@transition-insight.invalid";

  const work = mkdtempSync(join(tmpdir(), "ti-mirror-"));
  try {
    // out/ never contains VCS metadata; skip it defensively so the commit is exactly the export.
    cpSync(outDir, work, { recursive: true, filter: (src) => basename(src) !== ".git" });
    writeFileSync(join(work, "CNAME"), `${cname}\n`);
    writeFileSync(join(work, ".nojekyll"), "");
    const files = readdirSync(work, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).length;
    const id = ["-c", `user.name=${name}`, "-c", `user.email=${email}`];
    git(["init", "-q", "-b", MIRROR_BRANCH], work);
    git(["add", "-A"], work);
    git([...id, "commit", "-q", "-m", `Mirror of transition-insight ${head}${dirty} for ${cname}`], work);
    log(`orphan commit ${git(["rev-parse", "--short", "HEAD"], work)}: ${files} files, CNAME ${cname}`);
    if (dryRun) {
      log(`would force-push ${MIRROR_BRANCH} to ${check.target}`);
    } else {
      git(["push", "--force", remote, `HEAD:refs/heads/${MIRROR_BRANCH}`], work);
      log(`force-pushed ${MIRROR_BRANCH} to ${check.target} — Pages rebuilds https://${cname}/ in ~1 min`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(`${tag}: FAILED — ${error instanceof MirrorError ? error.message : String(error)}`);
  process.exit(1);
}
