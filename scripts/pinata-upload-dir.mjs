#!/usr/bin/env node
import { existsSync } from "node:fs";
import { join } from "node:path";

import { publishIpns, uploadDirectory, writeDeployRecord } from "./lib/pinata.mjs";

const outDir = process.env.OUT_DIR?.trim() || "out";

if (!existsSync(join(process.cwd(), outDir))) {
  console.error(`Missing ${outDir}/ — run: npm run build:global`);
  process.exit(1);
}

try {
  console.log(`pinata: uploading ${outDir}/ …`);
  const upload = await uploadDirectory(outDir);
  let ipns = null;
  if (process.env.PINATA_IPNS_NAME?.trim()) {
    console.log(`pinata: publishing IPNS name "${process.env.PINATA_IPNS_NAME.trim()}" …`);
    ipns = await publishIpns(upload.cid);
  }

  const record = {
    deployedAt: new Date().toISOString(),
    ...upload,
    ipns,
  };
  const recordPath = writeDeployRecord(record);

  console.log("");
  console.log("Sovereign deploy — share these (no GitHub, no Cloudflare):");
  console.log(`  CID:       ${upload.cid}`);
  console.log(`  Gateway:   ${upload.directoryUrl}`);
  console.log(`  dweb.link: ${upload.dwebUrl}`);
  if (ipns) {
    console.log(`  IPNS:      ${ipns.ipnsUrl}`);
    console.log(`  dweb IPNS: ${ipns.dwebIpnsUrl}`);
  }
  console.log("");
  console.log(`Record: ${recordPath.replace(/\\/g, "/")}`);
  const siteHost =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/^https?:\/\//, "").replace(/\/$/, "") ||
    "ashitmilne.xyz";

  console.log("");
  console.log("Bake into .env.local, then rebuild:");
  console.log(`  NEXT_PUBLIC_IPFS_CID=${upload.cid}`);
  console.log(`  NEXT_PUBLIC_IPFS_GATEWAY=${upload.gateway}`);
  if (ipns) {
    console.log(`  NEXT_PUBLIC_IPNS_NAME=${ipns.name}`);
  }
  console.log("");
  console.log("Domain (no Cloudflare origin — IPFS only):");
  console.log("  A) Pinata gateway custom domain (recommended):");
  console.log(`     Pinata → Gateways → Add Custom Domain → ${siteHost}`);
  console.log(`     Registrar: CNAME ${siteHost} → your *.mypinata.cloud host`);
  console.log("  B) DNSLink to IPNS (domain stays decoupled from any host IP):");
  console.log(`     TXT  _dnslink.${siteHost}  "dnslink=/ipns/${ipns?.name ?? "<IPNS-KEY>"}"`);
  console.log(`     Resolve: https://dweb.link/ipns/${ipns?.name ?? "<IPNS-KEY>"}/`);
  console.log("  C) DNSLink to CID (manual update each deploy):");
  console.log(`     TXT  _dnslink.${siteHost}  "dnslink=/ipfs/${upload.cid}"`);
  console.log("");
  console.log("Verify:");
  console.log(`  ${upload.directoryUrl}`);
  if (ipns) {
    console.log(`  ${ipns.ipnsUrl}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
