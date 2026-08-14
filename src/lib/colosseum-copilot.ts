/**
 * Colosseum Copilot API — server/CLI only.
 *
 * Public base: COLOSSEUM_COPILOT_API_BASE
 * Secret PAT:  COLOSSEUM_COPILOT_PAT (`.env.local`, never NEXT_PUBLIC_*)
 *
 * Docs: https://docs.colosseum.com/copilot/api-reference
 */

export const DEFAULT_COLOSSEUM_COPILOT_API_BASE = "https://copilot.colosseum.com/api/v1";

export const COLOSSEUM_COPILOT_API_BASE_ENV = "COLOSSEUM_COPILOT_API_BASE";

export const COLOSSEUM_COPILOT_PAT_ENV = "COLOSSEUM_COPILOT_PAT";

export const COLOSSEUM_COPILOT_TOKEN_URL = "https://arena.colosseum.org/copilot";

const MAX_API_BASE_LENGTH = 2048;

const PLACEHOLDER_PATS = new Set([
  "",
  "YOUR_PAT",
  "your-token-here",
  "your_pat",
  "YOUR-TOKEN-HERE",
  "eyJhbGciOi...",
]);

export type ParsedCopilotApiBase =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly error: string };

export type CopilotAuthHeaders = {
  readonly Authorization: string;
  readonly Accept: "application/json";
};

export type CopilotStatus = {
  readonly authenticated: boolean;
  readonly expiresAt: string | null;
  readonly scope: string | null;
};

export type CopilotStatusResult =
  | { readonly ok: true; readonly status: CopilotStatus; readonly url: string }
  | { readonly ok: false; readonly error: string; readonly httpStatus?: number; readonly url: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validate a Copilot API base URL.
 *
 * Rejects non-http schemes, credentials in the URL, and empty hosts.
 * Trailing slashes are stripped so `/status` joins cleanly.
 */
export function parseCopilotApiBase(raw: string): ParsedCopilotApiBase {
  if (typeof raw !== "string") {
    throw new Error("API base must be a string");
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Copilot API base is empty" };
  }
  if (trimmed.length > MAX_API_BASE_LENGTH) {
    return { ok: false, error: "Copilot API base is too long" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Copilot API base is not a valid URL" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "Copilot API base must be http or https" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "Copilot API base must not include username or password" };
  }
  if (!parsed.hostname) {
    return { ok: false, error: "Copilot API base is missing a host" };
  }
  if (parsed.protocol === "http:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    return { ok: false, error: "http Copilot API base is only allowed on localhost" };
  }

  parsed.hash = "";
  parsed.search = "";
  const url = parsed.toString().replace(/\/+$/, "");
  return { ok: true, url };
}

/**
 * Return the Copilot API base from env, or the public Colosseum default.
 */
export function configuredCopilotApiBase(
  env: NodeJS.Dict<string> = process.env,
): string {
  const fromEnv = env[COLOSSEUM_COPILOT_API_BASE_ENV];
  if (typeof fromEnv !== "string") {
    return DEFAULT_COLOSSEUM_COPILOT_API_BASE;
  }
  const parsed = parseCopilotApiBase(fromEnv);
  return parsed.ok ? parsed.url : DEFAULT_COLOSSEUM_COPILOT_API_BASE;
}

/**
 * Read a Copilot PAT from env. Rejects empty values and the docs placeholder.
 */
export function copilotPatFromEnv(env: NodeJS.Dict<string> = process.env): string | null {
  const raw = env[COLOSSEUM_COPILOT_PAT_ENV];
  if (typeof raw !== "string") return null;
  const pat = raw.trim();
  if (PLACEHOLDER_PATS.has(pat)) return null;
  return pat;
}

/**
 * Join a path onto the configured (or supplied) API base.
 */
export function copilotUrl(path: string, apiBase?: string): string {
  if (typeof path !== "string") {
    throw new Error("path must be a string");
  }
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (suffix === "/") {
    throw new Error("path must not be empty");
  }
  const parsed = parseCopilotApiBase(apiBase ?? configuredCopilotApiBase());
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return `${parsed.url}${suffix}`;
}

/**
 * Bearer headers for Copilot. Throws when the PAT is missing or a placeholder.
 */
export function copilotAuthHeaders(pat: string): CopilotAuthHeaders {
  if (typeof pat !== "string") {
    throw new Error("PAT must be a string");
  }
  const trimmed = pat.trim();
  if (!trimmed || PLACEHOLDER_PATS.has(trimmed)) {
    throw new Error("Colosseum Copilot PAT is missing");
  }
  return {
    Authorization: `Bearer ${trimmed}`,
    Accept: "application/json",
  };
}

/**
 * Parse a GET /status payload. Returns null when identity fields are missing.
 */
export function parseCopilotStatusPayload(payload: unknown): CopilotStatus | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.authenticated !== "boolean") return null;
  return {
    authenticated: payload.authenticated,
    expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : null,
    scope: typeof payload.scope === "string" ? payload.scope : null,
  };
}

export type CopilotFetch = (
  input: string,
  init?: { readonly method?: string; readonly headers?: Record<string, string>; readonly signal?: AbortSignal },
) => Promise<Response>;

export type ProbeCopilotStatusOptions = {
  readonly apiBase?: string;
  readonly pat?: string | null;
  readonly fetchImpl?: CopilotFetch;
  readonly timeoutMs?: number;
};

/**
 * GET /status — auth pre-flight. Omit the PAT to probe reachability (401).
 */
export async function probeCopilotStatus(
  options: ProbeCopilotStatusOptions = {},
): Promise<CopilotStatusResult> {
  const timeoutMs = options.timeoutMs ?? 15_000;
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive number");
  }

  const apiBase = options.apiBase ?? configuredCopilotApiBase();
  const parsed = parseCopilotApiBase(apiBase);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error, url: apiBase };
  }

  const url = `${parsed.url}/status`;
  const pat = options.pat === undefined ? copilotPatFromEnv() : options.pat;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (typeof pat === "string" && pat.trim() && !PLACEHOLDER_PATS.has(pat.trim())) {
    headers.Authorization = `Bearer ${pat.trim()}`;
  }

  const fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const response = await fetchImpl(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (response.status === 401) {
    return {
      ok: false,
      error: "Unauthorized — set COLOSSEUM_COPILOT_PAT in .env.local",
      httpStatus: 401,
      url,
    };
  }
  if (response.status === 429) {
    return { ok: false, error: "Copilot rate limit exceeded", httpStatus: 429, url };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: `Copilot status failed (${response.status})`,
      httpStatus: response.status,
      url,
    };
  }

  const payload: unknown = await response.json();
  const status = parseCopilotStatusPayload(payload);
  if (!status) {
    return { ok: false, error: "Copilot status returned an unexpected payload", url };
  }
  return { ok: true, status, url };
}
