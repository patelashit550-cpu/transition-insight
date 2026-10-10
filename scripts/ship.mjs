#!/usr/bin/env node
/**
 * Minimal deploy — run locally without Cursor.
 *
 *   npm run ship
 *   npm run ship -- --push
 *   npm run ship -- --push -m "Publish Praxis."
 *   npm run ship -- --ipfs          (Pinata upload after build; needs PINATA_JWT in .env.local)
 *   npm run ship -- --ipfs-local    (local Kubo add; needs `ipfs daemon` running)
 *   npm run ship -- --sol           (pin to Pinata, verify on a root-serving gateway, point
 *                                    transition-insight.sol's IPFS record at the new CID; see publish-sol.mjs)
 *   npm run ship -- --sol-dry-run   (same pipeline, no upload and no on-chain write)
 *   npm run ship -- --sol --no-mirror   (skip the sol.site mirror; --sol mirrors by default)
 *   npm run ship -- --mirror        (force-push out/ to the GitHub Pages mirror that serves
 *                                    transition-insight.sol.site; see publish-mirror.mjs)
 *   npm run ship -- --push --ipfs
 *   npm run ship -- --skip-canon    (bypass Canonical freshness gate)
 *   npm run ship -- --skip-check    (bypass typecheck / lint / test gate)
 *
 * GitHub Actions on push to main deploys the live Pages origin (ashitmilne.xyz).
 * `--ipfs` pins the same export for the SNS destination (transition-insight.sol.site).
 *
 * First: markdown delta report (`npm run delta`) — every changed .md / .mdx and its
 * effect on the public site; all of them are committed on --push except SHIP_EXCLUDE.
 * Then: `npm run check` (typecheck, lint, unit tests) — same gate as CI.
 *
 * Before build: canon:check — fails if published essays changed since last
 * `npm run canon:generate` (so you don't ship without refreshing Canonical).
 */
import { loadEnvFiles } from "./lib/load-env.mjs";
import { formatDelta, listMarkdownDelta, SHIP_EXCLUDE, shippablePaths } from "./lib/md-delta.mjs";
import { runSync } from "./lib/run-cmd.mjs";

const args = process.argv.slice(2);
const push = args.includes("--push");
const ipfsLocal = args.includes("--ipfs-local");
const ipfs = args.includes("--ipfs") && !ipfsLocal;
const solDryRun = args.includes("--sol-dry-run");
const sol = args.includes("--sol") || solDryRun;
// Mirror (transition-insight.sol.site): on by default with --sol, opt in with --mirror, opt out with --no-mirror.
const mirror = !args.includes("--no-mirror") && (args.includes("--mirror") || sol);
const skipCanon = args.includes("--skip-canon");
const skipCheck = args.includes("--skip-check");
const messageIdx = args.indexOf("-m");
const message =
  messageIdx >= 0 && args[messageIdx + 1]
    ? args[messageIdx + 1]
    : `ship ${new Date().toISOString().slice(0, 10)}`;

function run(label, command, cmdArgs = [], opts = {}) {
  const result = runSync(command, cmdArgs, {
    stdio: opts.inherit === false ? "pipe" : "inherit",
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

const delta = listMarkdownDelta();
console.log(formatDelta(delta));
if (delta.some((e) => e.error)) {
  console.error("ship: failed at markdown delta — fix the frontmatter above");
  process.exit(1);
}

if (!skipCheck) {
  run("check", "npm", ["run", "check"]);
} else {
  console.warn("ship: skipping typecheck / lint / test (--skip-check)");
}

function canonCheckOk() {
  const result = runSync("npm", ["run", "canon:check"], {
    stdio: "pipe",
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
  const sign = runSync("npm", ["run", "content:sign"], { stdio: "inherit" });
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

// The export is root-absolute (Next default). Every IPFS target we use serves the CID at the
// root of a host (Brave → <cid>.ipfs.inbrowser.link, sol.site, Pinata gateway root), so the
// same out/ works for GitHub Pages and IPFS without rewriting paths.
if (ipfs || ipfsLocal) {
  if (ipfsLocal) {
    run("kubo:upload", "npm", ["run", "kubo:upload"]);
    console.log("ship: local Kubo add complete — update NEXT_PUBLIC_IPFS_CID if CID changed, then ship again.");
  } else {
    run("pinata:upload", "npm", ["run", "pinata:upload"]);
    console.log("ship: Pinata pin complete — update NEXT_PUBLIC_IPFS_CID if CID changed, then ship again.");
  }
}

/**
 * After the Pages ship: pin the same out/ and point transition-insight.sol at it, then
 * mirror out/ to the GitHub Pages repo behind transition-insight.sol.site.
 */
function publishSol() {
  if (sol) {
    const solArgs = ["scripts/publish-sol.mjs", "--skip-build"];
    if (solDryRun) solArgs.push("--dry-run");
    run("publish-sol", "node", solArgs);
  }
  if (mirror) {
    const mirrorArgs = ["scripts/publish-mirror.mjs"];
    if (solDryRun) mirrorArgs.push("--dry-run");
    run("publish-mirror", "node", mirrorArgs);
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
    "scripts/publish-mirror.mjs",
    "scripts/lib/mirror.mjs",
    "scripts/lib/mirror.test.mjs",
    "scripts/sync-export-attestation.mjs",
    "scripts/lib/content-provenance.mjs",
    "scripts/lib/run-cmd.mjs",
    "scripts/lib/md-delta.mjs",
    "scripts/lib/md-delta.test.mjs",
    "scripts/content-delta.mjs",
    ".github/workflows/deploy-pages.yml",
    "scripts/generate-corpus-graph.mjs",
    "scripts/generate-canon.mjs",
    "scripts/check-canon-stale.mjs",
    "scripts/data/canon-generated.json",
  ];
  run("git add", "git", ["add", "-A", "--", ...paths], { inherit: false });
  const mdPaths = shippablePaths(listMarkdownDelta());
  if (mdPaths.length) {
    run("git add markdown delta", "git", ["add", "-A", "--", ...mdPaths], { inherit: false });
  }
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
    publishSol();
    process.exit(0);
  }
  run("git commit", "git", ["commit", "-m", message], { inherit: false });
  run("git push", "git", ["push", "origin", "main"]);
  console.log("ship: pushed — GitHub Pages deploy in ~2–3 min");
  publishSol();
} else {
  console.log("ship: build ok — commit and push when ready (npm run ship -- --push -m \"…\")");
  publishSol();
}
