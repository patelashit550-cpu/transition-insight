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
 * GitHub Actions on push to main deploys the live Pages origin (ashitmilne.xyz).
 * `--ipfs` pins the same export for the SNS destination (transition-insight.sol.site).
 *
 * Before build: canon:check — fails if published essays changed since last
 * `npm run canon:generate` (so you don't ship without refreshing Canonical).
 */
import { spawnSync } from "node:child_process";

import { loadEnvFiles } from "./lib/load-env.mjs";

/** Never committed by `ship --push` (local drafts, review-tier glossary, etc.). */
const SHIP_EXCLUDE = ["ontology/governance/Canonical-Review.md"];

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
  // npm needs shell on Windows (npm.cmd); git/node are safe with shell:false (avoids DEP0190 + arg mangling).
  const useShell =
    opts.shell ?? (process.platform === "win32" && (command === "npm" || command.endsWith(".cmd")));
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

if (push) {
  const branchResult = run("git branch", "git", ["branch", "--show-current"], {
    inherit: false,
  });
  const branch = branchResult.stdout?.trim();
  if (branch !== "main") {
    console.error(
      `ship: refusing --push from ${branch || "detached HEAD"}; open a pull request or switch to main`,
    );
    process.exit(1);
  }
}

function canonCheckOk() {
  const result = spawnSync("npm", ["run", "canon:check"], {
    stdio: "pipe",
    shell: process.platform === "win32",
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.status !== 0 && result.stderr?.trim()) console.error(result.stderr.trim());
  return result.status === 0;
}

if (!skipCanon) {
  if (!canonCheckOk()) {
    console.log("ship: refreshing canon stamp (new published essay)…");
    run("canon:generate", "npm", ["run", "canon:generate"]);
    if (!canonCheckOk()) {
      console.error("ship: failed at canon:check");
      process.exit(1);
    }
  }
} else {
  console.warn("ship: skipping canon:check (--skip-canon)");
}

run("content:attest", "npm", ["run", "content:attest"]);
run("build:global", "npm", ["run", "build:global"]);

loadEnvFiles();
let signedOk = false;
if (process.env.SOLANA_SIGNING_KEY?.trim() || process.env.SOLANA_KEYPAIR_PATH?.trim()) {
  const sign = spawnSync("npm", ["run", "content:sign"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    cwd: process.cwd(),
  });
  if (sign.status === 0) {
    run("provenance", "node", ["scripts/generate-provenance.mjs"]);
    signedOk = true;
  } else {
    console.warn("ship: content:sign failed — pushing unsigned attestation.json");
  }
}

const syncArgs = ["scripts/sync-export-attestation.mjs"];
if (push || signedOk) {
  syncArgs.push("--strict", "--verify");
}
if (syncArgs.length > 1) {
  run("sync-export-attestation", "node", syncArgs);
}

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
    "public/ontology",
    "public/ontology.jsonld",
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
    "scripts/sync-export-attestation.mjs",
    "scripts/lib/content-provenance.mjs",
    ".github/workflows/deploy-pages.yml",
    "scripts/generate-corpus-graph.mjs",
    "scripts/generate-canon.mjs",
    "scripts/check-canon-stale.mjs",
    "scripts/data/canon-generated.json",
  ];
  run("git add", "git", ["add", "-A", "--", ...paths], { inherit: false });
  for (const rel of SHIP_EXCLUDE) {
    run("git unstage excluded", "git", ["restore", "--staged", "--", rel], { inherit: false });
  }
  const status = run("git status", "git", ["status", "--porcelain"], { inherit: false });
  const excluded = SHIP_EXCLUDE.filter((rel) => status.stdout?.includes(rel));
  if (excluded.length) {
    console.log(`ship: excluded from commit — ${excluded.join(", ")}`);
  }
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
