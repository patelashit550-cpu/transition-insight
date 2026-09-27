#!/usr/bin/env node
/**
 * Copy committed signed attestation + provenance into out/ for static export deploy.
 * CI uses this so Pages serves your locally signed manifest — no signing key in GitHub.
 *
 *   node scripts/sync-export-attestation.mjs
 *   node scripts/sync-export-attestation.mjs --strict --verify
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { verifyCommittedAttestation } from "./lib/verify-committed-attestation.mjs";

const root = process.cwd();
const strict = process.argv.includes("--strict");
const verify = process.argv.includes("--verify");
const outDir = join(root, "out");

const pairs = [
  ["public/attestation.json", "out/attestation.json"],
  ["public/.well-known/provenance.json", "out/.well-known/provenance.json"],
];

if (!existsSync(outDir)) {
  console.error("sync-export-attestation: out/ missing — run npm run build:global first");
  process.exit(1);
}

const requireSignature = strict || verify;
const checked = await verifyCommittedAttestation({ root, requireSignature });

if (!checked.ok) {
  for (const message of checked.errors) {
    console.error(`sync-export-attestation: ${message}`);
  }
  process.exit(1);
}

if (!requireSignature && !checked.attestation.signature?.value) {
  console.warn(
    "sync-export-attestation: public/attestation.json is unsigned — sign locally (npm run content:sign), commit, then push",
  );
}

for (const [src, dest] of pairs) {
  const srcPath = join(root, src);
  const destPath = join(root, dest);
  if (!existsSync(srcPath)) {
    console.error(`sync-export-attestation: missing ${src}`);
    process.exit(1);
  }
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(srcPath, destPath);
}

console.log("sync-export-attestation: copied signed attestation + provenance into out/");
