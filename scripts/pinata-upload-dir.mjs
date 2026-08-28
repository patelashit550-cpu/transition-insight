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
  console.log("Live origin is GitHub Pages (ashitmilne.xyz). Pin this CID for sol.site later.");
  console.log("gateway.pinata.cloud refuses HTML — use a dedicated Pinata gateway or Cloudflare DNSLink.");
  console.log("");
  console.log("Bake into .env.local, then rebuild once:");
  console.log(`  NEXT_PUBLIC_IPFS_CID=${upload.cid}`);
  console.log(`  NEXT_PUBLIC_IPFS_GATEWAY=${upload.gateway}`);
  if (ipns) {
    console.log(`  NEXT_PUBLIC_IPNS_NAME=${ipns.name}`);
  }
  console.log("");
  console.log("sns.id (registrant key, laptop only):");
  console.log(`  On-chain IPFS record = ${upload.cid}  (CID only; do not set URL to ashitmilne.xyz)`);
  console.log("  On-chain SOL record  = NEXT_PUBLIC_SOLANA_WALLET_ADDRESS");
  console.log("  Configure Sol.site: CNAME → cloudflare-ipfs.com");
  console.log(`                     TXT _dnslink → dnslink=/ipfs/${upload.cid}`);
  console.log("");
  console.log("Optional Pinata dedicated gateway custom domain:");
  console.log(`  Add ${siteHost} then CNAME that host to your *.mypinata.cloud gateway.`);
  console.log("");
  console.log("Verify:");
  console.log(`  ${upload.directoryUrl}`);
  console.log("  https://transition-insight.sol.site/");
  if (ipns) {
    console.log(`  ${ipns.ipnsUrl}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
