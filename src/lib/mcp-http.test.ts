import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_SNS_MCP_URL,
  DEFAULT_VYBE_MCP_URL,
  SNS_MCP_URL_ENV,
  VYBE_MCP_URL_ENV,
  configuredSnsMcpUrl,
  configuredVybeMcpUrl,
  mcpToolJson,
  mcpToolText,
  parseMcpHttpUrl,
  parseMcpToolList,
} from "./mcp-http.ts";

test("parseMcpHttpUrl accepts the public SNS and Vybe endpoints", () => {
  const sns = parseMcpHttpUrl(DEFAULT_SNS_MCP_URL);
  const vybe = parseMcpHttpUrl(DEFAULT_VYBE_MCP_URL);
  assert.equal(sns.ok, true);
  assert.equal(vybe.ok, true);
  if (sns.ok) assert.equal(sns.url, DEFAULT_SNS_MCP_URL);
  if (vybe.ok) assert.equal(vybe.url, DEFAULT_VYBE_MCP_URL);
});

test("parseMcpHttpUrl accepts localhost http", () => {
  assert.equal(parseMcpHttpUrl("http://127.0.0.1:8989/mcp").ok, true);
});

test("parseMcpHttpUrl rejects unsafe or empty values", () => {
  assert.equal(parseMcpHttpUrl("").ok, false);
  assert.equal(parseMcpHttpUrl("not a url").ok, false);
  assert.equal(parseMcpHttpUrl("ftp://example.com/mcp").ok, false);
  assert.equal(parseMcpHttpUrl("https://user:pass@mcp.sns.id/mcp").ok, false);
  assert.equal(parseMcpHttpUrl("http://example.com/mcp").ok, false);
  assert.equal(parseMcpHttpUrl("javascript:alert(1)").ok, false);
});

test("parseMcpHttpUrl rejects non-strings", () => {
  assert.throws(() => parseMcpHttpUrl(null as unknown as string), /must be a string/);
});

test("configured MCP URLs use public defaults and valid overrides", () => {
  assert.equal(configuredSnsMcpUrl({}), DEFAULT_SNS_MCP_URL);
  assert.equal(configuredVybeMcpUrl({}), DEFAULT_VYBE_MCP_URL);
  assert.equal(
    configuredSnsMcpUrl({ [SNS_MCP_URL_ENV]: "https://mcp.example.test/mcp" }),
    "https://mcp.example.test/mcp",
  );
  assert.equal(configuredSnsMcpUrl({ [SNS_MCP_URL_ENV]: "not a url" }), DEFAULT_SNS_MCP_URL);
  assert.equal(configuredVybeMcpUrl({ [VYBE_MCP_URL_ENV]: "not a url" }), DEFAULT_VYBE_MCP_URL);
});

test("mcpToolText and mcpToolJson read the first text block", () => {
  const result = {
    content: [{ type: "text", text: '{"ok":true}' }],
  };
  assert.equal(mcpToolText(result), '{"ok":true}');
  assert.deepEqual(mcpToolJson(result), { ok: true });
});

test("mcpToolJson rejects missing or invalid JSON", () => {
  assert.throws(() => mcpToolJson({ content: [] }), /no text content/);
  assert.throws(() => mcpToolJson({ content: [{ type: "text", text: "not-json" }] }), /not valid JSON/);
});

test("parseMcpToolList keeps named tools", () => {
  const tools = parseMcpToolList({
    tools: [
      { name: "check_domains", description: "Check .sol domains" },
      { name: " ", description: "skip" },
      { description: "no name" },
    ],
  });
  assert.deepEqual(tools, [{ name: "check_domains", description: "Check .sol domains" }]);
});
