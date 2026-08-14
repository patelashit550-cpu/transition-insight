#!/usr/bin/env node
/**
 * Node-function probe: Etherscan tokentx → Uniswap default list → allow / review.
 *
 * Usage:
 *   ETHERSCAN_API_KEY=... npm run eth:node-tokens
 *
 * Does not touch Connexion. Key stays in .env.local (gitignored).
 */
import { loadEnvFiles } from "./lib/load-env.mjs";

import {
  ethNodeRouteDecision,
  etherscanApiKeyFromEnv,
  fetchEtherscanTokenTxs,
  fetchUniswapDefaultList,
  lookupUniswapToken,
  parseEthAddress,
  uniqueTokenContracts,
} from "../src/lib/eth-tokens.ts";

loadEnvFiles();

const ownerRaw = (process.env.NEXT_PUBLIC_ETH_WALLET_ADDRESS || "").trim();
const owner = parseEthAddress(ownerRaw);
const apiKey = etherscanApiKeyFromEnv();

if (!owner.ok) {
  console.error("Set NEXT_PUBLIC_ETH_WALLET_ADDRESS to a 0x address.");
  process.exit(1);
}

if (!apiKey) {
  console.error(
    "Set ETHERSCAN_API_KEY in .env.local (etherscan.io → API dashboard). Never NEXT_PUBLIC_*.",
  );
  process.exit(1);
}

console.error("Fetching Uniswap default list …");
const list = await fetchUniswapDefaultList();
if (!list.ok) {
  console.error(`eth:node-tokens failed: ${list.error}`);
  process.exit(1);
}

console.error(`Fetching Etherscan tokentx for ${owner.address} …`);
const txs = await fetchEtherscanTokenTxs(owner.address, apiKey);
if (!txs.ok) {
  console.error(`eth:node-tokens failed: ${txs.error}`);
  process.exit(1);
}

const contracts = uniqueTokenContracts(txs.txs);
const routes = contracts.map((contractAddress) => {
  const listed = lookupUniswapToken(contractAddress, list.tokens);
  return {
    contractAddress,
    symbol: listed?.symbol ?? txs.txs.find((tx) => tx.contractAddress.toLowerCase() === contractAddress.toLowerCase())?.tokenSymbol ?? null,
    name: listed?.name ?? null,
    decision: ethNodeRouteDecision(contractAddress, list.tokens),
  };
});

console.log(
  JSON.stringify(
    {
      chainId: 1,
      address: owner.address,
      etherscan: "tokentx",
      uniswapList: "https://tokens.uniswap.org",
      transfers: txs.txs.length,
      contracts: routes,
    },
    null,
    2,
  ),
);
