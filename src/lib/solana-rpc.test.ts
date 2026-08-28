import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_SOLANA_RPC_URL,
  formatLamportsAsSol,
  isSharedPublicSolanaRpc,
  parseSolanaRpcUrl,
  probeOwnerAddress,
  probeSolanaRpc,
  probeSolanaRpcForSite,
} from "./solana-rpc.ts";
import { CORPUS_SOLANA_ADDRESS } from "./public-identity.ts";

test("parseSolanaRpcUrl accepts https and localhost http", () => {
  assert.equal(parseSolanaRpcUrl("https://solana-rpc.publicnode.com").ok, true);
  assert.equal(parseSolanaRpcUrl("http://127.0.0.1:8899").ok, true);
  assert.equal(parseSolanaRpcUrl("https://mainnet.helius-rpc.com/?api-key=demo").ok, true);
});

test("parseSolanaRpcUrl rejects unsafe or empty values", () => {
  assert.equal(parseSolanaRpcUrl("").ok, false);
  assert.equal(parseSolanaRpcUrl("not a url").ok, false);
  assert.equal(parseSolanaRpcUrl("ftp://example.com").ok, false);
  assert.equal(parseSolanaRpcUrl("https://user:pass@rpc.example.com").ok, false);
  assert.equal(parseSolanaRpcUrl("http://example.com").ok, false);
  assert.equal(parseSolanaRpcUrl("javascript:alert(1)").ok, false);
});

test("formatLamportsAsSol trims trailing zeros", () => {
  assert.equal(formatLamportsAsSol(0), "0");
  assert.equal(formatLamportsAsSol(1_000_000_000), "1");
  assert.equal(formatLamportsAsSol(2_049_280), "0.002049");
});

test("isSharedPublicSolanaRpc matches PublicNode hosts only", () => {
  assert.equal(isSharedPublicSolanaRpc("https://solana-rpc.publicnode.com"), true);
  assert.equal(isSharedPublicSolanaRpc("https://solana.publicnode.com/"), true);
  assert.equal(isSharedPublicSolanaRpc("https://mainnet.helius-rpc.com/?api-key=demo"), false);
  assert.equal(isSharedPublicSolanaRpc("http://127.0.0.1:8899"), false);
  assert.equal(isSharedPublicSolanaRpc("not a url"), false);
});

test("probeOwnerAddress strips the wallet on shared public gateways", () => {
  const owner = CORPUS_SOLANA_ADDRESS;
  assert.equal(probeOwnerAddress("https://solana-rpc.publicnode.com", owner), undefined);
  assert.equal(probeOwnerAddress("https://mainnet.helius-rpc.com/?api-key=demo", owner), owner);
  assert.equal(probeOwnerAddress("https://mainnet.helius-rpc.com/?api-key=demo", "  "), undefined);
});

test("probeSolanaRpcForSite does not fetch balance from PublicNode", async () => {
  const owner = CORPUS_SOLANA_ADDRESS;
  const probe = await probeSolanaRpcForSite(DEFAULT_SOLANA_RPC_URL, owner);
  assert.equal(typeof probe.epoch, "number");
  assert.equal(typeof probe.absoluteSlot, "number");
  assert.equal(probe.lamports, null);
  assert.equal(probe.sol, null);
  assert.equal(isSharedPublicSolanaRpc(probe.url), true);
});

test("probeSolanaRpc still reaches PublicNode for epoch info", async () => {
  const probe = await probeSolanaRpc(DEFAULT_SOLANA_RPC_URL);
  assert.equal(typeof probe.epoch, "number");
  assert.equal(typeof probe.absoluteSlot, "number");
  assert.equal(probe.lamports, null);
});
