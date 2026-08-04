#!/usr/bin/env node
/**
 * Pin the static export to a local Kubo node (zero-trust path).
 *
 * Prerequisite: `ipfs daemon` running in another terminal.
 *
 *   npm run kubo:upload
 *   IPNS_KEY_NAME=self npm run kubo:upload   # also publish IPNS
 */
import { existsSync } from "node:fs";
import { join } from "node:path";

import {
  addDirectory,
  gatewayBase,
  publishIpns,
  writeDeployRecord,
} from "./lib/kubo.mjs";

const outDir = process.env.OUT_DIR?.trim() || "out";
// Only publish IPNS when asked — IPNS_KEY_NAME alone may be a leftover Pinata/cloud key name.
const publish = process.argv.includes("--ipns");
const ipnsKey = process.env.IPNS_KEY_NAME?.trim() || "self";

if (!existsSync(join(process.cwd(), outDir))) {
  console.error(`Missing ${outDir}/ — run: npm run build:global`);
  process.exit(1);
}

try {
  console.log(`kubo: adding ${outDir}/ to local node (${gatewayBase()}) …`);
  const upload = addDirectory(outDir);

  let ipns = null;
  if (publish) {
    console.log(`kubo: publishing IPNS (key=${ipnsKey}) …`);
    ipns = publishIpns(upload.cid, ipnsKey);
  }

  const record = {
    deployedAt: new Date().toISOString(),
    backend: "kubo-local",
    ...upload,
    ipns,
  };
  const recordPath = writeDeployRecord(record);

  console.log("");
  console.log("Local sovereign deploy — your node holds the bits:");
  console.log(`  CID:         ${upload.cid}`);
  console.log(`  Local GW:    ${upload.localUrl}`);
  console.log(`  Configured:  ${upload.directoryUrl}`);
  console.log(`  dweb.link:   ${upload.dwebUrl}`);
  if (ipns) {
    console.log(`  IPNS:        ${ipns.ipnsUrl}`);
    console.log(`  dweb IPNS:   ${ipns.dwebIpnsUrl}`);
  }
  console.log("");
  console.log(`Record: ${recordPath.replace(/\\/g, "/")}`);
  console.log("");
  console.log("Bake into .env.local, then rebuild:");
  console.log(`  NEXT_PUBLIC_IPFS_CID=${upload.cid}`);
  console.log(`  NEXT_PUBLIC_IPFS_GATEWAY=${upload.gateway}`);
  if (ipns) {
    console.log(`  NEXT_PUBLIC_IPNS_NAME=${ipns.name}`);
  }
  console.log("");
  console.log("Keep the daemon up for others to fetch from you:");
  console.log("  ipfs daemon");
  console.log("Optional public mirror later (Pinata still works):");
  console.log("  npm run pinata:upload");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
