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

  console.log("");
  console.log("Live origin is GitHub Pages (ashitmilne.xyz). To point transition-insight.sol at this CID");
  console.log("(build → pin → gateway check → on-chain IPFS record → unpin old), use: npm run publish:sol");
  console.log("*.mypinata.cloud gateways refuse HTML without a custom domain — view the site at the dweb.link URL above.");
  console.log("");
  console.log("Bake into .env.local, then rebuild once (optional):");
  console.log(`  NEXT_PUBLIC_IPFS_CID=${upload.cid}`);
  console.log(`  NEXT_PUBLIC_IPFS_GATEWAY=${upload.gateway}`);
  if (ipns) {
    console.log(`  NEXT_PUBLIC_IPNS_NAME=${ipns.name}`);
  }
  console.log("");
  console.log("sns.id (owner wallet) — record formats:");
  console.log(`  IPFS record = ipfs://${upload.cid}   (Brave only resolves the ipfs:// form; a bare CID resolves nothing)`);
  console.log("  url record  = empty                 (Brave checks url before IPFS)");
  console.log("  Sol.site    = DNS only: CNAME to a host that serves the CID at its root AND issues TLS for");
  console.log("                transition-insight.sol.site (cloudflare-ipfs.com was shut down in 2024 — do not use it).");
  console.log("");
  console.log("Verify:");
  console.log(`  ${upload.dwebUrl}`);
  console.log(`  https://${upload.cid}.ipfs.inbrowser.link/   (where Brave sends transition-insight.sol)`);
  if (ipns) {
    console.log(`  ${ipns.ipnsUrl}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
