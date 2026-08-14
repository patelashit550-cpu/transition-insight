/** Default HTTP RPC that answers browser CORS. Official mainnet-beta often 403s from localhost. */
export const DEFAULT_SOLANA_RPC_URL = "https://solana-rpc.publicnode.com";

/**
 * Keyless CORS gateways for epoch/slot only. Same operator (Allnodes / PublicNode),
 * different hostnames — used as failover, not as a private node.
 */
export const PUBLIC_SOLANA_RPC_FALLBACKS: readonly string[] = [
  "https://solana-rpc.publicnode.com",
  "https://solana.publicnode.com",
];

/** Browser-only override; not shipped in the static build. */
export const SOLANA_RPC_STORAGE_KEY = "ti.solanaRpcUrl";

const LAMPORTS_PER_SOL = 1_000_000_000;
const MAX_RPC_URL_LENGTH = 2048;

export type ParsedSolanaRpcUrl =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly error: string };

export type SolanaRpcProbe = {
  readonly url: string;
  readonly epoch: number;
  readonly absoluteSlot: number;
  readonly blockHeight: number;
  readonly lamports: number | null;
  readonly sol: string | null;
};

type JsonRpcSuccess<T> = { readonly result: T; readonly error?: undefined };
type JsonRpcFailure = { readonly error: { readonly message?: string } };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validate a Solana JSON-RPC HTTP(S) endpoint.
 *
 * Rejects non-http schemes, credentials in the URL, and empty hosts.
 * Query strings are allowed so Helius-style `?api-key=` URLs still parse —
 * keep those in localStorage, not in `NEXT_PUBLIC_*`.
 */
export function parseSolanaRpcUrl(raw: string): ParsedSolanaRpcUrl {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "RPC URL is empty" };
  }
  if (trimmed.length > MAX_RPC_URL_LENGTH) {
    return { ok: false, error: "RPC URL is too long" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "RPC URL is not a valid URL" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "RPC URL must be http or https" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "RPC URL must not include username or password" };
  }
  if (!parsed.hostname) {
    return { ok: false, error: "RPC URL is missing a host" };
  }
  if (parsed.protocol === "http:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    return { ok: false, error: "http RPC is only allowed on localhost" };
  }

  parsed.hash = "";
  const url = parsed.toString().replace(/\/$/, "");
  return { ok: true, url };
}

/**
 * Return the build-time Solana RPC URL from env, or the PublicNode default.
 */
export function configuredSolanaRpcUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (typeof fromEnv !== "string") {
    return DEFAULT_SOLANA_RPC_URL;
  }
  const parsed = parseSolanaRpcUrl(fromEnv);
  return parsed.ok ? parsed.url : DEFAULT_SOLANA_RPC_URL;
}

/**
 * True when `url` is a shared public CORS gateway (PublicNode / Allnodes).
 * Those hosts must not receive `getBalance(owner)` from this site.
 */
export function isSharedPublicSolanaRpc(url: string): boolean {
  if (typeof url !== "string") {
    throw new Error("url must be a string");
  }
  const parsed = parseSolanaRpcUrl(url);
  if (!parsed.ok) {
    return false;
  }
  const host = new URL(parsed.url).hostname.toLowerCase();
  return host === "publicnode.com" || host.endsWith(".publicnode.com");
}

/**
 * Owner address to send with a probe. Shared public gateways get `undefined`
 * so visitor IPs are not tied to the Connexion wallet on Allnodes.
 */
export function probeOwnerAddress(url: string, ownerAddress?: string): string | undefined {
  if (typeof url !== "string") {
    throw new Error("url must be a string");
  }
  if (ownerAddress !== undefined && typeof ownerAddress !== "string") {
    throw new Error("ownerAddress must be a string when provided");
  }
  const owner = ownerAddress?.trim();
  if (!owner) {
    return undefined;
  }
  return isSharedPublicSolanaRpc(url) ? undefined : owner;
}

function uniqueRpcUrls(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const parsed = parseSolanaRpcUrl(raw);
    if (!parsed.ok || seen.has(parsed.url)) {
      continue;
    }
    seen.add(parsed.url);
    out.push(parsed.url);
  }
  return out;
}

/**
 * Format lamports as a short SOL string.
 */
export function formatLamportsAsSol(lamports: number): string {
  if (!Number.isFinite(lamports) || lamports < 0) {
    return "0";
  }
  const sol = lamports / LAMPORTS_PER_SOL;
  if (sol === 0) return "0";
  if (sol >= 1) return sol.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return sol.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

async function solanaJsonRpc<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const parsed = parseSolanaRpcUrl(url);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const response = await fetch(parsed.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!response.ok) {
    throw new Error(`RPC ${method} failed (${response.status})`);
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    throw new Error(`RPC ${method} returned a non-object`);
  }

  const failed = payload as JsonRpcFailure;
  if (failed.error) {
    throw new Error(failed.error.message || `RPC ${method} returned an error`);
  }

  const succeeded = payload as JsonRpcSuccess<T>;
  return succeeded.result;
}

function readEpochFields(result: unknown): Pick<SolanaRpcProbe, "epoch" | "absoluteSlot" | "blockHeight"> {
  if (!isRecord(result)) {
    throw new Error("getEpochInfo returned a non-object");
  }
  const epoch = result.epoch;
  const absoluteSlot = result.absoluteSlot;
  const blockHeight = result.blockHeight;
  if (typeof epoch !== "number" || typeof absoluteSlot !== "number" || typeof blockHeight !== "number") {
    throw new Error("getEpochInfo is missing epoch, slot, or block height");
  }
  return { epoch, absoluteSlot, blockHeight };
}

function readLamports(result: unknown): number {
  if (typeof result === "number") {
    return result;
  }
  if (isRecord(result) && typeof result.value === "number") {
    return result.value;
  }
  throw new Error("getBalance returned an unexpected payload");
}

/**
 * Hit a Solana JSON-RPC endpoint for epoch info and optional account balance.
 */
export async function probeSolanaRpc(url: string, ownerAddress?: string): Promise<SolanaRpcProbe> {
  const parsed = parseSolanaRpcUrl(url);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const epochInfo = await solanaJsonRpc<unknown>(parsed.url, "getEpochInfo", []);
  const epochFields = readEpochFields(epochInfo);

  let lamports: number | null = null;
  if (ownerAddress && ownerAddress.trim()) {
    const balance = await solanaJsonRpc<unknown>(parsed.url, "getBalance", [ownerAddress.trim()]);
    lamports = readLamports(balance);
  }

  return {
    url: parsed.url,
    ...epochFields,
    lamports,
    sol: lamports === null ? null : formatLamportsAsSol(lamports),
  };
}

/**
 * Site probe: custom / keyed RPCs get epoch + optional balance; shared public
 * gateways get epoch/slot only, with PublicNode hostname failover.
 */
export async function probeSolanaRpcForSite(url: string, ownerAddress?: string): Promise<SolanaRpcProbe> {
  if (typeof url !== "string") {
    throw new Error("url must be a string");
  }
  const parsed = parseSolanaRpcUrl(url);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  if (!isSharedPublicSolanaRpc(parsed.url)) {
    return probeSolanaRpc(parsed.url, probeOwnerAddress(parsed.url, ownerAddress));
  }

  const candidates = uniqueRpcUrls([parsed.url, ...PUBLIC_SOLANA_RPC_FALLBACKS]);
  let lastError: Error | null = null;
  for (const candidate of candidates) {
    try {
      return await probeSolanaRpc(candidate, undefined);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Public Solana RPC gateway failed");
    }
  }
  throw lastError ?? new Error("All public Solana RPC gateways failed");
}
