import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ETH_MAINNET_CHAIN_ID,
  ethNodeRouteDecision,
  etherscanApiKeyFromEnv,
  fetchEtherscanTokenTxs,
  fetchUniswapDefaultList,
  lookupUniswapToken,
  parseEthAddress,
  parseEtherscanTokenTx,
  parseEtherscanTokentxPayload,
  parseUniswapTokenList,
  uniqueTokenContracts,
  type UniswapToken,
} from "./eth-tokens.ts";

const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const OWNER = "0x07C51282DFf9193584e9936316f88D0709D55490";
const UNKNOWN = "0x0000000000000000000000000000000000000bAd";

const usdcListToken: UniswapToken = {
  chainId: 1,
  address: USDC,
  name: "USD Coin",
  symbol: "USDC",
  decimals: 6,
};

const tokentxRow = {
  hash: "0xabc",
  from: OWNER,
  to: "0x1111111111111111111111111111111111111111",
  contractAddress: USDC,
  tokenName: "USD Coin",
  tokenSymbol: "USDC",
  tokenDecimal: "6",
  value: "1000000",
  timeStamp: "1700000000",
};

test("parseEthAddress accepts checksum and rejects junk", () => {
  assert.equal(parseEthAddress(` ${OWNER} `).ok, true);
  assert.equal(parseEthAddress("").ok, false);
  assert.equal(parseEthAddress("6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT").ok, false);
  assert.equal(parseEthAddress("0x123").ok, false);
});

test("etherscanApiKeyFromEnv rejects missing and placeholder keys", () => {
  assert.equal(etherscanApiKeyFromEnv({}), null);
  assert.equal(etherscanApiKeyFromEnv({ ETHERSCAN_API_KEY: "YourApiKeyToken" }), null);
  assert.equal(etherscanApiKeyFromEnv({ ETHERSCAN_API_KEY: "  " }), null);
  assert.equal(etherscanApiKeyFromEnv({ ETHERSCAN_API_KEY: "real-key" }), "real-key");
});

test("parseEtherscanTokenTx reads a tokentx row", () => {
  const tx = parseEtherscanTokenTx(tokentxRow);
  assert.ok(tx);
  assert.equal(tx.tokenSymbol, "USDC");
  assert.equal(tx.tokenDecimal, 6);
  assert.equal(tx.contractAddress, USDC);
});

test("parseEtherscanTokentxPayload treats no-transactions as empty ok", () => {
  const empty = parseEtherscanTokentxPayload({
    status: "0",
    message: "No transactions found",
    result: [],
  });
  assert.equal(empty.ok, true);
  if (empty.ok) assert.equal(empty.txs.length, 0);

  const bad = parseEtherscanTokentxPayload({
    status: "0",
    message: "NOTOK",
    result: "Invalid API Key",
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /Invalid API Key/);
});

test("uniqueTokenContracts dedupes by lowercase address", () => {
  const a = parseEtherscanTokenTx(tokentxRow);
  const b = parseEtherscanTokenTx({ ...tokentxRow, hash: "0xdef", contractAddress: USDC.toLowerCase() });
  const c = parseEtherscanTokenTx({ ...tokentxRow, hash: "0xeee", contractAddress: UNKNOWN });
  assert.ok(a && b && c);
  const unique = uniqueTokenContracts([a, b, c]);
  assert.equal(unique.length, 2);
});

test("ethNodeRouteDecision allow on Uniswap mainnet list, review otherwise", () => {
  const list = parseUniswapTokenList({
    tokens: [
      usdcListToken,
      { chainId: 10, address: UNKNOWN, name: "Nope", symbol: "NOPE", decimals: 18 },
    ],
  });
  assert.equal(ethNodeRouteDecision(USDC, list), "allow");
  assert.equal(ethNodeRouteDecision(USDC.toLowerCase(), list), "allow");
  assert.equal(ethNodeRouteDecision(UNKNOWN, list), "review");
  assert.equal(lookupUniswapToken(USDC, list)?.symbol, "USDC");
});

test("fetchEtherscanTokenTxs sends V2 tokentx params", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin + url.pathname, "https://api.etherscan.io/v2/api");
    assert.equal(url.searchParams.get("chainid"), String(ETH_MAINNET_CHAIN_ID));
    assert.equal(url.searchParams.get("module"), "account");
    assert.equal(url.searchParams.get("action"), "tokentx");
    assert.equal(url.searchParams.get("address"), OWNER);
    assert.equal(url.searchParams.get("apikey"), "test-key");
    return new Response(
      JSON.stringify({ status: "1", message: "OK", result: [tokentxRow] }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const result = await fetchEtherscanTokenTxs(OWNER, "test-key", fetchImpl);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.txs[0]?.tokenSymbol, "USDC");
});

test("fetchUniswapDefaultList parses tokens array", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    assert.equal(String(input), "https://tokens.uniswap.org");
    return new Response(JSON.stringify({ name: "Uniswap Labs Default", tokens: [usdcListToken] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const result = await fetchUniswapDefaultList(fetchImpl);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(ethNodeRouteDecision(USDC, result.tokens), "allow");
});

test("fetchUniswapDefaultList reaches the public list and includes USDC", async () => {
  const result = await fetchUniswapDefaultList();
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(ethNodeRouteDecision(USDC, result.tokens), "allow");
});
