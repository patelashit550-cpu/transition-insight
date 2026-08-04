import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

import { loadEnvFiles } from "./load-env.mjs";

loadEnvFiles();

const require = createRequire(import.meta.url);

/**
 * Prefer real Kubo binary over the npm shim (Windows shim often points at
 * bin/ipfs without .exe after a partial install).
 */
function resolveIpfsBin() {
  if (process.env.IPFS_BIN?.trim()) return process.env.IPFS_BIN.trim();
  try {
    const kuboRoot = dirname(require.resolve("kubo/package.json"));
    const localExe = join(kuboRoot, "bin", process.platform === "win32" ? "ipfs.exe" : "ipfs");
    if (existsSync(localExe)) return localExe;
  } catch {
    // not a project dependency
  }
  const globalExe = join(
    process.env.APPDATA || "",
    "npm",
    "node_modules",
    "kubo",
    "bin",
    process.platform === "win32" ? "ipfs.exe" : "ipfs",
  );
  if (process.env.APPDATA && existsSync(globalExe)) return globalExe;
  return "ipfs";
}

const IPFS_BIN = resolveIpfsBin();

/**
 * Resolve Kubo API multiaddr / HTTP base.
 * Default: local daemon RPC (http://127.0.0.1:5001).
 */
export function apiBase() {
  const raw = process.env.IPFS_API?.trim() || "http://127.0.0.1:5001";
  return raw.replace(/\/$/, "");
}

/** Local gateway for verification (default Kubo gateway port). */
export function gatewayBase() {
  // Prefer explicit local gateway; do not inherit Pinata NEXT_PUBLIC_* for local adds.
  const raw = process.env.IPFS_GATEWAY?.trim() || "http://127.0.0.1:8080";
  return raw.replace(/\/$/, "");
}

function ipfsArgs(extra) {
  const api = process.env.IPFS_API?.trim();
  // CLI accepts HTTP URL via --api when set (otherwise uses ~/.ipfs/api).
  return api ? ["--api", api, ...extra] : extra;
}

/**
 * Run `ipfs` CLI. Throws on non-zero exit.
 * @param {string[]} args
 * @param {{ inherit?: boolean }} [opts]
 */
export function runIpfs(args, opts = {}) {
  const result = spawnSync(IPFS_BIN, ipfsArgs(args), {
    encoding: "utf8",
    shell: false,
    cwd: process.cwd(),
    stdio: opts.inherit ? "inherit" : "pipe",
  });
  if (result.error) {
    throw new Error(
      `ipfs CLI not found (${result.error.message}). Install: npm install -g --allow-scripts=kubo kubo`,
    );
  }
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim();
    throw new Error(err || `ipfs ${args.join(" ")} failed (${result.status})`);
  }
  return (result.stdout || "").trim();
}

/** Probe daemon: `ipfs id` must succeed. */
export function assertDaemon() {
  try {
    runIpfs(["id", "--format=<id>"]);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/not found|ENOENT/i.test(msg)) throw error;
    throw new Error(
      `Local IPFS daemon is not reachable (${apiBase()}).\n` +
        `  Start it in another terminal: ipfs daemon\n` +
        `  Original: ${msg}`,
    );
  }
}

/**
 * Add a directory recursively. Returns root CID (CIDv1).
 * Uses wrap=false so the folder contents ARE the root (same as Pinata path).
 * @param {string} dir cwd-relative directory (usually "out")
 */
export function addDirectory(dir) {
  assertDaemon();
  const absoluteDir = join(process.cwd(), dir);
  // -r recursive; --cid-version=1; --quieter = only final hash; no wrap → CID is dir root
  const out = runIpfs([
    "add",
    "-r",
    "--cid-version=1",
    "--quieter",
    absoluteDir,
  ]);
  const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const cid = lines[lines.length - 1];
  if (!cid) {
    throw new Error(`ipfs add returned no CID for ${dir}`);
  }
  const gateway = gatewayBase();
  return {
    cid,
    gateway,
    directoryUrl: `${gateway}/ipfs/${cid}/`,
    dwebUrl: `https://dweb.link/ipfs/${cid}/`,
    localUrl: `http://127.0.0.1:8080/ipfs/${cid}/`,
  };
}

/**
 * Publish CID under a local IPNS key (default: self).
 * @param {string} cid
 * @param {string} [keyName]
 */
export function publishIpns(cid, keyName) {
  const key = (keyName || process.env.IPNS_KEY_NAME?.trim() || "self").trim();
  const out = runIpfs(["name", "publish", `--key=${key}`, `/ipfs/${cid}`]);
  // Typical: "Published to k51...: /ipfs/bafy..."
  const match = out.match(/Published to\s+(\S+):/i);
  const name = match?.[1] || key;
  const gateway = gatewayBase();
  return {
    name,
    key,
    cid,
    ipnsUrl: `${gateway}/ipns/${name}/`,
    dwebIpnsUrl: `https://dweb.link/ipns/${name}/`,
    raw: out,
  };
}

/** @param {Record<string, unknown>} record */
export function writeDeployRecord(record) {
  const dir = join(process.cwd(), ".sovereign");
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, "last-pin-local.json");
  writeFileSync(outPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return outPath;
}
