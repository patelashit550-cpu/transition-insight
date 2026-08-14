/** Etherscan v2 account API — server/CLI only. Never put the key in NEXT_PUBLIC_*. */
export const ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api";
export const ETHERSCAN_API_KEY_ENV = "ETHERSCAN_API_KEY";
export const UNISWAP_TOKEN_LIST_URL = "https://tokens.uniswap.org";

const ETHEREUM_MAINNET = 1;
const PLACEHOLDER_KEYS = new Set(["", "YOUR_API_KEY", "YourApiKeyToken", "your_api_key"]);

export type EvmRouteDecision = "allow" | "review" | "deny";

export type EvmTokenInfo = {
  readonly address: string;
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number | null;
  readonly onUniswapList: boolean;
  readonly route: EvmRouteDecision;
};

export type EtherscanTokenTransfer = {
  readonly hash: string;
  readonly contractAddress: string;
  readonly symbol: string;
  readonly name: string;
  readonly decimals: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Normalize a hex address for comparison. Returns null if invalid.
 */
export function parseEvmAddress(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/**
 * Read an Etherscan API key from env. Rejects empty values and docs placeholders.
 */
export function etherscanApiKeyFromEnv(
  env: NodeJS.Dict<string> = process.env,
): string | null {
  const raw = env[ETHERSCAN_API_KEY_ENV];
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  if (PLACEHOLDER_KEYS.has(key)) return null;
  return key;
}

export function evmRouteDecision(onUniswapList: boolean): EvmRouteDecision {
  return onUniswapList ? "allow" : "review";
}

function readInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Parse one Uniswap token-list entry (Ethereum mainnet only).
 */
export function parseUniswapToken(value: unknown): Omit<EvmTokenInfo, "onUniswapList" | "route"> | null {
  if (!isRecord(value)) return null;
  if (value.chainId !== ETHEREUM_MAINNET) return null;
  if (typeof value.address !== "string") return null;
  const address = parseEvmAddress(value.address);
  if (!address) return null;
  if (typeof value.symbol !== "string" || typeof value.name !== "string") return null;
  return {
    address,
    symbol: value.symbol,
    name: value.name,
    decimals: readInt(value.decimals),
  };
}

/**
 * Index Ethereum mainnet tokens from a Uniswap token list payload.
 */
export function indexUniswapTokenList(payload: unknown): Map<string, EvmTokenInfo> {
  const index = new Map<string, EvmTokenInfo>();
  if (!isRecord(payload) || !Array.isArray(payload.tokens)) return index;
  for (const row of payload.tokens) {
    const token = parseUniswapToken(row);
    if (!token) continue;
    index.set(token.address, {
      ...token,
      onUniswapList: true,
      route: "allow",
    });
  }
  return index;
}

export function findUniswapTokensBySymbol(
  index: Map<string, EvmTokenInfo>,
  symbol: string,
): EvmTokenInfo[] {
  const want = symbol.trim().toLowerCase();
  if (!want) return [];
  return [...index.values()].filter((token) => token.symbol.toLowerCase() === want);
}

/**
 * Parse Etherscan tokentx `result` rows into unique contract addresses.
 */
export function extractContractsFromTokenTxs(rows: unknown): EtherscanTokenTransfer[] {
  if (!Array.isArray(rows)) return [];
  const seen = new Set<string>();
  const transfers: EtherscanTokenTransfer[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    if (typeof row.contractAddress !== "string") continue;
    const contractAddress = parseEvmAddress(row.contractAddress);
    if (!contractAddress || seen.has(contractAddress)) continue;
    seen.add(contractAddress);
    transfers.push({
      hash: typeof row.hash === "string" ? row.hash : "",
      contractAddress,
      symbol: typeof row.tokenSymbol === "string" ? row.tokenSymbol : "",
      name: typeof row.tokenName === "string" ? row.tokenName : "",
      decimals: readInt(row.tokenDecimal),
    });
  }
  return transfers;
}

export function classifyEvmToken(
  transfer: EtherscanTokenTransfer,
  uniswap: Map<string, EvmTokenInfo>,
): EvmTokenInfo {
  const listed = uniswap.get(transfer.contractAddress);
  if (listed) return listed;
  return {
    address: transfer.contractAddress,
    symbol: transfer.symbol,
    name: transfer.name,
    decimals: transfer.decimals,
    onUniswapList: false,
    route: "review",
  };
}

export type EtherscanTxResult =
  | { readonly ok: true; readonly transfers: readonly EtherscanTokenTransfer[] }
  | { readonly ok: false; readonly error: string; readonly status?: number };

/**
 * GET Etherscan v2 account/tokentx for an Ethereum address.
 */
export async function fetchEtherscanTokenTxs(
  address: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<EtherscanTxResult> {
  const parsed = parseEvmAddress(address);
  if (!parsed) {
    return { ok: false, error: "ETH address is invalid" };
  }
  const key = apiKey.trim();
  if (PLACEHOLDER_KEYS.has(key)) {
    return { ok: false, error: "Etherscan API key is missing" };
  }

  const url = new URL(ETHERSCAN_V2_URL);
  url.searchParams.set("chainid", String(ETHEREUM_MAINNET));
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokentx");
  url.searchParams.set("address", parsed);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", "25");
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", key);

  const response = await fetchImpl(url, { method: "GET", headers: { accept: "application/json" } });
  if (response.status === 401 || response.status === 403) {
    return { ok: false, error: "Etherscan API key was rejected", status: response.status };
  }
  if (response.status === 429) {
    return { ok: false, error: "Etherscan rate limit exceeded", status: 429 };
  }
  if (!response.ok) {
    return { ok: false, error: `Etherscan tokentx failed (${response.status})`, status: response.status };
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload)) {
    return { ok: false, error: "Etherscan returned a non-object" };
  }
  if (payload.status === "0" && payload.message === "NOTOK") {
    const result = typeof payload.result === "string" ? payload.result : "Etherscan NOTOK";
    return { ok: false, error: result };
  }
  if (payload.status === "0") {
    return { ok: true, transfers: [] };
  }
  return { ok: true, transfers: extractContractsFromTokenTxs(payload.result) };
}

export type UniswapListResult =
  | { readonly ok: true; readonly index: Map<string, EvmTokenInfo> }
  | { readonly ok: false; readonly error: string; readonly status?: number };

/**
 * GET the public Uniswap default token list (no API key).
 */
export async function fetchUniswapTokenList(
  fetchImpl: typeof fetch = fetch,
): Promise<UniswapListResult> {
  const response = await fetchImpl(UNISWAP_TOKEN_LIST_URL, {
    method: "GET",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    return { ok: false, error: `Uniswap token list failed (${response.status})`, status: response.status };
  }
  const payload: unknown = await response.json();
  return { ok: true, index: indexUniswapTokenList(payload) };
}
