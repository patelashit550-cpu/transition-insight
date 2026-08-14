#!/usr/bin/env node
/**
 * Probe the configured (or CLI) Solana JSON-RPC endpoint.
 * Usage: node scripts/probe-solana-rpc.mjs [rpc-url]
 */
import { loadEnvFiles } from "./lib/load-env.mjs";

loadEnvFiles();

const DEFAULT_SOLANA_RPC_URL = "https://solana-rpc.publicnode.com";
const MAX_RPC_URL_LENGTH = 2048;
const OWNER = (process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS || "").trim();

function parseSolanaRpcUrl(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ok: false, error: "RPC URL is empty" };
  if (trimmed.length > MAX_RPC_URL_LENGTH) return { ok: false, error: "RPC URL is too long" };
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "RPC URL is not a valid URL" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: "RPC URL must be http or https" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: "RPC URL must not include username or password" };
  }
  if (!parsed.hostname) return { ok: false, error: "RPC URL is missing a host" };
  if (parsed.protocol === "http:" && parsed.hostname !== "127.0.0.1" && parsed.hostname !== "localhost") {
    return { ok: false, error: "http RPC is only allowed on localhost" };
  }
  parsed.hash = "";
  return { ok: true, url: parsed.toString().replace(/\/$/, "") };
}

function configuredSolanaRpcUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (typeof fromEnv !== "string") return DEFAULT_SOLANA_RPC_URL;
  const parsed = parseSolanaRpcUrl(fromEnv);
  return parsed.ok ? parsed.url : DEFAULT_SOLANA_RPC_URL;
}

async function jsonRpc(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`RPC ${method} failed (${response.status}): ${body.slice(0, 200)}`);
  }
  const payload = JSON.parse(body);
  if (payload.error) {
    throw new Error(payload.error.message || `RPC ${method} returned an error`);
  }
  return payload.result;
}

const cases = [
  ["", false],
  ["not a url", false],
  ["ftp://example.com", false],
  ["https://user:pass@rpc.example.com", false],
  ["http://example.com", false],
  ["http://127.0.0.1:8899", true],
  ["https://solana-rpc.publicnode.com", true],
  ["https://mainnet.helius-rpc.com/?api-key=demo", true],
];

let failed = 0;
for (const [input, expectOk] of cases) {
  const parsed = parseSolanaRpcUrl(input);
  if (parsed.ok !== expectOk) {
    failed += 1;
    console.error(`parse mismatch for ${JSON.stringify(input)}: expected ok=${expectOk} got`, parsed);
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log("parseSolanaRpcUrl: ok");

const argUrl = process.argv[2];
const parsedTarget = argUrl ? parseSolanaRpcUrl(argUrl) : { ok: true, url: configuredSolanaRpcUrl() };
if (!parsedTarget.ok) {
  console.error(parsedTarget.error);
  process.exit(1);
}

const url = parsedTarget.url;
const epoch = await jsonRpc(url, "getEpochInfo", []);
const out = {
  url,
  epoch: epoch.epoch,
  absoluteSlot: epoch.absoluteSlot,
  blockHeight: epoch.blockHeight,
};

if (OWNER) {
  const balance = await jsonRpc(url, "getBalance", [OWNER]);
  out.address = OWNER;
  out.lamports = typeof balance === "number" ? balance : balance.value;
}

console.log(JSON.stringify(out, null, 2));
