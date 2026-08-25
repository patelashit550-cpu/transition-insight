/**
 * Probe the public SNS MCP (https://mcp.sns.id/mcp).
 *
 * Usage:
 *   npm run sns:mcp
 *
 * Optional override: SNS_MCP_URL
 */
import { loadEnvFiles } from "./lib/load-env.mjs";
import { configuredSnsMcpUrl, listMcpTools } from "../src/lib/mcp-http.ts";
import {
  SNS_SITE_DOMAIN,
  checkSnsDomains,
  getSnsDomainRecords,
} from "../src/lib/sns-mcp.ts";

loadEnvFiles();

const url = configuredSnsMcpUrl();
const tools = await listMcpTools(url);
const checks = await checkSnsDomains([SNS_SITE_DOMAIN]);
const records = await getSnsDomainRecords(SNS_SITE_DOMAIN);

const out = {
  url,
  tools: tools.map((tool) => tool.name),
  checks,
  records,
};

console.log(JSON.stringify(out, null, 2));

if (tools.length === 0) {
  process.exit(1);
}
