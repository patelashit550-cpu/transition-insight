import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import bs58 from "bs58";
import nacl from "tweetnacl";

import {
  attestationSignPayload,
  getSovereignEnv,
} from "./lib/content-provenance.mjs";
import { loadEnvFiles } from "./lib/load-env.mjs";
import { loadLocalSolanaWallet } from "../src/lib/solana-wallet.ts";

loadEnvFiles();

const CORPUS = "6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT";
const attestationPath = join(process.cwd(), "public", "attestation.json");
const verifyMode = process.argv.includes("--verify");

function expectedCorpusPubkey() {
  return getSovereignEnv().solana || CORPUS;
}

function assertCorpusSigner(publicKey) {
  const expected = expectedCorpusPubkey();
  if (publicKey !== expected) {
    throw new Error(
      `Signing key ${publicKey} is not the corpus wallet ${expected}. Use SOLANA_SIGNING_KEY or SOLANA_KEYPAIR_PATH for that address.`,
    );
  }
}

/**
 * Same laptop key sources as `solana-wallet` / `ship` — base58 secret or Solana CLI JSON.
 */
function loadKeypair() {
  return loadLocalSolanaWallet();
}

function verifySignature(attestation) {
  const { signature, manifestDigest, generated, tier } = attestation;
  if (!signature?.publicKey || !signature?.value) {
    console.error("No signature block in attestation.json");
    process.exit(1);
  }

  const payload = attestationSignPayload(manifestDigest, generated, tier);
  const publicKey = bs58.decode(signature.publicKey);
  const sig = bs58.decode(signature.value);
  const ok = nacl.sign.detached.verify(payload, sig, publicKey);

  if (!ok) {
    console.error("Signature verification failed");
    process.exit(1);
  }

  try {
    assertCorpusSigner(signature.publicKey);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  console.log(`attestation signature valid (${signature.publicKey})`);
}

function signAttestation() {
  const attestation = JSON.parse(readFileSync(attestationPath, "utf8"));
  const keypair = loadKeypair();
  const publicKey = keypair.publicKey.toBase58();
  assertCorpusSigner(publicKey);

  const payload = attestationSignPayload(
    attestation.manifestDigest,
    attestation.generated,
    attestation.tier,
  );
  const value = bs58.encode(nacl.sign.detached(payload, keypair.secretKey));

  attestation.signature = {
    algorithm: "ed25519",
    scheme: "transition-insight:attestation:v1",
    publicKey,
    value,
    signedAt: new Date().toISOString(),
  };
  attestation.summary.signedFiles = attestation.attested.length;

  writeFileSync(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`, "utf8");
  console.log(`signed attestation manifest (${attestation.manifestDigest.slice(0, 24)}…)`);
}

if (verifyMode) {
  verifySignature(JSON.parse(readFileSync(attestationPath, "utf8")));
} else {
  signAttestation();
}
