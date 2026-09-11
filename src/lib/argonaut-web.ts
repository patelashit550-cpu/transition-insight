import {
  braveSearchApiKeyFromEnv,
  argonautWebSearchEnabled,
  type WebEnrichment,
  type WebSource,
} from "@/lib/argonaut-shared";

const BRAVE_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search";
const WEB_TIMEOUT_MS = 8_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseBraveWebResults(payload: unknown): WebSource[] {
  if (!isRecord(payload) || !isRecord(payload.web) || !Array.isArray(payload.web.results)) {
    return [];
  }
  const sources: WebSource[] = [];
  for (const row of payload.web.results) {
    if (!isRecord(row)) continue;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const url = typeof row.url === "string" ? row.url.trim() : "";
    const snippet = typeof row.description === "string" ? row.description.trim() : "";
    if (!title || !url) continue;
    sources.push({ title, url, snippet });
    if (sources.length >= 5) break;
  }
  return sources;
}

export async function enrichFromOpenWeb(
  question: string,
  env: NodeJS.Dict<string> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<WebEnrichment> {
  if (!argonautWebSearchEnabled(env)) {
    return {
      status: "unavailable",
      reason: "Open-web enrichment is off. Set ARGONAUT_WEB_SEARCH=1 and BRAVE_SEARCH_API_KEY in .env.local.",
    };
  }
  const key = braveSearchApiKeyFromEnv(env);
  if (!key) {
    return {
      status: "unavailable",
      reason: "ARGONAUT_WEB_SEARCH is on, but BRAVE_SEARCH_API_KEY is missing. The corpus filter still applies.",
    };
  }

  const url = new URL(BRAVE_SEARCH_URL);
  url.searchParams.set("q", question);
  url.searchParams.set("count", "5");

  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": key,
      },
      signal: AbortSignal.timeout(WEB_TIMEOUT_MS),
    });
    if (!response.ok) {
      return {
        status: "unavailable",
        reason: `Brave Search returned ${response.status}. Corpus filter still applies.`,
      };
    }
    const payload: unknown = await response.json();
    const sources = parseBraveWebResults(payload);
    if (sources.length === 0) {
      return { status: "empty", reason: "Brave Search returned no usable pages." };
    }
    return { status: "used", sources };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    return {
      status: "unavailable",
      reason: `Open web unreachable (${message}). Corpus filter still applies.`,
    };
  }
}

export { parseBraveWebResults };
