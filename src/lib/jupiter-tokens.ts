/** Jupiter Tokens API v2 — server/CLI only. Never put the key in NEXT_PUBLIC_*. */
export const JUPITER_TOKENS_SEARCH_URL = "https://api.jup.ag/tokens/v2/search";

export const JUPITER_API_KEY_ENV = "JUPITER_API_KEY";

const MAX_SEARCH_MINTS = 100;
const PLACEHOLDER_KEYS = new Set(["", "YOUR_API_KEY", "your_api_key"]);

export type OrganicScoreLabel = "high" | "medium" | "low";

export type JupiterTokenInfo = {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly isVerified: boolean | null;
  readonly organicScore: number | null;
  readonly organicScoreLabel: OrganicScoreLabel | null;
  readonly mintAuthorityDisabled: boolean | null;
  readonly freezeAuthorityDisabled: boolean | null;
  readonly isSus: boolean;
  readonly tags: readonly string[] | null;
};

export type NodeRouteDecision = "allow" | "review" | "deny";

export type JupiterSearchResult =
  | { readonly ok: true; readonly tokens: readonly JupiterTokenInfo[] }
  | { readonly ok: false; readonly error: string; readonly status?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Read a Jupiter API key from env. Rejects empty values and the docs placeholder.
 */
export function jupiterApiKeyFromEnv(
  env: NodeJS.Dict<string> = process.env,
): string | null {
  const raw = env[JUPITER_API_KEY_ENV];
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  if (PLACEHOLDER_KEYS.has(key)) return null;
  return key;
}

/**
 * Join mint addresses into a Tokens API search query (max 100).
 */
export function buildJupiterMintQuery(mints: readonly string[]): string {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const mint of mints) {
    const id = mint.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
    if (unique.length >= MAX_SEARCH_MINTS) break;
  }
  return unique.join(",");
}

function readOrganicLabel(value: unknown): OrganicScoreLabel | null {
  if (value === "high" || value === "medium" || value === "low") return value;
  return null;
}

function readStringArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const tags = value.filter((item): item is string => typeof item === "string");
  return tags.length === 0 ? null : tags;
}

function readAuditFlag(audit: Record<string, unknown> | null, key: string): boolean | null {
  if (!audit) return null;
  const value = audit[key];
  return typeof value === "boolean" ? value : null;
}

/**
 * Parse one Tokens API object. Returns null when identity fields are missing.
 */
export function parseJupiterToken(value: unknown): JupiterTokenInfo | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || !value.id.trim()) return null;
  if (typeof value.name !== "string" || typeof value.symbol !== "string") return null;
  if (typeof value.decimals !== "number") return null;

  const audit = isRecord(value.audit) ? value.audit : null;
  const isVerified = typeof value.isVerified === "boolean" ? value.isVerified : null;
  const organicScore = typeof value.organicScore === "number" ? value.organicScore : null;

  return {
    id: value.id.trim(),
    name: value.name,
    symbol: value.symbol,
    decimals: value.decimals,
    isVerified,
    organicScore,
    organicScoreLabel: readOrganicLabel(value.organicScoreLabel),
    mintAuthorityDisabled: readAuditFlag(audit, "mintAuthorityDisabled"),
    freezeAuthorityDisabled: readAuditFlag(audit, "freezeAuthorityDisabled"),
    isSus: audit?.isSus === true,
    tags: readStringArray(value.tags),
  };
}

/**
 * Parse a Tokens API search payload (array of tokens).
 */
export function parseJupiterSearchPayload(payload: unknown): JupiterTokenInfo[] {
  if (!Array.isArray(payload)) return [];
  const tokens: JupiterTokenInfo[] = [];
  for (const row of payload) {
    const token = parseJupiterToken(row);
    if (token) tokens.push(token);
  }
  return tokens;
}

/**
 * Decide whether the node may route this mint.
 *
 * deny — flagged suspicious, or unverified with low organic score
 * allow — Jupiter-verified and not an open mint/freeze authority
 * review — everything else (needs a human)
 */
export function nodeRouteDecision(token: JupiterTokenInfo): NodeRouteDecision {
  if (token.isSus) return "deny";
  if (token.isVerified !== true && token.organicScoreLabel === "low") return "deny";
  if (token.mintAuthorityDisabled === false || token.freezeAuthorityDisabled === false) {
    return token.isVerified === true ? "review" : "deny";
  }
  if (token.isVerified === true) return "allow";
  return "review";
}

/**
 * GET /tokens/v2/search — requires x-api-key.
 */
export async function searchJupiterTokens(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<JupiterSearchResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: "Jupiter search query is empty" };
  }
  const key = apiKey.trim();
  if (PLACEHOLDER_KEYS.has(key)) {
    return { ok: false, error: "Jupiter API key is missing" };
  }

  const url = new URL(JUPITER_TOKENS_SEARCH_URL);
  url.searchParams.set("query", trimmed);

  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      "x-api-key": key,
      accept: "application/json",
    },
  });

  if (response.status === 401) {
    return { ok: false, error: "Jupiter API key was rejected", status: 401 };
  }
  if (response.status === 429) {
    return { ok: false, error: "Jupiter rate limit exceeded", status: 429 };
  }
  if (!response.ok) {
    return { ok: false, error: `Jupiter search failed (${response.status})`, status: response.status };
  }

  const payload: unknown = await response.json();
  return { ok: true, tokens: parseJupiterSearchPayload(payload) };
}
