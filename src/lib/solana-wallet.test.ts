import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import {
  keypairFromSecretKeyBase58,
  keypairFromSolanaCliFile,
  loadLocalSolanaWallet,
  walletEnvFromProcess,
} from "./solana-wallet.ts";

test("keypairFromSecretKeyBase58 round-trips a generated secret", () => {
  const generated = Keypair.generate();
  const encoded = bs58.encode(generated.secretKey);
  const loaded = keypairFromSecretKeyBase58(` ${encoded} `);
  assert.equal(loaded.publicKey.toBase58(), generated.publicKey.toBase58());
});

test("keypairFromSecretKeyBase58 accepts a 32-byte seed", () => {
  const seed = Keypair.generate().secretKey.slice(0, 32);
  const expected = Keypair.fromSeed(seed);
  const loaded = keypairFromSecretKeyBase58(bs58.encode(seed));
  assert.equal(loaded.publicKey.toBase58(), expected.publicKey.toBase58());
});

test("keypairFromSecretKeyBase58 rejects empty and wrong-length material", () => {
  assert.throws(() => keypairFromSecretKeyBase58(""), /empty/);
  assert.throws(() => keypairFromSecretKeyBase58("!!!"), /not valid base58/);
  const short = bs58.encode(new Uint8Array(16));
  assert.throws(() => keypairFromSecretKeyBase58(short), /32 or 64 bytes/);
});

test("keypairFromSolanaCliFile reads a 64-byte JSON array", () => {
  const generated = Keypair.generate();
  const dir = mkdtempSync(join(tmpdir(), "solana-wallet-"));
  const filePath = join(dir, "id.json");
  writeFileSync(filePath, JSON.stringify([...generated.secretKey]));
  const loaded = keypairFromSolanaCliFile(filePath);
  assert.equal(loaded.publicKey.toBase58(), generated.publicKey.toBase58());
});

test("loadLocalSolanaWallet prefers SOLANA_SIGNING_KEY then the CLI path", () => {
  assert.throws(() => loadLocalSolanaWallet({}), /SOLANA_SIGNING_KEY or SOLANA_KEYPAIR_PATH/);

  const generated = Keypair.generate();
  const fromEnv = loadLocalSolanaWallet({
    SOLANA_SIGNING_KEY: bs58.encode(generated.secretKey),
  });
  assert.equal(fromEnv.publicKey.toBase58(), generated.publicKey.toBase58());

  const other = Keypair.generate();
  const dir = mkdtempSync(join(tmpdir(), "solana-wallet-"));
  const filePath = join(dir, "id.json");
  writeFileSync(filePath, JSON.stringify([...other.secretKey]));
  const fromPath = loadLocalSolanaWallet({ SOLANA_KEYPAIR_PATH: filePath });
  assert.equal(fromPath.publicKey.toBase58(), other.publicKey.toBase58());
});

test("walletEnvFromProcess copies only the laptop key fields", () => {
  const generated = Keypair.generate();
  const env = walletEnvFromProcess({
    SOLANA_SIGNING_KEY: ` ${bs58.encode(generated.secretKey)} `,
    SOLANA_KEYPAIR_PATH: "  ",
    NEXT_PUBLIC_SOLANA_WALLET_ADDRESS: "should-not-become-a-secret",
  });
  assert.equal(typeof env.SOLANA_SIGNING_KEY, "string");
  assert.equal(env.SOLANA_KEYPAIR_PATH, undefined);
  const loaded = loadLocalSolanaWallet(env);
  assert.equal(loaded.publicKey.toBase58(), generated.publicKey.toBase58());
});
