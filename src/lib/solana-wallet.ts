/**
 * Load a Solana keypair on the laptop. Never import this from client components.
 *
 * Uses `SOLANA_SIGNING_KEY` (base58 secret, same as content attestation) or
 * `SOLANA_KEYPAIR_PATH` (Solana CLI JSON array). Do not put either in GitHub
 * Actions or `NEXT_PUBLIC_*`.
 */
import { readFileSync } from "node:fs";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export type SolanaWalletEnv = {
  readonly SOLANA_SIGNING_KEY?: string;
  readonly SOLANA_KEYPAIR_PATH?: string;
};

function envString(value: string | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Decode a base58 Solana secret (64-byte secret key or 32-byte seed).
 */
export function keypairFromSecretKeyBase58(secret: string): Keypair {
  const trimmed = secret.trim();
  if (!trimmed) {
    throw new Error("Secret key is empty");
  }

  let bytes: Uint8Array;
  try {
    bytes = bs58.decode(trimmed);
  } catch {
    throw new Error("Secret key is not valid base58");
  }

  if (bytes.length === 64) {
    return Keypair.fromSecretKey(bytes);
  }
  if (bytes.length === 32) {
    return Keypair.fromSeed(bytes);
  }
  throw new Error("Solana secret key must be 32 or 64 bytes");
}

/**
 * Load a Solana CLI id.json (JSON array of 64 numbers).
 */
export function keypairFromSolanaCliFile(filePath: string): Keypair {
  const trimmed = filePath.trim();
  if (!trimmed) {
    throw new Error("Keypair path is empty");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(trimmed, "utf8"));
  } catch {
    throw new Error("Keypair file is missing or not valid JSON");
  }

  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error("Keypair file must be a JSON array of 64 bytes");
  }

  const bytes = new Uint8Array(64);
  for (let i = 0; i < 64; i += 1) {
    const value = parsed[i];
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error("Keypair file contains a non-byte value");
    }
    bytes[i] = value;
  }
  return Keypair.fromSecretKey(bytes);
}

/**
 * Read wallet env keys without assigning the whole ProcessEnv (weak type).
 */
export function walletEnvFromProcess(env: NodeJS.ProcessEnv = process.env): SolanaWalletEnv {
  return {
    SOLANA_SIGNING_KEY: envString(env.SOLANA_SIGNING_KEY),
    SOLANA_KEYPAIR_PATH: envString(env.SOLANA_KEYPAIR_PATH),
  };
}

/**
 * Load the local development wallet. Throws if neither env source is set.
 */
export function loadLocalSolanaWallet(env: SolanaWalletEnv = walletEnvFromProcess()): Keypair {
  const fromEnv = envString(env.SOLANA_SIGNING_KEY);
  if (fromEnv) {
    return keypairFromSecretKeyBase58(fromEnv);
  }

  const fromPath = envString(env.SOLANA_KEYPAIR_PATH);
  if (fromPath) {
    return keypairFromSolanaCliFile(fromPath);
  }

  throw new Error("Set SOLANA_SIGNING_KEY or SOLANA_KEYPAIR_PATH on the laptop");
}
