#!/usr/bin/env node
/**
 * Copy committed signed attestation + provenance into out/ for static export deploy.
 * CI uses this so Pages serves your locally signed manifest — no signing key in GitHub.
 *
 *   node scripts/sync-export-attestation.mjs
 *   node scripts/sync-export-attestation.mjs --strict --verify
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import bs58 from "bs58";
import nacl from "tweetnacl";

import {
  attestationSignPayload,
  computeAttestedManifest,
  getSovereignEnv,
} from "./lib/content-provenance.mjs";

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

const attestationPath = join(root, "public", "attestation.json");
if (!existsSync(attestationPath)) {
  console.error("sync-export-attestation: public/attestation.json missing");
  process.exit(1);
}

const attestation = JSON.parse(readFileSync(attestationPath, "utf8"));

if (!attestation.signature?.publicKey || !attestation.signature?.value) {
  const msg =
    "sync-export-attestation: public/attestation.json is unsigned — sign locally (npm run content:sign), commit, then push";
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
} else if (verify) {
  const corpus = getSovereignEnv().solana;
  if (corpus && attestation.signature.publicKey !== corpus) {
    console.error(
      `sync-export-attestation: signer ${attestation.signature.publicKey} is not corpus wallet ${corpus}`,
    );
    process.exit(1);
  }
  const payload = attestationSignPayload(
    attestation.manifestDigest,
    attestation.generated,
    attestation.tier,
  );
  const ok = nacl.sign.detached.verify(
    payload,
    bs58.decode(attestation.signature.value),
    bs58.decode(attestation.signature.publicKey),
  );
  if (!ok) {
    console.error(
      "sync-export-attestation: signature verification failed — re-sign (npm run content:sign)",
    );
    process.exit(1);
  }
}

const current = await computeAttestedManifest(attestation.tier);
if (current.manifestDigest !== attestation.manifestDigest) {
  console.error(
    `sync-export-attestation: manifest stale (committed ${attestation.manifestDigest.slice(0, 24)}…, current ${current.manifestDigest.slice(0, 24)}…) — run npm run ship locally to re-attest and sign`,
  );
  process.exit(1);
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
