import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_SOLANA_RPC_URL,
  formatLamportsAsSol,
  parseSolanaRpcUrl,
  probeSolanaRpc,
} from "./solana-rpc.ts";

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

test("probeSolanaRpc reaches the default PublicNode endpoint", async () => {
  const probe = await probeSolanaRpc(DEFAULT_SOLANA_RPC_URL, "6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT");
  assert.equal(typeof probe.epoch, "number");
  assert.equal(typeof probe.absoluteSlot, "number");
  assert.equal(typeof probe.lamports, "number");
  assert.ok((probe.lamports ?? -1) >= 0);
});
