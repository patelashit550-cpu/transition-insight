import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COLOSSEUM_COPILOT_API_BASE_ENV,
  COLOSSEUM_COPILOT_PAT_ENV,
  DEFAULT_COLOSSEUM_COPILOT_API_BASE,
  configuredCopilotApiBase,
  copilotAuthHeaders,
  copilotPatFromEnv,
  copilotUrl,
  parseCopilotApiBase,
  parseCopilotStatusPayload,
  probeCopilotStatus,
} from "./colosseum-copilot.ts";

test("parseCopilotApiBase accepts the public Colosseum default", () => {
  const parsed = parseCopilotApiBase(DEFAULT_COLOSSEUM_COPILOT_API_BASE);
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.url, DEFAULT_COLOSSEUM_COPILOT_API_BASE);
  }
});

test("parseCopilotApiBase strips trailing slashes", () => {
  const parsed = parseCopilotApiBase("https://copilot.colosseum.com/api/v1/");
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.url, DEFAULT_COLOSSEUM_COPILOT_API_BASE);
  }
});

test("parseCopilotApiBase accepts localhost http", () => {
  assert.equal(parseCopilotApiBase("http://127.0.0.1:8787/api/v1").ok, true);
});

test("parseCopilotApiBase rejects unsafe or empty values", () => {
  assert.equal(parseCopilotApiBase("").ok, false);
  assert.equal(parseCopilotApiBase("not a url").ok, false);
  assert.equal(parseCopilotApiBase("ftp://example.com").ok, false);
  assert.equal(parseCopilotApiBase("https://user:pass@copilot.colosseum.com/api/v1").ok, false);
  assert.equal(parseCopilotApiBase("http://example.com").ok, false);
  assert.equal(parseCopilotApiBase("javascript:alert(1)").ok, false);
});

test("parseCopilotApiBase rejects non-strings", () => {
  assert.throws(() => parseCopilotApiBase(null as unknown as string), /must be a string/);
});

test("configuredCopilotApiBase uses the public default when env is unset", () => {
  assert.equal(configuredCopilotApiBase({}), DEFAULT_COLOSSEUM_COPILOT_API_BASE);
});

test("configuredCopilotApiBase reads a valid override", () => {
  assert.equal(
    configuredCopilotApiBase({ [COLOSSEUM_COPILOT_API_BASE_ENV]: "https://copilot.example.test/api/v1" }),
    "https://copilot.example.test/api/v1",
  );
});

test("configuredCopilotApiBase falls back when the override is invalid", () => {
  assert.equal(
    configuredCopilotApiBase({ [COLOSSEUM_COPILOT_API_BASE_ENV]: "not a url" }),
    DEFAULT_COLOSSEUM_COPILOT_API_BASE,
  );
});

test("copilotPatFromEnv rejects placeholders", () => {
  assert.equal(copilotPatFromEnv({}), null);
  assert.equal(copilotPatFromEnv({ [COLOSSEUM_COPILOT_PAT_ENV]: "your-token-here" }), null);
  assert.equal(copilotPatFromEnv({ [COLOSSEUM_COPILOT_PAT_ENV]: "  " }), null);
  assert.equal(copilotPatFromEnv({ [COLOSSEUM_COPILOT_PAT_ENV]: "live-pat-value" }), "live-pat-value");
});

test("copilotUrl joins /status onto the default base", () => {
  assert.equal(copilotUrl("/status", DEFAULT_COLOSSEUM_COPILOT_API_BASE), `${DEFAULT_COLOSSEUM_COPILOT_API_BASE}/status`);
  assert.equal(copilotUrl("status", DEFAULT_COLOSSEUM_COPILOT_API_BASE), `${DEFAULT_COLOSSEUM_COPILOT_API_BASE}/status`);
});

test("copilotUrl rejects empty paths", () => {
  assert.throws(() => copilotUrl(""), /must not be empty/);
  assert.throws(() => copilotUrl("/"), /must not be empty/);
});

test("copilotAuthHeaders builds a Bearer token", () => {
  const headers = copilotAuthHeaders("live-pat-value");
  assert.equal(headers.Authorization, "Bearer live-pat-value");
  assert.equal(headers.Accept, "application/json");
});

test("copilotAuthHeaders rejects placeholders", () => {
  assert.throws(() => copilotAuthHeaders("your-token-here"), /PAT is missing/);
  assert.throws(() => copilotAuthHeaders(""), /PAT is missing/);
});

test("parseCopilotStatusPayload reads authenticated status", () => {
  const status = parseCopilotStatusPayload({
    authenticated: true,
    expiresAt: "2026-11-12T00:00:00.000Z",
    scope: "colosseum_copilot:read",
  });
  assert.deepEqual(status, {
    authenticated: true,
    expiresAt: "2026-11-12T00:00:00.000Z",
    scope: "colosseum_copilot:read",
  });
});

test("parseCopilotStatusPayload returns null for junk", () => {
  assert.equal(parseCopilotStatusPayload(null), null);
  assert.equal(parseCopilotStatusPayload({}), null);
  assert.equal(parseCopilotStatusPayload({ authenticated: "yes" }), null);
});

test("probeCopilotStatus parses an authenticated payload via fetchImpl", async () => {
  const fetchImpl = async (input: string, init?: { readonly headers?: Record<string, string> }) => {
    assert.equal(input, `${DEFAULT_COLOSSEUM_COPILOT_API_BASE}/status`);
    assert.equal(init?.headers?.Authorization, "Bearer live-pat-value");
    return new Response(
      JSON.stringify({
        authenticated: true,
        expiresAt: "2026-11-12T00:00:00.000Z",
        scope: "colosseum_copilot:read",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };

  const result = await probeCopilotStatus({
    apiBase: DEFAULT_COLOSSEUM_COPILOT_API_BASE,
    pat: "live-pat-value",
    fetchImpl,
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status.authenticated, true);
    assert.equal(result.status.scope, "colosseum_copilot:read");
  }
});

test("probeCopilotStatus without a PAT reaches the public API as 401", async () => {
  const result = await probeCopilotStatus({
    apiBase: DEFAULT_COLOSSEUM_COPILOT_API_BASE,
    pat: null,
  });
  assert.equal(result.url, `${DEFAULT_COLOSSEUM_COPILOT_API_BASE}/status`);
  assert.equal(result.ok, false);
  assert.equal(result.httpStatus, 401);
});
