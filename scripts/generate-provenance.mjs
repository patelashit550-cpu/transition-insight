import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getContentBuildTier, getSovereignEnv } from "./lib/content-provenance.mjs";
import { loadEnvFiles } from "./lib/load-env.mjs";

loadEnvFiles();

const root = process.cwd();
const attestationPath = join(root, "public", "attestation.json");
const outPath = join(root, "public", ".well-known", "provenance.json");

const identity = getSovereignEnv();
const tier = getContentBuildTier();
const ipfsCid =
  process.env.NEXT_PUBLIC_IPFS_CID?.trim() || process.env.IPFS_CID?.trim() || null;
const ipfsGateway = (
  process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim() || "https://gateway.pinata.cloud"
).replace(/\/$/, "");
const ipnsName = process.env.NEXT_PUBLIC_IPNS_NAME?.trim() || null;
const ipfsDirectoryUrl = ipfsCid ? `${ipfsGateway}/ipfs/${ipfsCid}/` : null;
const ipnsUrl = ipnsName ? `${ipfsGateway}/ipns/${ipnsName}/` : null;

let attestation = null;
try {
  attestation = JSON.parse(readFileSync(attestationPath, "utf8"));
} catch {
  /* generate-attestation may not have run yet */
}

const provenance = {
  version: "1",
  generated: new Date().toISOString(),
  canonical: identity.canonical,
  aliases: [
    ipfsDirectoryUrl ? { type: "ipfs", cid: ipfsCid, url: ipfsDirectoryUrl } : null,
    ipnsUrl ? { type: "ipns", name: ipnsName, url: ipnsUrl } : null,
    identity.sns ? { type: "sns", name: identity.sns } : null,
    identity.solSite ? { type: "sol.site", url: identity.solSite } : null,
    identity.ens ? { type: "ens", name: identity.ens } : null,
  ].filter(Boolean),
  ipfs: {
    cid: ipfsCid,
    gateway: ipfsGateway,
    directory: ipfsDirectoryUrl,
    ipns: ipnsName,
    ipnsUrl,
  },
  identity: {
    did: identity.did,
    solana: identity.solana,
    validator: process.env.NEXT_PUBLIC_VALIDATOR_NAME?.trim() || null,
    validatorVoteAccount: process.env.NEXT_PUBLIC_VALIDATOR_VOTE_ACCOUNT?.trim() || null,
  },
  documents: {
    attestation: `${identity.canonical}/attestation.json`,
    auth: `${identity.canonical}/auth.md`,
    security: `${identity.canonical}/.well-known/security.txt`,
    apiCatalog: `${identity.canonical}/.well-known/api-catalog`,
    agentSkills: `${identity.canonical}/.well-known/agent-skills/index.json`,
  },
  pool: {
    description:
      "Published ontology corpus attestation for milling, noding, and transaction-pool agents.",
    tier,
    manifest: `${identity.canonical}/attestation.json`,
    manifestDigest: attestation?.manifestDigest ?? null,
    signature: attestation?.signature ?? null,
    entryCount: attestation?.attested?.length ?? null,
  },
  solSite: {
    domain: identity.solSite,
    status: ipfsDirectoryUrl ? "point-at-ipfs-gateway" : "pending-dns",
    note: ipfsDirectoryUrl
      ? "In SNS → Sol.site, CNAME to your Pinata dedicated gateway (or DNSLink host). " +
        "Canonical static export: provenance ipfs.directory."
      : "Pin with npm run deploy:sovereign, then set NEXT_PUBLIC_IPFS_CID for the next build.",
  },
};

writeFileSync(outPath, `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
console.log(`provenance: ${outPath.replace(/\\/g, "/")}`);
