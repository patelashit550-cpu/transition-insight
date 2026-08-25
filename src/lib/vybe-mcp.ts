/**
 * Vybe Network MCP — server/CLI only.
 *
 * Streamable HTTP: https://mcp.vybenetwork.xyz/mcp
 * Metadata:        https://mcp.vybenetwork.xyz
 *
 * `tools/list` is public. `tools/call` requires OAuth (OpenClaw: `mcp login vybe-mcp`).
 * REST calls through `execute-request` also need a dashboard API key as `X-API-Key`.
 * Key source: https://vybenetwork.com → API Dashboard → Generate Key
 */
import {
  configuredVybeMcpUrl,
  listMcpTools,
  type McpToolSummary,
} from "./mcp-http.ts";

export const VYBE_API_KEY_ENV = "VYBE_API_KEY";
export const VYBE_API_KEY_DOCS_URL = "https://docs.vybenetwork.com/docs/getting-started";
export const VYBE_MCP_METADATA_URL = "https://mcp.vybenetwork.xyz";

const PLACEHOLDER_KEYS = new Set(["", "YOUR_API_KEY", "your_api_key", "your-api-key"]);

/**
 * Read a Vybe REST API key from env. Rejects empty values and the docs placeholder.
 */
export function vybeApiKeyFromEnv(env: NodeJS.Dict<string> = process.env): string | null {
  const raw = env[VYBE_API_KEY_ENV];
  if (typeof raw !== "string") return null;
  const key = raw.trim();
  if (PLACEHOLDER_KEYS.has(key)) return null;
  return key;
}

export async function listVybeMcpTools(
  options: { readonly url?: string } = {},
): Promise<readonly McpToolSummary[]> {
  return listMcpTools(options.url ?? configuredVybeMcpUrl());
}
