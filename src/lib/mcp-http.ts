/**
 * Streamable HTTP MCP client helpers — server/CLI only.
 *
 * Never put MCP URLs with credentials into NEXT_PUBLIC_*.
 */
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

export const DEFAULT_SNS_MCP_URL = "https://mcp.sns.id/mcp";
export const DEFAULT_VYBE_MCP_URL = "https://mcp.vybenetwork.xyz/mcp";

export const SNS_MCP_URL_ENV = "SNS_MCP_URL";
export const VYBE_MCP_URL_ENV = "VYBE_MCP_URL";

const MAX_MCP_URL_LENGTH = 2048;
const MCP_CLIENT_INFO = { name: "transition-insight", version: "0.1.0" } as const;

export type ParsedMcpHttpUrl =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validate an MCP Streamable HTTP endpoint.
 *
 * Rejects non-http schemes, credentials in the URL, and empty hosts.
 */
export function parseMcpHttpUrl(raw: string): ParsedMcpHttpUrl {
  if (typeof raw !== "string") {
    throw new Error("MCP URL must be a string");
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "MCP URL is empty" };
  }
  if (trimmed.length > MAX_MCP_URL_LENGTH) {
    return { ok: false, error: "MCP URL is too long" };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "MCP URL is not a valid URL" };
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "MCP URL must be http or https" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "MCP URL must not include username or password" };
  }
  if (!parsed.hostname) {
    return { ok: false, error: "MCP URL is missing a host" };
  }
  if (parsed.protocol === "http:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    return { ok: false, error: "http MCP URL is only allowed on localhost" };
  }

  parsed.hash = "";
  return { ok: true, url: parsed.toString() };
}

function configuredMcpUrl(
  envKey: string,
  fallback: string,
  env: NodeJS.Dict<string> = process.env,
): string {
  const fromEnv = env[envKey];
  if (typeof fromEnv !== "string") return fallback;
  const parsed = parseMcpHttpUrl(fromEnv);
  return parsed.ok ? parsed.url : fallback;
}

export function configuredSnsMcpUrl(env: NodeJS.Dict<string> = process.env): string {
  return configuredMcpUrl(SNS_MCP_URL_ENV, DEFAULT_SNS_MCP_URL, env);
}

export function configuredVybeMcpUrl(env: NodeJS.Dict<string> = process.env): string {
  return configuredMcpUrl(VYBE_MCP_URL_ENV, DEFAULT_VYBE_MCP_URL, env);
}

export type McpSession = {
  readonly client: Client;
  readonly url: string;
  close(): Promise<void>;
};

/**
 * Connect a Streamable HTTP MCP client. Caller must close the session.
 */
export async function connectMcpHttp(url: string): Promise<McpSession> {
  const parsed = parseMcpHttpUrl(url);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  const client = new Client(MCP_CLIENT_INFO);
  const transport = new StreamableHTTPClientTransport(new URL(parsed.url));
  try {
    await client.connect(transport);
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
  return {
    client,
    url: parsed.url,
    close: () => client.close(),
  };
}

export async function withMcpClient<T>(
  url: string,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const session = await connectMcpHttp(url);
  try {
    return await fn(session.client);
  } finally {
    await session.close();
  }
}

/**
 * First text block from an MCP tool result, if any.
 */
export function mcpToolText(result: unknown): string | null {
  if (!isRecord(result)) return null;
  const content = result.content;
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (isRecord(block) && block.type === "text" && typeof block.text === "string") {
      return block.text;
    }
  }
  return null;
}

/**
 * Parse JSON from an MCP tool's text content.
 */
export function mcpToolJson(result: unknown): unknown {
  const text = mcpToolText(result);
  if (text === null) {
    throw new Error("MCP tool result has no text content");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("MCP tool result is not valid JSON");
  }
}

export type McpToolSummary = {
  readonly name: string;
  readonly description: string | null;
};

export function parseMcpToolList(result: unknown): readonly McpToolSummary[] {
  if (!isRecord(result) || !Array.isArray(result.tools)) {
    throw new Error("MCP tools/list returned an unexpected payload");
  }
  const tools: McpToolSummary[] = [];
  for (const tool of result.tools) {
    if (!isRecord(tool) || typeof tool.name !== "string" || !tool.name.trim()) continue;
    tools.push({
      name: tool.name,
      description: typeof tool.description === "string" ? tool.description : null,
    });
  }
  return tools;
}

export async function listMcpTools(url: string): Promise<readonly McpToolSummary[]> {
  return withMcpClient(url, async (client) => parseMcpToolList(await client.listTools()));
}
