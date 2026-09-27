/**
 * Validate public/attestation.json against the current ontology corpus.
 * Used by CI and ship --push so unsigned/stale manifests cannot reach Pages.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import bs58 from "bs58";
import nacl from "tweetnacl";

import {
  attestationSignPayload,
  computeAttestedManifest,
  getSovereignEnv,
} from "./content-provenance.mjs";

/**
 * @param {{ root?: string, requireSignature?: boolean }} [opts]
 * @returns {Promise<{ ok: true, attestation: object } | { ok: false, errors: string[] }>}
 */
export async function verifyCommittedAttestation(opts = {}) {
  const root = opts.root ?? process.cwd();
  const requireSignature = opts.requireSignature !== false;
  const errors = [];
  const attestationPath = join(root, "public", "attestation.json");

  if (!existsSync(attestationPath)) {
    return { ok: false, errors: ["public/attestation.json missing"] };
  }

  let attestation;
  try {
    attestation = JSON.parse(readFileSync(attestationPath, "utf8"));
  } catch (error) {
    return {
      ok: false,
      errors: [
        `public/attestation.json is not valid JSON (${error instanceof Error ? error.message : error})`,
      ],
    };
  }

  if (!attestation.signature?.publicKey || !attestation.signature?.value) {
    if (requireSignature) {
      errors.push(
        "public/attestation.json is unsigned — run npm run content:sign locally, commit, then push",
      );
    }
  } else {
    const corpus = getSovereignEnv().solana;
    if (corpus && attestation.signature.publicKey !== corpus) {
      errors.push(
        `signer ${attestation.signature.publicKey} is not corpus wallet ${corpus}`,
      );
    }
    try {
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
        errors.push(
          "attestation signature verification failed — re-sign (npm run content:sign)",
        );
      }
    } catch (error) {
      errors.push(
        `attestation signature could not be verified (${error instanceof Error ? error.message : error})`,
      );
    }
  }

  try {
    const current = await computeAttestedManifest(attestation.tier);
    if (current.manifestDigest !== attestation.manifestDigest) {
      errors.push(
        `manifest stale (committed ${String(attestation.manifestDigest).slice(0, 24)}…, current ${current.manifestDigest.slice(0, 24)}…) — run npm run ship locally to re-attest and sign`,
      );
    }
  } catch (error) {
    errors.push(
      `could not recompute manifest digest (${error instanceof Error ? error.message : error})`,
    );
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, attestation };
}
