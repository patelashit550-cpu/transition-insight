#!/usr/bin/env node
/**
 * Publish the static export to IPFS and point transition-insight.sol at it.
 *
 *   npm run publish:sol:dry               # everything except the Pinata upload and the on-chain write
 *   npm run publish:sol                   # build → pin → gateway check → SNS IPFS record → verify → unpin old
 *   npm run ship -- --push --sol          # after a ship (ship passes --skip-build)
 *
 * Flags:
 *   --dry-run        no upload, no transaction (simulated with sigVerify off), no unpin
 *   --skip-build     reuse out/ (ship already built it)
 *   --clear-url      also delete the SNS `url` record (Brave checks url before IPFS; one-time)
 *   --keep=N         Pinata pins to keep for this project (default 2; the live CID is always kept)
 *   --cid=<cid>      skip the upload and publish an already-pinned CID (resume / rollback);
 *                    also skips the public-gateway check (verify that CID in a browser first)
 *   --skip-gateway-check  don't wait for a public gateway to serve the new CID
 *   --gateway-timeout=<seconds>  how long to wait for a public gateway to serve the new CID (default 900)
 *
 * Public subdomain gateways (dweb.link, and w3s.link / nftstorage.link which redirect to it) now answer
 * non-browser clients with 429 "service worker gateway only". That is reported as a warning, not a failure:
 * check https://<cid>.ipfs.inbrowser.link/ in a browser (it is where Brave sends .sol).
 *
 * Env (.env.local): PINATA_JWT, SOLANA_SIGNING_KEY (base58, must be the name's owner),
 * optional NEXT_PUBLIC_SOLANA_RPC_URL, NEXT_PUBLIC_SNS_DOMAIN. Secrets are never printed.
 */
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";

import { loadEnvFiles } from "./lib/load-env.mjs";
import { listPins, subdomainGatewayUrl, testAuthentication, unpin, uploadDirectory } from "./lib/pinata.mjs";
import {
  buildRecordInstructions,
  cidFromRecordContent,
  extractRootAssets,
  ipfsRecordContent,
  isServiceWorkerOnlyResponse,
  readSnsState,
  selectPinsToRemove,
  waitForSignature,
} from "./lib/publish-sol.mjs";
import { runSync } from "./lib/run-cmd.mjs";

loadEnvFiles();

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);

const dryRun = flag("--dry-run");
const skipBuild = flag("--skip-build");
const clearUrl = flag("--clear-url");
const keep = Number(option("--keep") ?? 2);
const givenCid = option("--cid");
const skipGatewayCheck = flag("--skip-gateway-check") || Boolean(givenCid);
const gatewayTimeoutMs = Number(option("--gateway-timeout") ?? 900) * 1000;
const outDir = join(process.cwd(), process.env.OUT_DIR?.trim() || "out");
const name = (process.env.NEXT_PUBLIC_SNS_DOMAIN?.trim() || "transition-insight.sol").replace(/\.sol$/i, "");
const rpcUrl = process.env.SOLANA_RPC_URL?.trim() || process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || "https://solana-rpc.publicnode.com";
// inbrowser.link (where Brave sends .sol) is a service-worker gateway that plain fetch cannot verify;
// dweb.link serves the same CID at a subdomain root over plain HTTP.
const PUBLIC_GATEWAYS = ["dweb.link"];
const MIN_SOL = 0.003;

const tag = dryRun ? "publish-sol [dry-run]" : "publish-sol";
const log = (msg) => console.log(`${tag}: ${msg}`);
function fail(msg) {
  console.error(`${tag}: FAILED — ${msg}`);
  process.exit(1);
}

function loadSigner() {
  const secret = process.env.SOLANA_SIGNING_KEY?.trim();
  if (!secret) return null;
  const bytes = bs58.decode(secret);
  if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
  if (bytes.length === 32) return Keypair.fromSeed(bytes);
  throw new Error("SOLANA_SIGNING_KEY must decode to 32 or 64 bytes");
}

function ipfsBin() {
  for (const candidate of [process.env.IPFS_BIN?.trim(), "ipfs"].filter(Boolean)) {
    const probe = spawnSync(candidate, ["version"], { encoding: "utf8" });
    if (probe.status === 0) return candidate;
  }
  return null;
}

/** Same importer settings as Pinata's cidVersion 1 (raw leaves, 256 KiB chunks). Offline. */
function localCid(bin) {
  const result = spawnSync(
    bin,
    ["add", "-r", "-Q", "--only-hash", "--offline", "--cid-version=1", "--hidden", outDir],
    { encoding: "utf8" },
  );
  return result.status === 0 ? result.stdout.trim() : null;
}

function nestedPages(limit = 2) {
  const found = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir)) {
      if (found.length >= limit * 4) return;
      const abs = join(dir, entry);
      if (statSync(abs).isDirectory() && !entry.startsWith("_") && !entry.startsWith(".") && entry !== "404") {
        const relPath = `${rel}${entry}/`;
        if (existsSync(join(abs, "index.html")) && relPath.split("/").length > 3) found.push(`/${relPath}`);
        walk(abs, relPath);
      }
    }
  };
  walk(outDir, "");
  return found.slice(0, limit);
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".txt": "text/plain; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };

/** Dry run: serve out/ at the root of a local host, the way a subdomain gateway serves a CID. */
function startRootServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
      let file = join(outDir, path);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!file.startsWith(outDir) || !existsSync(file)) {
        res.writeHead(404);
        return res.end();
      }
      res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
      res.end(readFileSync(file));
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function fetchOk(url, timeoutMs = 30000) {
  const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
  const body = await response.text().catch(() => "");
  if (isServiceWorkerOnlyResponse(response.status, body)) {
    const error = new Error(`${new URL(url).host} only serves browsers now (429 service-worker gateway)`);
    error.serviceWorkerOnly = true;
    throw error;
  }
  return { ok: response.ok, status: response.status, body: response.ok ? body : "", type: response.headers.get("content-type") || "" };
}

/** Homepage + nested pages + their RSC tree payloads + every root-absolute asset they reference. */
async function verifySite(base) {
  const pages = ["/", ...nestedPages(2)];
  const problems = [];
  const assets = new Set();
  for (const page of pages) {
    const res = await fetchOk(base + page);
    if (!res.ok || !res.type.includes("html")) {
      problems.push(`${page} → ${res.status} ${res.type}`);
      continue;
    }
    if (/<script[^>]+src="\.\.?\//.test(res.body)) problems.push(`${page} has relative <script src> (breaks hydration)`);
    extractRootAssets(res.body).forEach((asset) => assets.add(asset));
    const tree = await fetchOk(`${base}${page}__next._tree.txt`);
    if (!tree.ok) problems.push(`${page}__next._tree.txt → ${tree.status}`);
  }
  for (const asset of assets) {
    const res = await fetchOk(base + asset);
    if (!res.ok) problems.push(`${asset} → ${res.status}`);
  }
  return { pages, assetCount: assets.size, problems };
}

async function verifyOnGateways(cid) {
  const deadline = Date.now() + gatewayTimeoutMs;
  let lastProblems = [];
  while (Date.now() < deadline) {
    for (const host of PUBLIC_GATEWAYS) {
      const base = subdomainGatewayUrl(cid, host).replace(/\/$/, "");
      try {
        const result = await verifySite(base);
        if (result.problems.length === 0) return { base, ...result };
        lastProblems = result.problems;
      } catch (error) {
        if (error?.serviceWorkerOnly) return { base, unverifiable: error.message };
        lastProblems = [String(error)];
      }
    }
    log(`gateway not serving ${cid.slice(0, 16)}… yet (${lastProblems[0]}); retrying in 30s`);
    await new Promise((r) => setTimeout(r, 30000));
  }
  throw new Error(`gateway check timed out: ${lastProblems.slice(0, 3).join("; ")}`);
}

async function main() {
  // 1. Preflight (read-only)
  const connection = new Connection(rpcUrl, "confirmed");
  const state = await readSnsState(connection, name);
  log(`${name}.sol owner ${state.owner}`);
  log(`current IPFS record: ${state.ipfs ? JSON.stringify(state.ipfs.content) : "none"}; url record: ${state.url ? JSON.stringify(state.url.content) : "none"}`);
  if (state.url && !clearUrl) {
    log("NOTE: a url record exists — Brave resolves url before IPFS, so .sol keeps going there until you run once with --clear-url");
  }

  const signer = loadSigner();
  if (!signer) {
    if (!dryRun) fail("SOLANA_SIGNING_KEY is not set in .env.local");
    log("SOLANA_SIGNING_KEY not set — the dry run will simulate without it");
  } else if (signer.publicKey.toBase58() !== state.owner) {
    fail(`SOLANA_SIGNING_KEY is ${signer.publicKey.toBase58()}, but ${name}.sol is owned by ${state.owner}`);
  } else {
    log("signing key matches the name owner (key not printed)");
  }
  const balance = (await connection.getBalance(new PublicKey(state.owner))) / 1e9;
  log(`owner balance ${balance} SOL`);
  if (balance < MIN_SOL) fail(`owner has ${balance} SOL; need at least ${MIN_SOL} for fees and record rent`);

  if (!process.env.PINATA_JWT?.trim()) fail("PINATA_JWT is not set in .env.local");
  const auth = await testAuthentication();
  if (!auth.ok) fail(`Pinata rejected PINATA_JWT (HTTP ${auth.status})`);
  const pins = await listPins();
  log(`Pinata auth ok; ${pins.length} pin(s) on the account`);

  // 2. Build
  if (!skipBuild) {
    log("building (npm run build:global) …");
    const build = runSync("npm", ["run", "build:global"], { stdio: "inherit" });
    if (build.status !== 0) fail("build:global failed");
  }
  if (!existsSync(join(outDir, "index.html"))) fail(`${outDir}/index.html missing — build first`);

  // 3. Local checks against a root-served copy of out/ (both modes)
  const server = await startRootServer();
  const localBase = `http://127.0.0.1:${server.address().port}`;
  const local = await verifySite(localBase);
  server.close();
  if (local.problems.length) fail(`local root-serve check: ${local.problems.join("; ")}`);
  log(`local root-serve check ok: ${local.pages.join(", ")} + ${local.assetCount} assets + RSC trees`);

  const bin = ipfsBin();
  const expectedCid = bin ? localCid(bin) : null;
  log(expectedCid ? `expected CID (offline hash): ${expectedCid}` : "no ipfs CLI — skipping offline CID pre-hash");

  // 4. Pin
  let cid = givenCid;
  if (cid) {
    if (!pins.some((p) => p.cid === cid)) fail(`--cid ${cid} is not pinned on this Pinata account`);
    log(`using already-pinned CID ${cid}`);
  } else if (dryRun) {
    cid = expectedCid || cidFromRecordContent(state.ipfs?.content ?? "") || pins[0]?.cid;
    log(`would upload ${outDir} to Pinata (pinFileToIPFS, cidVersion 1); using ${cid} as a stand-in CID`);
  } else {
    log("uploading out/ to Pinata …");
    const upload = await uploadDirectory("out");
    cid = upload.cid;
    log(`pinned ${cid} (${upload.fileCount} files)`);
    if (expectedCid && expectedCid !== cid) log(`WARNING: Pinata CID differs from the offline hash ${expectedCid}`);
  }
  if (!cid) fail("no CID available");
  ipfsRecordContent(cid); // validates CIDv1

  // 5. Public gateway check (root-serving subdomain gateway)
  if (skipGatewayCheck) {
    log(`skipping the public-gateway check${givenCid ? " (--cid)" : ""} — verify https://${cid}.ipfs.inbrowser.link/ in a browser`);
  } else if (dryRun) {
    log(`would wait for ${subdomainGatewayUrl(cid)} to serve the same pages + assets (timeout ${gatewayTimeoutMs / 1000}s)`);
  } else {
    const gw = await verifyOnGateways(cid);
    if (gw.unverifiable) {
      log(`WARNING: ${gw.unverifiable}; continuing — verify https://${cid}.ipfs.inbrowser.link/ in a browser`);
    } else {
      log(`gateway ok: ${gw.base} served ${gw.pages.length} pages + ${gw.assetCount} assets`);
    }
  }

  // 6. On-chain IPFS record
  const currentCid = cidFromRecordContent(state.ipfs?.content ?? "");
  const recordIsCurrent =
    state.ipfs?.content === ipfsRecordContent(cid) && state.ipfs?.stalenessSigner === state.owner && !(clearUrl && state.url);
  let signature = null;
  if (recordIsCurrent) {
    log("IPFS record already points at this CID — no transaction needed");
  } else {
    const instructions = [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
      ...buildRecordInstructions({ name, cid, owner: state.owner, ipfsExists: Boolean(state.ipfs), deleteUrl: clearUrl && Boolean(state.url) }),
    ];
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({ payerKey: new PublicKey(state.owner), recentBlockhash: blockhash, instructions }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    const sim = await connection.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true });
    if (sim.value.err) {
      fail(`simulation failed: ${JSON.stringify(sim.value.err)}\n${(sim.value.logs ?? []).slice(-8).join("\n")}`);
    }
    log(`simulation ok (${sim.value.unitsConsumed} CU): IPFS → ${ipfsRecordContent(cid)}${clearUrl && state.url ? ", delete url record" : ""}`);
    if (dryRun) {
      log("would sign and send this transaction with the owner key");
    } else {
      tx.sign([signer]);
      signature = await connection.sendTransaction(tx, { maxRetries: 5 });
      log(`sent ${signature}; confirming …`);
      const { status } = await waitForSignature(connection, signature);
      log(`${status.confirmationStatus} in slot ${status.slot}`);
      const after = await readSnsState(connection, name);
      if (after.ipfs?.content !== ipfsRecordContent(cid) || after.ipfs?.stalenessSigner !== after.owner) {
        fail(`on-chain verify: IPFS record reads ${JSON.stringify(after.ipfs)}`);
      }
      if (clearUrl && after.url) fail("on-chain verify: url record still present");
      log(`on-chain verified: IPFS = ${after.ipfs.content}, staleness signed by owner`);
    }
  }

  // 7. Unpin old project pins (never the live CID or the one just replaced)
  const nextPins = dryRun && !givenCid && !pins.some((p) => p.cid === cid)
    ? [{ id: "(new upload)", cid, datePinned: new Date().toISOString(), keyvalues: { project: "transition-insight" } }, ...pins]
    : pins;
  const toRemove = selectPinsToRemove(nextPins, { keep, protect: [cid, dryRun ? currentCid : null] });
  if (toRemove.length === 0) log(`unpin: nothing beyond the newest ${keep}`);
  for (const pin of toRemove) {
    if (dryRun) {
      log(`would unpin ${pin.cid} (${pin.name || "?"}, ${pin.datePinned}, id ${pin.id})`);
    } else {
      await unpin(pin.id);
      log(`unpinned ${pin.cid}`);
    }
  }

  const record = {
    at: new Date().toISOString(),
    dryRun,
    name: `${name}.sol`,
    cid,
    previousCid: currentCid,
    signature,
    gateway: subdomainGatewayUrl(cid),
    brave: `https://${cid}.ipfs.inbrowser.link/`,
    unpinned: dryRun ? [] : toRemove.map((p) => p.cid),
  };
  const dir = join(process.cwd(), ".sovereign");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, dryRun ? "last-publish-dry-run.json" : "last-publish.json"), `${JSON.stringify(record, null, 2)}\n`);
  log(dryRun ? "dry run complete — nothing uploaded, signed or unpinned" : `done — ${record.gateway}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
