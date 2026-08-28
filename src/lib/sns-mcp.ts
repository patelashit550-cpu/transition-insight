/**
 * Solana Name Service MCP — server/CLI only.
 *
 * Public Streamable HTTP endpoint: https://mcp.sns.id/mcp
 * No API key. Unsigned tx tools must not be broadcast from Pages.
 */
import { Client } from "@modelcontextprotocol/client";

import {
  configuredSnsMcpUrl,
  mcpToolJson,
  withMcpClient,
} from "./mcp-http.ts";
import { SNS_DOMAIN } from "./public-identity.ts";

const MAX_CHECK_DOMAINS = 25;

export const SNS_SITE_DOMAIN = SNS_DOMAIN;

export type SnsPaymentToken = "SOL" | "USDC" | "USDT" | "SNS";

export type SnsDomainCheck = {
  readonly domain: string;
  readonly status: string;
};

export type SnsDomainRecords = {
  readonly domain: string;
  readonly key: string | null;
  readonly records: Readonly<Record<string, string>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Strip a trailing `.sol` so MCP tools receive the label only.
 */
export function snsDomainLabel(raw: string): string {
  if (typeof raw !== "string") {
    throw new Error("domain must be a string");
  }
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    throw new Error("domain is empty");
  }
  return trimmed.replace(/\.sol$/i, "");
}

function uniqueDomainLabels(domains: readonly string[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const domain of domains) {
    const label = snsDomainLabel(domain);
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
    if (labels.length >= MAX_CHECK_DOMAINS) break;
  }
  if (labels.length === 0) {
    throw new Error("at least one domain is required");
  }
  return labels;
}

function readStringRecordMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const records: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry.trim()) {
      records[key] = entry;
    }
  }
  return records;
}

export function parseSnsDomainChecks(payload: unknown): readonly SnsDomainCheck[] {
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    throw new Error("SNS check_domains returned an unexpected payload");
  }
  const results: SnsDomainCheck[] = [];
  for (const row of payload.results) {
    if (!isRecord(row) || typeof row.domain !== "string" || typeof row.status !== "string") {
      continue;
    }
    const domain = row.domain.trim();
    const status = row.status.trim();
    if (!domain || !status) continue;
    results.push({ domain, status });
  }
  return results;
}

export function parseSnsDomainRecords(payload: unknown): SnsDomainRecords {
  if (!isRecord(payload) || typeof payload.domain !== "string" || !payload.domain.trim()) {
    throw new Error("SNS get_domain_records returned an unexpected payload");
  }
  return {
    domain: payload.domain.trim(),
    key: typeof payload.key === "string" && payload.key.trim() ? payload.key.trim() : null,
    records: readStringRecordMap(payload.records),
  };
}

async function callSnsTool(client: Client, name: string, args: Record<string, unknown>): Promise<unknown> {
  return mcpToolJson(await client.callTool({ name, arguments: args }));
}

export async function checkSnsDomains(
  domains: readonly string[],
  options: { readonly url?: string; readonly token?: SnsPaymentToken } = {},
): Promise<readonly SnsDomainCheck[]> {
  const labels = uniqueDomainLabels(domains);
  const args: Record<string, unknown> = { domains: labels };
  if (options.token) args.token = options.token;
  const payload = await withMcpClient(options.url ?? configuredSnsMcpUrl(), (client) =>
    callSnsTool(client, "check_domains", args),
  );
  return parseSnsDomainChecks(payload);
}

export async function getSnsDomainRecords(
  domain: string,
  options: { readonly url?: string } = {},
): Promise<SnsDomainRecords> {
  const label = snsDomainLabel(domain);
  const payload = await withMcpClient(options.url ?? configuredSnsMcpUrl(), (client) =>
    callSnsTool(client, "get_domain_records", { domain: label }),
  );
  return parseSnsDomainRecords(payload);
}
