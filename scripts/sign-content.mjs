import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { Keypair } from "@solana/web3.js";

import {
  attestationSignPayload,
  getSovereignEnv,
} from "./lib/content-provenance.mjs";

const attestationPath = join(process.cwd(), "public", "attestation.json");
const verifyMode = process.argv.includes("--verify");

function loadKeypair() {
  const secret = process.env.SOLANA_SIGNING_KEY?.trim();
  if (!secret) {
    throw new Error("Set SOLANA_SIGNING_KEY (base58 secret key) to sign attestation.json");
  }
  const bytes = bs58.decode(secret);
  return Keypair.fromSecretKey(bytes);
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

  const expected = getSovereignEnv().solana;
  if (expected && signature.publicKey !== expected) {
    console.warn(
      `Warning: signer ${signature.publicKey} differs from NEXT_PUBLIC_SOLANA_WALLET_ADDRESS (${expected})`,
    );
  }

  console.log(`attestation signature valid (${signature.publicKey})`);
}

function signAttestation() {
  const attestation = JSON.parse(readFileSync(attestationPath, "utf8"));
  const keypair = loadKeypair();
  const payload = attestationSignPayload(
    attestation.manifestDigest,
    attestation.generated,
    attestation.tier,
  );
  const value = bs58.encode(nacl.sign.detached(payload, keypair.secretKey));

  attestation.signature = {
    algorithm: "ed25519",
    scheme: "transition-insight:attestation:v1",
    publicKey: keypair.publicKey.toBase58(),
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
