/**
 * Solana transaction helpers on `@solana/web3.js` v1 + `@solana/spl-token`.
 *
 * Jupiter-style setup uses web3.js v1 (Kit / web3.js v2 is a different API).
 * This module builds Connection, ATA, and SPL instructions. It does not load
 * private keys and does not send transactions. Wallet loading lives in
 * `solana-wallet.ts` (Node / laptop only).
 */
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";

import { parseSolanaRpcUrl } from "./solana-rpc.ts";

/** Common mainnet mints used by local probes (not a token list). */
export const SPL_MINTS = {
  usdc: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  wsol: "So11111111111111111111111111111111111111112",
  jup: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
} as const;

export type SplMintSymbol = keyof typeof SPL_MINTS;

/**
 * Parse a base58 Solana address into a PublicKey.
 */
export function parseSolanaPublicKey(address: string): PublicKey {
  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error("Address is empty");
  }
  try {
    return new PublicKey(trimmed);
  } catch {
    throw new Error("Address is not a valid Solana public key");
  }
}

/**
 * Build a web3.js v1 Connection after the same RPC URL checks as Cord.
 *
 * Official `api.mainnet-beta.solana.com` often 403s from browsers; default
 * to the PublicNode URL already configured in env.
 */
export function createSolanaConnection(rpcUrl: string): Connection {
  const parsed = parseSolanaRpcUrl(rpcUrl);
  if (!parsed.ok) {
    throw new Error(parsed.error);
  }
  return new Connection(parsed.url, "confirmed");
}

/**
 * Associated token account for an owner and mint (Token program, not Token-2022).
 */
export function associatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner);
}

export type SplTransferCheckedArgs = {
  readonly source: PublicKey;
  readonly mint: PublicKey;
  readonly destination: PublicKey;
  readonly owner: PublicKey;
  readonly amount: bigint;
  readonly decimals: number;
};

/**
 * SPL `transferChecked` instruction. Does not sign or send.
 */
export function buildSplTransferCheckedInstruction(
  args: SplTransferCheckedArgs,
): TransactionInstruction {
  if (args.amount <= 0n) {
    throw new Error("Transfer amount must be positive");
  }
  if (!Number.isInteger(args.decimals) || args.decimals < 0 || args.decimals > 18) {
    throw new Error("Token decimals must be an integer between 0 and 18");
  }
  return createTransferCheckedInstruction(
    args.source,
    args.mint,
    args.destination,
    args.owner,
    args.amount,
    args.decimals,
  );
}

/**
 * Idempotent ATA create. Place in setup before a transfer when the dest ATA may not exist.
 */
export function buildCreateAtaIdempotentInstruction(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  const ata = associatedTokenAddress(owner, mint);
  return createAssociatedTokenAccountIdempotentInstruction(payer, ata, owner, mint);
}

export type SplTransferTransactionArgs = {
  readonly payer: PublicKey;
  readonly owner: PublicKey;
  readonly destinationOwner: PublicKey;
  readonly mint: PublicKey;
  readonly amount: bigint;
  readonly decimals: number;
  readonly recentBlockhash: string;
  readonly createDestinationAta?: boolean;
};

/**
 * Assemble an unsigned v1 Transaction: optional dest ATA create + transferChecked.
 * Caller must sign and send on the laptop.
 */
export function assembleSplTransferTransaction(args: SplTransferTransactionArgs): Transaction {
  const blockhash = args.recentBlockhash.trim();
  if (!blockhash) {
    throw new Error("recentBlockhash is empty");
  }

  const source = associatedTokenAddress(args.owner, args.mint);
  const destination = associatedTokenAddress(args.destinationOwner, args.mint);
  const tx = new Transaction();
  if (args.createDestinationAta) {
    tx.add(buildCreateAtaIdempotentInstruction(args.payer, args.destinationOwner, args.mint));
  }
  tx.add(
    buildSplTransferCheckedInstruction({
      source,
      mint: args.mint,
      destination,
      owner: args.owner,
      amount: args.amount,
      decimals: args.decimals,
    }),
  );
  tx.feePayer = args.payer;
  tx.recentBlockhash = blockhash;
  return tx;
}

/**
 * Latest confirmed blockhash from a Connection (needed to assemble a transaction).
 */
export async function latestBlockhash(connection: Connection): Promise<string> {
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  if (!blockhash) {
    throw new Error("RPC returned an empty blockhash");
  }
  return blockhash;
}

/**
 * Mint decimals via `@solana/spl-token` `getMint`.
 */
export async function mintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const account = await getMint(connection, mint);
  return account.decimals;
}
