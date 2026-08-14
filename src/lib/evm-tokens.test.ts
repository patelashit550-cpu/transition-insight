import assert from "node:assert/strict";
import { test } from "node:test";

import {
  classifyEvmToken,
  etherscanApiKeyFromEnv,
  evmRouteDecision,
  extractContractsFromTokenTxs,
  fetchEtherscanTokenTxs,
  findUniswapTokensBySymbol,
  indexUniswapTokenList,
  parseEvmAddress,
  parseUniswapToken,
} from "./evm-tokens.ts";

const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

test("parseEvmAddress accepts checksum and rejects junk", () => {
  assert.equal(parseEvmAddress("0x07C51282DFf9193584e9936316f88D0709D55490"), "0x07c51282dff9193584e9936316f88d0709d55490");
  assert.equal(parseEvmAddress("not-an-address"), null);
  assert.equal(parseEvmAddress("0x123"), null);
});

test("etherscanApiKeyFromEnv rejects placeholders", () => {
  assert.equal(etherscanApiKeyFromEnv({}), null);
  assert.equal(etherscanApiKeyFromEnv({ ETHERSCAN_API_KEY: "YourApiKeyToken" }), null);
  assert.equal(etherscanApiKeyFromEnv({ ETHERSCAN_API_KEY: "real-key" }), "real-key");
});

test("indexUniswapTokenList keeps Ethereum mainnet tokens only", () => {
  const index = indexUniswapTokenList({
    tokens: [
      { chainId: 1, address: usdc, symbol: "USDC", name: "USD Coin", decimals: 6 },
      { chainId: 8453, address: usdc, symbol: "USDC", name: "USD Coin", decimals: 6 },
      { chainId: 1, address: "nope", symbol: "X", name: "X", decimals: 18 },
    ],
  });
  assert.equal(index.size, 1);
  const token = index.get(usdc);
  assert.ok(token);
  assert.equal(token.symbol, "USDC");
  assert.equal(token.route, "allow");
  assert.equal(findUniswapTokensBySymbol(index, "usdc").length, 1);
});

test("parseUniswapToken skips non-mainnet", () => {
  assert.equal(parseUniswapToken({ chainId: 10, address: usdc, symbol: "USDC", name: "USD Coin", decimals: 6 }), null);
});

test("extractContractsFromTokenTxs dedupes contract addresses", () => {
  const rows = extractContractsFromTokenTxs([
    {
      hash: "0xaaa",
      contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      tokenSymbol: "USDC",
      tokenName: "USD Coin",
      tokenDecimal: "6",
    },
    {
      hash: "0xbbb",
      contractAddress: usdc,
      tokenSymbol: "USDC",
      tokenName: "USD Coin",
      tokenDecimal: "6",
    },
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.contractAddress, usdc);
});

test("classifyEvmToken allow if listed else review", () => {
  const index = indexUniswapTokenList({
    tokens: [{ chainId: 1, address: usdc, symbol: "USDC", name: "USD Coin", decimals: 6 }],
  });
  const listed = classifyEvmToken(
    { hash: "0x1", contractAddress: usdc, symbol: "USDC", name: "USD Coin", decimals: 6 },
    index,
  );
  assert.equal(listed.route, "allow");
  const unknown = classifyEvmToken(
    {
      hash: "0x2",
      contractAddress: "0x0000000000000000000000000000000000000001",
      symbol: "SCAM",
      name: "Scam",
      decimals: 18,
    },
    index,
  );
  assert.equal(unknown.route, "review");
  assert.equal(evmRouteDecision(false), "review");
});

test("fetchEtherscanTokenTxs sends chainid=1 tokentx", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("chainid"), "1");
    assert.equal(url.searchParams.get("module"), "account");
    assert.equal(url.searchParams.get("action"), "tokentx");
    assert.equal(url.searchParams.get("apikey"), "test-key");
    return new Response(
      JSON.stringify({
        status: "1",
        message: "OK",
        result: [
          {
            hash: "0xabc",
            contractAddress: usdc,
            tokenSymbol: "USDC",
            tokenName: "USD Coin",
            tokenDecimal: "6",
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  const result = await fetchEtherscanTokenTxs(
    "0x07C51282DFf9193584e9936316f88D0709D55490",
    "test-key",
    fetchImpl,
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.transfers[0]?.symbol, "USDC");
  }
});
