/**
 * Probe the Vybe MCP (https://mcp.vybenetwork.xyz/mcp).
 *
 * Usage:
 *   npm run vybe:mcp
 *
 * `tools/list` is public. `tools/call` needs OAuth.
 * REST `execute-request` also needs VYBE_API_KEY from the API Dashboard:
 * https://docs.vybenetwork.com/docs/getting-started
 */
import { loadEnvFiles } from "./lib/load-env.mjs";
import { configuredVybeMcpUrl } from "../src/lib/mcp-http.ts";
import {
  VYBE_API_KEY_DOCS_URL,
  VYBE_MCP_METADATA_URL,
  listVybeMcpTools,
  vybeApiKeyFromEnv,
} from "../src/lib/vybe-mcp.ts";

loadEnvFiles();

const url = configuredVybeMcpUrl();
const tools = await listVybeMcpTools({ url });
const apiKey = vybeApiKeyFromEnv();

const out = {
  url,
  metadataUrl: VYBE_MCP_METADATA_URL,
  tools: tools.map((tool) => ({ name: tool.name, description: tool.description })),
  apiKey: apiKey
    ? { configured: true }
    : {
        configured: false,
        hint: `Generate a key at ${VYBE_API_KEY_DOCS_URL} and set VYBE_API_KEY in .env.local for REST execute-request. MCP tool calls still need OAuth.`,
      },
};

console.log(JSON.stringify(out, null, 2));

if (tools.length === 0) {
  process.exit(1);
}
