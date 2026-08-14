/**
 * Node-function probe (EVM): Etherscan tokentx → Uniswap token list allow/review.
 *
 * Usage:
 *   ETHERSCAN_API_KEY=... npm run eth:node-tokens
 *   npm run eth:node-tokens -- USDC
 *
 * Does not touch Connexion. Key stays in .env.local (gitignored).
 * Create that file with `npm run env:local`, then paste ETHERSCAN_API_KEY.
 */
import { loadEnvFiles } from "./lib/load-env.mjs";
import {
  classifyEvmToken,
  etherscanApiKeyFromEnv,
  fetchEtherscanTokenTxs,
  fetchUniswapTokenList,
  findUniswapTokensBySymbol,
} from "../src/lib/evm-tokens.ts";

loadEnvFiles();

const OWNER = (process.env.NEXT_PUBLIC_ETH_WALLET_ADDRESS || "").trim();
const queryArg = (process.argv[2] || "").trim();
const apiKey = etherscanApiKeyFromEnv();

const list = await fetchUniswapTokenList();
if (!list.ok) {
  console.log(JSON.stringify({ uniswap: { ok: false, error: list.error, status: list.status ?? null } }, null, 2));
  process.exit(1);
}

const out: Record<string, unknown> = {
  chain: "ethereum",
  chainId: 1,
  address: OWNER || null,
  uniswapTokens: list.index.size,
};

if (queryArg) {
  out.query = queryArg;
  out.tokens = findUniswapTokensBySymbol(list.index, queryArg);
}

if (!apiKey) {
  out.etherscan = {
    ok: false,
    error: "Set ETHERSCAN_API_KEY in .env.local (https://etherscan.io/apidashboard)",
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(queryArg ? 0 : 2);
}

if (!OWNER) {
  out.etherscan = { ok: false, error: "NEXT_PUBLIC_ETH_WALLET_ADDRESS is not set" };
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

const txs = await fetchEtherscanTokenTxs(OWNER, apiKey);
if (!txs.ok) {
  out.etherscan = { ok: false, error: txs.error, status: txs.status ?? null };
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

out.etherscan = {
  ok: true,
  transfers: txs.transfers.length,
  tokens: txs.transfers.map((row) => classifyEvmToken(row, list.index)),
};

console.log(JSON.stringify(out, null, 2));
