import assert from "node:assert/strict";
import { test } from "node:test";

import { extractMintsFromParsedTransaction } from "./solana-mints.ts";

const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const jup = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";

test("extractMintsFromParsedTransaction reads pre/post token balances", () => {
  const mints = extractMintsFromParsedTransaction({
    meta: {
      preTokenBalances: [{ mint: usdc, owner: "11111111111111111111111111111111" }],
      postTokenBalances: [
        { mint: usdc, owner: "11111111111111111111111111111111" },
        { mint: jup, owner: "11111111111111111111111111111111" },
      ],
    },
  });
  assert.deepEqual(mints, [usdc, jup].sort());
});

test("extractMintsFromParsedTransaction returns empty for native-only txs", () => {
  assert.deepEqual(extractMintsFromParsedTransaction({ meta: { preTokenBalances: [] } }), []);
  assert.deepEqual(extractMintsFromParsedTransaction(null), []);
  assert.deepEqual(extractMintsFromParsedTransaction({ meta: "nope" }), []);
});
