#!/usr/bin/env node
/**
 * Fail if public/attestation.json is unsigned, wrongly signed, or stale.
 *
 *   node scripts/verify-committed-attestation.mjs
 */
import { verifyCommittedAttestation } from "./lib/verify-committed-attestation.mjs";

const result = await verifyCommittedAttestation({ requireSignature: true });
if (!result.ok) {
  for (const message of result.errors) {
    console.error(`verify-committed-attestation: ${message}`);
  }
  process.exit(1);
}

console.log(
  `verify-committed-attestation: ok (${result.attestation.signature.publicKey}, ${String(result.attestation.manifestDigest).slice(0, 24)}…)`,
);
