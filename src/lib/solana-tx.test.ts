import assert from "node:assert/strict";
import { test } from "node:test";

import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Keypair } from "@solana/web3.js";

import { DEFAULT_SOLANA_RPC_URL } from "./solana-rpc.ts";
import {
  SPL_MINTS,
  associatedTokenAddress,
  buildCreateAtaIdempotentInstruction,
  buildSplTransferCheckedInstruction,
  createSolanaConnection,
  latestBlockhash,
  parseSolanaPublicKey,
} from "./solana-tx.ts";

const OWNER = "6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT";

test("parseSolanaPublicKey accepts a known owner and rejects junk", () => {
  const key = parseSolanaPublicKey(` ${OWNER} `);
  assert.equal(key.toBase58(), OWNER);
  assert.throws(() => parseSolanaPublicKey(""), /empty/);
  assert.throws(() => parseSolanaPublicKey("not-a-key"), /not a valid Solana public key/);
});

test("createSolanaConnection reuses RPC URL validation", () => {
  assert.throws(() => createSolanaConnection(""), /empty/);
  assert.throws(() => createSolanaConnection("http://example.com"), /localhost/);
  const connection = createSolanaConnection(DEFAULT_SOLANA_RPC_URL);
  assert.equal(connection.rpcEndpoint, DEFAULT_SOLANA_RPC_URL);
});

test("associatedTokenAddress is stable for USDC and the owner", () => {
  const owner = parseSolanaPublicKey(OWNER);
  const mint = parseSolanaPublicKey(SPL_MINTS.usdc);
  const ata = associatedTokenAddress(owner, mint);
  assert.ok(ata.toBase58().length >= 32);
  assert.equal(ata.toBase58(), associatedTokenAddress(owner, mint).toBase58());
  assert.notEqual(ata.toBase58(), owner.toBase58());
});

test("buildSplTransferCheckedInstruction targets the Token program", () => {
  const owner = Keypair.generate().publicKey;
  const destOwner = Keypair.generate().publicKey;
  const mint = parseSolanaPublicKey(SPL_MINTS.usdc);
  const source = associatedTokenAddress(owner, mint);
  const destination = associatedTokenAddress(destOwner, mint);

  assert.throws(
    () =>
      buildSplTransferCheckedInstruction({
        source,
        mint,
        destination,
        owner,
        amount: 0n,
        decimals: 6,
      }),
    /positive/,
  );
  assert.throws(
    () =>
      buildSplTransferCheckedInstruction({
        source,
        mint,
        destination,
        owner,
        amount: 1n,
        decimals: 6.5,
      }),
    /decimals/,
  );

  const ix = buildSplTransferCheckedInstruction({
    source,
    mint,
    destination,
    owner,
    amount: 1_000_000n,
    decimals: 6,
  });
  assert.equal(ix.programId.toBase58(), TOKEN_PROGRAM_ID.toBase58());
  assert.ok(ix.keys.length >= 4);
});

test("buildCreateAtaIdempotentInstruction writes the derived ATA", () => {
  const payer = Keypair.generate().publicKey;
  const owner = parseSolanaPublicKey(OWNER);
  const mint = parseSolanaPublicKey(SPL_MINTS.usdc);
  const ata = associatedTokenAddress(owner, mint);
  const ix = buildCreateAtaIdempotentInstruction(payer, owner, mint);
  const writable = ix.keys.find((meta) => meta.pubkey.equals(ata));
  assert.equal(writable?.isWritable, true);
});

test("createSolanaConnection reaches PublicNode for a blockhash", async () => {
  const connection = createSolanaConnection(DEFAULT_SOLANA_RPC_URL);
  const blockhash = await latestBlockhash(connection);
  assert.equal(typeof blockhash, "string");
  assert.ok(blockhash.length > 20);
  const epoch = await connection.getEpochInfo();
  assert.equal(typeof epoch.epoch, "number");
});
