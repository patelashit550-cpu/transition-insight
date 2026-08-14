import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildJupiterMintQuery,
  jupiterApiKeyFromEnv,
  nodeRouteDecision,
  parseJupiterSearchPayload,
  parseJupiterToken,
  searchJupiterTokens,
  type JupiterTokenInfo,
} from "./jupiter-tokens.ts";

const verifiedJup: JupiterTokenInfo = {
  id: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  name: "Jupiter",
  symbol: "JUP",
  decimals: 6,
  isVerified: true,
  organicScore: 98,
  organicScoreLabel: "high",
  mintAuthorityDisabled: true,
  freezeAuthorityDisabled: true,
  isSus: false,
  tags: ["verified"],
};

test("jupiterApiKeyFromEnv rejects missing and placeholder keys", () => {
  assert.equal(jupiterApiKeyFromEnv({}), null);
  assert.equal(jupiterApiKeyFromEnv({ JUPITER_API_KEY: "YOUR_API_KEY" }), null);
  assert.equal(jupiterApiKeyFromEnv({ JUPITER_API_KEY: "  " }), null);
  assert.equal(jupiterApiKeyFromEnv({ JUPITER_API_KEY: "real-key" }), "real-key");
});

test("buildJupiterMintQuery dedupes and caps at 100", () => {
  assert.equal(buildJupiterMintQuery([" a ", "a", "b"]), "a,b");
  const many = Array.from({ length: 120 }, (_, i) => `mint${String(i).padStart(3, "0")}`);
  const query = buildJupiterMintQuery(many);
  assert.equal(query.split(",").length, 100);
});

test("parseJupiterToken reads verification and audit flags", () => {
  const token = parseJupiterToken({
    id: verifiedJup.id,
    name: "Jupiter",
    symbol: "JUP",
    decimals: 6,
    isVerified: true,
    organicScore: 98.08,
    organicScoreLabel: "high",
    tags: ["verified", "strict"],
    audit: {
      mintAuthorityDisabled: true,
      freezeAuthorityDisabled: true,
    },
  });
  assert.ok(token);
  assert.equal(token.symbol, "JUP");
  assert.equal(token.isVerified, true);
  assert.equal(token.mintAuthorityDisabled, true);
  assert.equal(token.isSus, false);
});

test("parseJupiterSearchPayload ignores junk rows", () => {
  const tokens = parseJupiterSearchPayload([
    { id: verifiedJup.id, name: "Jupiter", symbol: "JUP", decimals: 6, isVerified: true },
    { nope: true },
    null,
  ]);
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0]?.symbol, "JUP");
});

test("nodeRouteDecision allow/review/deny", () => {
  assert.equal(nodeRouteDecision(verifiedJup), "allow");
  assert.equal(nodeRouteDecision({ ...verifiedJup, isSus: true }), "deny");
  assert.equal(
    nodeRouteDecision({
      ...verifiedJup,
      isVerified: false,
      organicScoreLabel: "low",
    }),
    "deny",
  );
  assert.equal(
    nodeRouteDecision({
      ...verifiedJup,
      isVerified: true,
      mintAuthorityDisabled: false,
    }),
    "review",
  );
  assert.equal(
    nodeRouteDecision({
      ...verifiedJup,
      isVerified: null,
      organicScoreLabel: "medium",
      mintAuthorityDisabled: null,
      freezeAuthorityDisabled: null,
    }),
    "review",
  );
});

test("searchJupiterTokens sends x-api-key and parses the array", async () => {
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    assert.match(url, /tokens\/v2\/search\?query=JUP/);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("x-api-key"), "test-key");
    return new Response(
      JSON.stringify([
        {
          id: verifiedJup.id,
          name: "Jupiter",
          symbol: "JUP",
          decimals: 6,
          isVerified: true,
          organicScoreLabel: "high",
        },
      ]),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const result = await searchJupiterTokens("JUP", "test-key", fetchImpl);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const token = result.tokens[0];
  assert.ok(token);
  assert.equal(token.symbol, "JUP");
  assert.equal(nodeRouteDecision(token), "allow");
});

test("searchJupiterTokens maps 401", async () => {
  const fetchImpl: typeof fetch = async () => new Response("{}", { status: 401 });
  const result = await searchJupiterTokens("JUP", "bad", fetchImpl);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 401);
  }
});
