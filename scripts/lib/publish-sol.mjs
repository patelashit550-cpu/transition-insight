/**
 * Helpers for scripts/publish-sol.mjs: SNS IPFS record (records V2) for transition-insight.sol,
 * root-serving gateway checks, and Pinata pin retention. Pure helpers are unit-tested in
 * publish-sol.test.mjs; network helpers are read-only unless their name says otherwise.
 */
import { PublicKey } from "@solana/web3.js";
import {
  Record,
  deleteRecordV2,
  getDomainKeySync,
  getRecordV2Key,
  updateRecordV2Instruction,
  createRecordV2Instruction,
  validateRecordV2Content,
} from "@bonfida/spl-name-service";

/** Name Registry header (parent, owner, class) precedes the SNS records V2 payload. */
const NAME_REGISTRY_HEADER = 96;
/** sns-records validation id lengths by type (0 none, 1 Solana, 2 Ethereum, 3 unverified Solana). */
const VALIDATION_ID_LENGTH = { 0: 0, 1: 32, 2: 20, 3: 32 };

/** Brave only resolves the `ipfs://` form; the content is stored as UTF-8. */
export function ipfsRecordContent(cid) {
  if (!/^baf[a-z2-7]{50,}$/.test(cid)) {
    throw new Error(`Expected a base32 CIDv1 (bafy…), got "${cid}"`);
  }
  return `ipfs://${cid}`;
}

/** @param {string} content */
export function cidFromRecordContent(content) {
  const match = /^(?:ipfs:\/\/)?(baf[a-z2-7]+|Qm[1-9A-HJ-NP-Za-km-z]{44})\/?$/.exec(content?.trim() ?? "");
  return match ? match[1] : null;
}

/**
 * Parse a records V2 account (name registry data) without the SDK's NFT-owner lookups, which
 * need indexed RPC methods that free endpoints refuse.
 * @param {Buffer} data
 */
export function parseRecordV2Account(data) {
  const body = data.subarray(NAME_REGISTRY_HEADER);
  const stalenessType = body.readUInt16LE(0);
  const roaType = body.readUInt16LE(2);
  const contentLength = body.readUInt32LE(4);
  const stalenessLength = VALIDATION_ID_LENGTH[stalenessType] ?? 0;
  const roaLength = VALIDATION_ID_LENGTH[roaType] ?? 0;
  const stalenessId = body.subarray(8, 8 + stalenessLength);
  const contentStart = 8 + stalenessLength + roaLength;
  const content = body.subarray(contentStart, contentStart + contentLength).toString("utf8");
  return {
    stalenessType,
    stalenessSigner: stalenessType === 1 ? new PublicKey(stalenessId).toBase58() : null,
    roaType,
    content,
  };
}

/** @param {Buffer} data name registry account data */
export function registryOwner(data) {
  return new PublicKey(data.subarray(32, 64)).toBase58();
}

/**
 * Read owner + IPFS/url records (V2) for a .sol name. Read-only.
 * @param {import("@solana/web3.js").Connection} connection
 * @param {string} name label without .sol, e.g. "transition-insight"
 */
export async function readSnsState(connection, name) {
  const domainKey = getDomainKeySync(name).pubkey;
  const ipfsKey = getRecordV2Key(name, Record.IPFS);
  const urlKey = getRecordV2Key(name, Record.Url);
  const [domain, ipfs, url] = await connection.getMultipleAccountsInfo([domainKey, ipfsKey, urlKey]);
  if (!domain) throw new Error(`${name}.sol does not exist on-chain`);
  const owner = registryOwner(domain.data);
  const parse = (account) => (account ? parseRecordV2Account(account.data) : null);
  return {
    domainKey: domainKey.toBase58(),
    owner,
    ipfs: parse(ipfs),
    url: parse(url),
  };
}

/**
 * Instructions that point the IPFS record at `cid` and re-sign its staleness with the owner
 * (Brave ignores V2 records whose staleness is not signed by the current owner). Optionally
 * delete the url record, which Brave checks before IPFS.
 */
export function buildRecordInstructions({ name, cid, owner, ipfsExists, deleteUrl }) {
  const ownerKey = new PublicKey(owner);
  const content = ipfsRecordContent(cid);
  const instructions = [
    ipfsExists
      ? updateRecordV2Instruction(name, Record.IPFS, content, ownerKey, ownerKey)
      : createRecordV2Instruction(name, Record.IPFS, content, ownerKey, ownerKey),
    validateRecordV2Content(true, name, Record.IPFS, ownerKey, ownerKey, ownerKey),
  ];
  if (deleteUrl) instructions.push(deleteRecordV2(name, Record.Url, ownerKey, ownerKey));
  return instructions;
}

/**
 * Plan-limit preflight. Pinata counts every file inside a folder pin toward the plan's file limit
 * (500 on the free plan); going over blocks the whole account (uploads and the dedicated gateway).
 * The live copy and the new upload must both fit, because the old copy is only unpinned after
 * the SNS record points at the new one.
 * @param {{ pins: { files?: number }[], newFiles: number, limit: number }} input
 */
export function checkPlanFileLimit({ pins, newFiles, limit }) {
  const pinnedFiles = pins.reduce((sum, pin) => sum + (Number(pin.files) || 0), 0);
  const total = pinnedFiles + newFiles;
  return { ok: total <= limit, pinnedFiles, newFiles, total, limit };
}

/**
 * Which project pins to unpin: keep the newest `keep` plus anything still referenced on-chain.
 * Only pins tagged project=transition-insight (or the legacy names) are ever considered.
 */
export function selectPinsToRemove(pins, { keep = 2, protect = [] } = {}) {
  const ours = pins
    .filter((pin) => pin.keyvalues?.project === "transition-insight" || ["out", "planet-iii-site"].includes(pin.name))
    .sort((a, b) => String(b.datePinned).localeCompare(String(a.datePinned)));
  const kept = new Set(ours.slice(0, keep).map((pin) => pin.cid));
  for (const cid of protect) if (cid) kept.add(cid);
  return ours.filter((pin) => !kept.has(pin.cid));
}

/** Root-absolute asset URLs a page needs to hydrate (scripts, CSS, fonts, page icons). */
export function extractRootAssets(html) {
  const urls = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+|\/visuals\/[^"]+|\/assets\/[^"]+)"/g)) {
    urls.add(match[1]);
  }
  return [...urls];
}

/**
 * Wait for a sent transaction by polling its signature status — not by comparing block heights,
 * which some RPCs (publicnode) report wrongly (getBlockHeight returns the slot), making web3.js'
 * blockheight strategy throw "expired" for transactions that actually landed.
 * Resolves { status } once confirmed/finalized; throws on a failed tx, or on timeout (with the
 * signature, so it can be checked on an explorer before any retry).
 */
export async function waitForSignature(connection, signature, { timeoutMs = 120_000, pollMs = 2_000, sleep } = {}) {
  const wait = sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const { value } = await connection.getSignatureStatuses([signature], { searchTransactionHistory: true });
    const status = value?.[0];
    if (status?.err) throw new Error(`transaction ${signature} failed: ${JSON.stringify(status.err)}`);
    if (status && ["confirmed", "finalized"].includes(status.confirmationStatus)) return { status };
    if (Date.now() >= deadline) {
      throw new Error(`transaction ${signature} not confirmed after ${Math.round(timeoutMs / 1000)}s — check it on an explorer before retrying`);
    }
    await wait(pollMs);
  }
}

/** Public gateways that only serve browsers now answer plain HTTP with 429 + a service-worker notice. */
export function isServiceWorkerOnlyResponse(status, body = "") {
  return status === 429 && /service worker gateway/i.test(body);
}
