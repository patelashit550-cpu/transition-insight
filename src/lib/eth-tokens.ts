/**
 * Etherscan ERC-20 `tokentx` + Uniswap default list — laptop/CLI only.
 * Never put `ETHERSCAN_API_KEY` in `NEXT_PUBLIC_*` or GitHub Actions.
 */
export const ETHERSCAN_V2_URL = "https://api.etherscan.io/v2/api";
export const UNISWAP_DEFAULT_LIST_URL = "https://tokens.uniswap.org";
export const ETHERSCAN_API_KEY_ENV = "ETHERSCAN_API_KEY";
export const ETH_MAINNET_CHAIN_ID = 1;
export const ETHERSCAN_FETCH_TIMEOUT_MS = 8_000;

const PLACEHOLDER_KEYS = new Set(["", "YOUR_API_KEY", "your_api_key", "YourApiKeyToken"]);
const MAX_TOKEN_TX = 100;

export type ParsedEthAddress =
  | { readonly ok: true; readonly address: string }
  | { readonly ok: false; readonly error: string };

export type EthNodeRouteDecision = "allow" | "review";

export type EtherscanTokenTx = {
  readonly hash: string;
  readonly from: string;
  readonly to: string;
  readonly contractAddress: string;
  readonly tokenName: string;
  readonly tokenSymbol: string;
  readonly tokenDecimal: number;
  readonly value: string;
  readonly timeStamp: number;
};

export type EtherscanTokentxResult =
  | { readonly ok: true; readonly txs: readonly EtherscanTokenTx[] }
  | { readonly ok: false; readonly error: string; readonly status?: number };

export type UniswapToken = {
  readonly chainId: number;
  readonly address: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
};

export type UniswapListResult =
  | { readonly ok: true; readonly tokens: readonly UniswapToken[] }
  | { readonly ok: false; readonly error: string; readonly status?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function envString(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Validate a 20-byte 0x address. Matching is case-insensitive (no checksum required).
 */
export function parseEthAddress(raw: string): ParsedEthAddress {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Address is empty" };
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return { ok: false, error: "Address is not a valid Ethereum address" };
  }
  return { ok: true, address: trimmed };
}

export function normalizeEthAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Read an Etherscan API key from env. Rejects empty values and docs placeholders.
 */
export function etherscanApiKeyFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const key = envString(env[ETHERSCAN_API_KEY_ENV]);
  if (!key || PLACEHOLDER_KEYS.has(key)) return null;
  return key;
}

function readPositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Parse one Etherscan `tokentx` row.
 */
export function parseEtherscanTokenTx(value: unknown): EtherscanTokenTx | null {
  if (!isRecord(value)) return null;
  const hash = typeof value.hash === "string" ? value.hash.trim() : "";
  const from = typeof value.from === "string" ? value.from.trim() : "";
  const to = typeof value.to === "string" ? value.to.trim() : "";
  const contractAddress = typeof value.contractAddress === "string" ? value.contractAddress.trim() : "";
  const tokenName = typeof value.tokenName === "string" ? value.tokenName : "";
  const tokenSymbol = typeof value.tokenSymbol === "string" ? value.tokenSymbol : "";
  const valueRaw = typeof value.value === "string" ? value.value : "";
  const tokenDecimal = readPositiveInt(value.tokenDecimal);
  const timeStamp = readPositiveInt(value.timeStamp);
  if (!hash || !parseEthAddress(from).ok || !parseEthAddress(contractAddress).ok) return null;
  if (to && !parseEthAddress(to).ok) return null;
  if (tokenDecimal === null || timeStamp === null) return null;
  return {
    hash,
    from,
    to,
    contractAddress,
    tokenName,
    tokenSymbol,
    tokenDecimal,
    value: valueRaw,
    timeStamp,
  };
}

/**
 * Parse an Etherscan JSON-RPC-style envelope for `tokentx`.
 */
export function parseEtherscanTokentxPayload(payload: unknown): EtherscanTokentxResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "Etherscan returned a non-object" };
  }

  const status = typeof payload.status === "string" ? payload.status : "";
  const message = typeof payload.message === "string" ? payload.message : "";
  const result = payload.result;

  if (status === "0" && /no transactions found/i.test(message)) {
    return { ok: true, txs: [] };
  }

  if (status !== "1") {
    const detail = typeof result === "string" && result.trim() ? result.trim() : message || "Etherscan request failed";
    return { ok: false, error: detail };
  }

  if (!Array.isArray(result)) {
    return { ok: false, error: "Etherscan tokentx result is not an array" };
  }

  const txs: EtherscanTokenTx[] = [];
  for (const row of result) {
    const tx = parseEtherscanTokenTx(row);
    if (tx) txs.push(tx);
  }
  return { ok: true, txs };
}

/**
 * Unique token contracts from `tokentx` rows, first-seen order.
 */
export function uniqueTokenContracts(txs: readonly EtherscanTokenTx[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tx of txs) {
    const key = normalizeEthAddress(tx.contractAddress);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tx.contractAddress);
  }
  return out;
}

/**
 * GET account/tokentx on Ethereum mainnet (Etherscan API V2).
 */
export async function fetchEtherscanTokenTxs(
  address: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = ETHERSCAN_FETCH_TIMEOUT_MS,
): Promise<EtherscanTokentxResult> {
  const parsed = parseEthAddress(address);
  if (!parsed.ok) return parsed;
  const key = apiKey.trim();
  if (!key || PLACEHOLDER_KEYS.has(key)) {
    return { ok: false, error: "Etherscan API key is missing" };
  }

  const url = new URL(ETHERSCAN_V2_URL);
  url.searchParams.set("chainid", String(ETH_MAINNET_CHAIN_ID));
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokentx");
  url.searchParams.set("address", parsed.address);
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", String(MAX_TOKEN_TX));
  url.searchParams.set("sort", "desc");
  url.searchParams.set("apikey", key);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Etherscan fetch failed (${message})` };
  }

  if (response.status === 401) {
    return { ok: false, error: "Etherscan API key was rejected", status: 401 };
  }
  if (response.status === 429) {
    return { ok: false, error: "Etherscan rate limit exceeded", status: 429 };
  }
  if (!response.ok) {
    return { ok: false, error: `Etherscan tokentx failed (${response.status})`, status: response.status };
  }

  const payload: unknown = await response.json();
  return parseEtherscanTokentxPayload(payload);
}

/**
 * Parse one Uniswap token-list entry. Mainnet-only matching happens at lookup time.
 */
export function parseUniswapToken(value: unknown): UniswapToken | null {
  if (!isRecord(value)) return null;
  const chainId = readPositiveInt(value.chainId);
  const address = typeof value.address === "string" ? value.address.trim() : "";
  const name = typeof value.name === "string" ? value.name : "";
  const symbol = typeof value.symbol === "string" ? value.symbol : "";
  const decimals = readPositiveInt(value.decimals);
  if (chainId === null || decimals === null) return null;
  if (!parseEthAddress(address).ok || !symbol) return null;
  return { chainId, address, name, symbol, decimals };
}

export function parseUniswapTokenList(payload: unknown): UniswapToken[] {
  if (!isRecord(payload) || !Array.isArray(payload.tokens)) return [];
  const tokens: UniswapToken[] = [];
  for (const row of payload.tokens) {
    const token = parseUniswapToken(row);
    if (token) tokens.push(token);
  }
  return tokens;
}

/**
 * GET the Uniswap Labs default token list (no API key).
 */
export async function fetchUniswapDefaultList(
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = ETHERSCAN_FETCH_TIMEOUT_MS,
): Promise<UniswapListResult> {
  let response: Response;
  try {
    response = await fetchImpl(UNISWAP_DEFAULT_LIST_URL, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Uniswap list fetch failed (${message})` };
  }

  if (!response.ok) {
    return { ok: false, error: `Uniswap list failed (${response.status})`, status: response.status };
  }

  const payload: unknown = await response.json();
  return { ok: true, tokens: parseUniswapTokenList(payload) };
}

function mainnetListIndex(tokens: readonly UniswapToken[]): Map<string, UniswapToken> {
  const index = new Map<string, UniswapToken>();
  for (const token of tokens) {
    if (token.chainId !== ETH_MAINNET_CHAIN_ID) continue;
    index.set(normalizeEthAddress(token.address), token);
  }
  return index;
}

/**
 * allow — contract is on the Uniswap default list for Ethereum mainnet.
 * review — seen in tokentx but not on that list.
 */
export function ethNodeRouteDecision(
  contractAddress: string,
  tokens: readonly UniswapToken[],
): EthNodeRouteDecision {
  const parsed = parseEthAddress(contractAddress);
  if (!parsed.ok) return "review";
  const listed = mainnetListIndex(tokens).get(normalizeEthAddress(parsed.address));
  return listed ? "allow" : "review";
}

export function lookupUniswapToken(
  contractAddress: string,
  tokens: readonly UniswapToken[],
): UniswapToken | null {
  const parsed = parseEthAddress(contractAddress);
  if (!parsed.ok) return null;
  return mainnetListIndex(tokens).get(normalizeEthAddress(parsed.address)) ?? null;
}
