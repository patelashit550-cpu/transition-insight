#!/usr/bin/env node
/**
 * Minimal deploy — run locally without Cursor.
 *
 *   npm run ship
 *   npm run ship -- --push
 *   npm run ship -- --push -m "Publish Praxis."
 *   npm run ship -- --ipfs          (Pinata upload after build; needs PINATA_JWT in .env.local)
 *   npm run ship -- --ipfs-local    (local Kubo add; needs `ipfs daemon` running)
 *   npm run ship -- --push --ipfs
 *   npm run ship -- --skip-canon    (bypass Canonical freshness gate)
 *
 * GitHub Actions on push to main may still deploy an optional Pages mirror.
 * The public origin is IPFS at transition-insight.sol.site (`--ipfs`).
 *
 * Before build: canon:check — fails if published essays changed since last
 * `npm run canon:generate` (so you don't ship without refreshing Canonical).
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const push = args.includes("--push");
const ipfsLocal = args.includes("--ipfs-local");
const ipfs = args.includes("--ipfs") && !ipfsLocal;
const skipCanon = args.includes("--skip-canon");
const messageIdx = args.indexOf("-m");
const message =
  messageIdx >= 0 && args[messageIdx + 1]
    ? args[messageIdx + 1]
    : `ship ${new Date().toISOString().slice(0, 10)}`;

function run(label, command, cmdArgs = [], opts = {}) {
  const useShell = process.platform === "win32";
  // Windows shell mode strips arg quoting; re-quote args with spaces so e.g. -m "a b" survives.
  const safeArgs = useShell
    ? cmdArgs.map((a) => (/\s/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a))
    : cmdArgs;
  const result = spawnSync(command, safeArgs, {
    stdio: opts.inherit === false ? "pipe" : "inherit",
    shell: useShell,
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    if (opts.inherit === false) {
      if (result.stdout?.trim()) console.error(result.stdout.trim());
      if (result.stderr?.trim()) console.error(result.stderr.trim());
    }
    console.error(`ship: failed at ${label}`);
    process.exit(result.status ?? 1);
  }
  return result;
}

if (!skipCanon) {
  run("canon:check", "npm", ["run", "canon:check"]);
} else {
  console.warn("ship: skipping canon:check (--skip-canon)");
}

run("content:attest", "npm", ["run", "content:attest"]);
run("build:global", "npm", ["run", "build:global"]);
run("audit:perimeter:export", "node", ["scripts/audit-perimeter.mjs", "--export"]);

if (ipfs || ipfsLocal) {
  run("ipfs-relative-export", "node", ["scripts/ipfs-relative-export.mjs"]);
  if (ipfsLocal) {
    run("kubo:upload", "npm", ["run", "kubo:upload"]);
    console.log("ship: local Kubo add complete — update NEXT_PUBLIC_IPFS_CID if CID changed, then ship again.");
  } else {
    run("pinata:upload", "npm", ["run", "pinata:upload"]);
    console.log("ship: Pinata pin complete — update NEXT_PUBLIC_IPFS_CID if CID changed, then ship again.");
  }
}

if (push) {
  const paths = [
    "ontology",
    "public/attestation.json",
    "public/.well-known",
    "public/sitemap.xml",
    "public/robots.txt",
    "public/openapi.json",
    "public/assets",
    "public/visuals",
    "assets",
    "src",
    "package.json",
    "package-lock.json",
    "scripts/ship.mjs",
    "scripts/generate-corpus-graph.mjs",
    "scripts/generate-canon.mjs",
    "scripts/check-canon-stale.mjs",
    "scripts/data/canon-generated.json",
  ];
  run("git add", "git", ["add", "-A", "--", ...paths], { inherit: false });
  const status = run("git status", "git", ["status", "--porcelain"], { inherit: false });
  if (!status.stdout?.trim()) {
    console.log("ship: nothing to commit");
    process.exit(0);
  }
  run("git commit", "git", ["commit", "-m", message], { inherit: false });
  run("git push", "git", ["push", "origin", "main"]);
  console.log("ship: pushed — GitHub Pages deploy in ~2–3 min");
} else {
  console.log("ship: build ok — commit and push when ready (npm run ship -- --push -m \"…\")");
}
