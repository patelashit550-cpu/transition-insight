import { parseSolanaRpcUrl, solanaJsonRpc } from "./solana-rpc.ts";

const DEFAULT_SIGNATURE_LIMIT = 20;
const MAX_SIGNATURE_LIMIT = 50;

export type RecentMintProbe = {
  readonly url: string;
  readonly address: string;
  readonly signatures: readonly string[];
  readonly mints: readonly string[];
  readonly skipped: number;
};

type SignatureRow = {
  readonly signature: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMint(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const mint = value.trim();
  if (mint.length < 32 || mint.length > 44) return null;
  return mint;
}

function collectMintsFromBalances(rows: unknown, into: Set<string>): void {
  if (!Array.isArray(rows)) return;
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const mint = readMint(row.mint);
    if (mint) into.add(mint);
  }
}

/**
 * Collect SPL mint addresses from a jsonParsed getTransaction result.
 */
export function extractMintsFromParsedTransaction(tx: unknown): string[] {
  if (!isRecord(tx)) return [];
  const meta = tx.meta;
  if (!isRecord(meta)) return [];
  const mints = new Set<string>();
  collectMintsFromBalances(meta.preTokenBalances, mints);
  collectMintsFromBalances(meta.postTokenBalances, mints);
  return [...mints].sort();
}

function readSignatures(result: unknown): string[] {
  if (!Array.isArray(result)) {
    throw new Error("getSignaturesForAddress returned a non-array");
  }
  const signatures: string[] = [];
  for (const row of result) {
    if (!isRecord(row) || typeof row.signature !== "string") continue;
    const signature = row.signature.trim();
    if (signature) signatures.push(signature);
  }
  return signatures;
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_SIGNATURE_LIMIT;
  return Math.min(MAX_SIGNATURE_LIMIT, Math.max(1, Math.floor(limit)));
}

/**
 * Recent signatures for an address (no transaction bodies).
 */
export async function listSignaturesForAddress(
  rpcUrl: string,
  address: string,
  limit = DEFAULT_SIGNATURE_LIMIT,
): Promise<{ readonly url: string; readonly address: string; readonly signatures: readonly string[] }> {
  const parsed = parseSolanaRpcUrl(rpcUrl);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const owner = address.trim();
  if (!owner) {
    throw new Error("Owner address is empty");
  }
  const rows = await solanaJsonRpc<SignatureRow[]>(parsed.url, "getSignaturesForAddress", [
    owner,
    { limit: clampLimit(limit) },
  ]);
  return { url: parsed.url, address: owner, signatures: readSignatures(rows) };
}

/**
 * Recent confirmed signatures for an owner, then mint IDs from those txs.
 */
export async function listRecentMintsForAddress(
  rpcUrl: string,
  address: string,
  limit = DEFAULT_SIGNATURE_LIMIT,
): Promise<RecentMintProbe> {
  const parsed = parseSolanaRpcUrl(rpcUrl);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const owner = address.trim();
  if (!owner) {
    throw new Error("Owner address is empty");
  }

  const rows = await solanaJsonRpc<SignatureRow[]>(parsed.url, "getSignaturesForAddress", [
    owner,
    { limit: clampLimit(limit) },
  ]);
  const signatures = readSignatures(rows);

  const mints = new Set<string>();
  let skipped = 0;
  for (const signature of signatures) {
    const tx = await solanaJsonRpc<unknown>(parsed.url, "getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]);
    if (tx == null) {
      skipped += 1;
      continue;
    }
    for (const mint of extractMintsFromParsedTransaction(tx)) {
      mints.add(mint);
    }
  }

  return {
    url: parsed.url,
    address: owner,
    signatures,
    mints: [...mints].sort(),
    skipped,
  };
}
