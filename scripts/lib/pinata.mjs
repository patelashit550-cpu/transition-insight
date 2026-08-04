import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadEnvFiles } from "./load-env.mjs";
import { walkFiles } from "./walk-files.mjs";

loadEnvFiles();

function requireJwt() {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    throw new Error(
      "PINATA_JWT is missing. Add it to .env.local (from pinata.cloud → API Keys → New Key).",
    );
  }
  return jwt;
}

function gatewayBase() {
  const raw = process.env.PINATA_GATEWAY?.trim() || "https://gateway.pinata.cloud";
  return raw.replace(/\/$/, "");
}

/**
 * Upload a directory to Pinata with wrapWithDirectory.
 * @param {string} dir absolute or cwd-relative directory path
 */
export async function uploadDirectory(dir) {
  const jwt = requireJwt();
  const absoluteDir = join(process.cwd(), dir);
  const files = walkFiles(absoluteDir);
  if (files.length === 0) {
    throw new Error(`No files in ${dir} — run npm run build:global first.`);
  }

  const rootName = process.env.PINATA_DIR_ROOT?.trim() || dir.replace(/\\/g, "/").replace(/\/$/, "").split("/").pop() || "out";

  const form = new FormData();
  for (const file of files) {
    const body = readFileSync(file.absolutePath);
    const blob = new Blob([body]);
    form.append("file", blob, `${rootName}/${file.relativePath}`);
  }

  form.append(
    "pinataOptions",
    JSON.stringify({
      // rootName/ paths + metadata.name = rootName → CID is site root (not CID/out/)
      wrapWithDirectory: false,
      cidVersion: 1,
    }),
  );
  form.append(
    "pinataMetadata",
    JSON.stringify({
      name: rootName,
      keyvalues: {
        project: "transition-insight",
        tier: process.env.NEXT_PUBLIC_CONTENT_TIER?.trim() || "global",
      },
    }),
  );

  const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Pinata upload failed (${response.status}): ${payload.error ?? JSON.stringify(payload)}`,
    );
  }

  const cid = payload.IpfsHash;
  if (!cid) {
    throw new Error(`Pinata response missing IpfsHash: ${JSON.stringify(payload)}`);
  }

  const gateway = gatewayBase();
  const directoryUrl = `${gateway}/ipfs/${cid}/`;
  const dwebUrl = `https://dweb.link/ipfs/${cid}/`;

  return {
    cid,
    pinSize: payload.PinSize ?? null,
    timestamp: payload.Timestamp ?? new Date().toISOString(),
    gateway,
    directoryUrl,
    dwebUrl,
    fileCount: files.length,
  };
}

/**
 * Publish CID to a managed Pinata IPNS name (optional).
 * @param {string} cid
 */
export async function publishIpns(cid) {
  const jwt = requireJwt();
  const name = process.env.PINATA_IPNS_NAME?.trim();
  if (!name) {
    return null;
  }

  const response = await fetch("https://api.pinata.cloud/pinning/publishIpns", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cid, name }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Pinata IPNS publish failed (${response.status}): ${payload.error ?? JSON.stringify(payload)}`,
    );
  }

  const gateway = gatewayBase();
  return {
    name,
    cid,
    ipnsUrl: `${gateway}/ipns/${name}/`,
    dwebIpnsUrl: `https://dweb.link/ipns/${name}/`,
    payload,
  };
}

/** @param {Record<string, unknown>} record */
export function writeDeployRecord(record) {
  const dir = join(process.cwd(), ".sovereign");
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, "last-pin.json");
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return outPath;
}
