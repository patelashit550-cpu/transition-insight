#!/usr/bin/env node
/**
 * Local transaction-management probe: web3.js v1 Connection + optional wallet.
 * Does not send a transaction.
 *
 * Usage: node --experimental-strip-types scripts/probe-solana-tx.ts [rpc-url]
 */
import { loadEnvFiles } from "./lib/load-env.mjs";

import { configuredSolanaRpcUrl, DEFAULT_SOLANA_RPC_URL } from "../src/lib/solana-rpc.ts";
import {
  SPL_MINTS,
  associatedTokenAddress,
  createSolanaConnection,
  latestBlockhash,
  mintDecimals,
  parseSolanaPublicKey,
} from "../src/lib/solana-tx.ts";
import { loadLocalSolanaWallet } from "../src/lib/solana-wallet.ts";

loadEnvFiles();

const argUrl = process.argv[2];
const rpcUrl = argUrl?.trim() || configuredSolanaRpcUrl() || DEFAULT_SOLANA_RPC_URL;
const connection = createSolanaConnection(rpcUrl);
const epoch = await connection.getEpochInfo();
const blockhash = await latestBlockhash(connection);
const usdcMint = parseSolanaPublicKey(SPL_MINTS.usdc);

const ownerAddress = (process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS || "").trim();
const out: Record<string, unknown> = {
  rpc: connection.rpcEndpoint,
  epoch: epoch.epoch,
  absoluteSlot: epoch.absoluteSlot,
  blockhash,
  web3: "@solana/web3.js@1",
  splToken: "@solana/spl-token",
  usdcDecimals: await mintDecimals(connection, usdcMint),
};

if (ownerAddress) {
  const owner = parseSolanaPublicKey(ownerAddress);
  out.owner = owner.toBase58();
  out.usdcAta = associatedTokenAddress(owner, usdcMint).toBase58();
}

try {
  const wallet = loadLocalSolanaWallet();
  out.wallet = wallet.publicKey.toBase58();
} catch {
  out.wallet = null;
}

console.log(JSON.stringify(out, null, 2));
