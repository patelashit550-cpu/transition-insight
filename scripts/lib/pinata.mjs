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
 * Human-readable Pinata error. Pinata returns `error` as a string on some endpoints and as
 * `{ reason, details }` on others (e.g. 403 NO_SCOPES_FOUND), which used to print "[object Object]".
 * @param {any} payload
 */
export function describePinataError(payload) {
  const error = payload?.error ?? payload;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const parts = [error.reason, error.details, error.message].filter((v) => typeof v === "string" && v);
    if (parts.length) return parts.join(" — ");
  }
  return JSON.stringify(error ?? {});
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
      `Pinata upload failed (${response.status}): ${describePinataError(payload)}`,
    );
  }

  const cid = payload.IpfsHash;
  if (!cid) {
    throw new Error(`Pinata response missing IpfsHash: ${JSON.stringify(payload)}`);
  }

  const gateway = gatewayBase();
  // Path-style (/ipfs/<cid>/) — fine for single files; *.mypinata.cloud refuses to serve HTML
  // without a custom domain (ERR_ID:00023), so view the site via a root-serving URL instead.
  const directoryUrl = `${gateway}/ipfs/${cid}/`;
  // Subdomain gateway: serves the CID at the host root, which is what the root-absolute export needs.
  const dwebUrl = subdomainGatewayUrl(cid);

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
      `Pinata IPNS publish failed (${response.status}): ${describePinataError(payload)}`,
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

/**
 * Root-serving (subdomain) gateway URL for a CIDv1. Subdomain gateways need the base32 CIDv1
 * (`bafy…`), which is what uploads with `cidVersion: 1` return.
 * @param {string} cid
 * @param {string} [host]
 */
export function subdomainGatewayUrl(cid, host = "dweb.link") {
  return `https://${cid}.ipfs.${host}/`;
}

/** Read-only: confirm the JWT is accepted (no upload). */
export async function testAuthentication() {
  const jwt = requireJwt();
  const response = await fetch("https://api.pinata.cloud/data/testAuthentication", {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  return { ok: response.ok, status: response.status };
}

/**
 * Read-only: list public files (newest first) via the V3 Files API. Folder uploads made with the
 * legacy pinFileToIPFS endpoint appear here as one entry (mime_type "directory"). Uses the V3 API
 * because scoped keys created in the current dashboard may lack the legacy pinList scope.
 * @returns {Promise<{ id: string, cid: string, name: string, datePinned: string, size: number, files: number, keyvalues: Record<string, string> }[]>}
 */
export async function listPins() {
  const jwt = requireJwt();
  const files = [];
  let token = "";
  do {
    const url = new URL("https://api.pinata.cloud/v3/files/public");
    url.searchParams.set("limit", "1000");
    if (token) url.searchParams.set("pageToken", token);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Pinata list files failed (${response.status}): ${JSON.stringify(payload.error ?? payload)}`);
    }
    files.push(...(payload.data?.files ?? []));
    token = payload.data?.next_page_token ?? "";
  } while (token && files.length < 5000);
  return files
    .map((file) => ({
      id: file.id,
      cid: file.cid,
      name: file.name ?? "",
      datePinned: file.created_at,
      size: file.size,
      files: file.number_of_files,
      keyvalues: file.keyvalues ?? {},
    }))
    .sort((a, b) => String(b.datePinned).localeCompare(String(a.datePinned)));
}

/**
 * Delete (unpin) one public file by its V3 file id. Irreversible for that pin; the content may
 * still exist elsewhere on IPFS. Needs a key with files write scope.
 * @param {string} id
 */
export async function unpin(id) {
  const jwt = requireJwt();
  const response = await fetch(`https://api.pinata.cloud/v3/files/public/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(`Pinata delete ${id} failed (${response.status}): ${JSON.stringify(payload.error ?? payload)}`);
  }
}

/** @param {Record<string, unknown>} record */
export function writeDeployRecord(record) {
  const dir = join(process.cwd(), ".sovereign");
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, "last-pin.json");
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return outPath;
}
