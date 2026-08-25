/**
 * Node-function probe: recent txs on the published Solana owner → mints → Jupiter Tokens API.
 *
 * Usage:
 *   JUPITER_API_KEY=... npm run solana:node-tokens
 *   npm run solana:node-tokens -- JUP
 *
 * Does not touch Connexion. Key stays in .env.local (gitignored).
 * Create that file with `npm run env:local`, then paste JUPITER_API_KEY.
 */
import { loadEnvFiles } from "./lib/load-env.mjs";
import { configuredSolanaRpcUrl } from "../src/lib/solana-rpc.ts";
import { listRecentMintsForAddress } from "../src/lib/solana-mints.ts";
import {
  buildJupiterMintQuery,
  jupiterApiKeyFromEnv,
  nodeRouteDecision,
  searchJupiterTokens,
} from "../src/lib/jupiter-tokens.ts";

loadEnvFiles();

const OWNER = (process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS || "").trim();
const rpcUrl = configuredSolanaRpcUrl();
const queryArg = (process.argv[2] || "").trim();
const apiKey = jupiterApiKeyFromEnv();

const mintProbe = OWNER
  ? await listRecentMintsForAddress(rpcUrl, OWNER, 15)
  : { url: rpcUrl, address: "", signatures: [], mints: [], skipped: 0 };

const searchQuery = queryArg || buildJupiterMintQuery(mintProbe.mints);

const out: Record<string, unknown> = {
  rpc: mintProbe.url,
  address: mintProbe.address || null,
  signatures: mintProbe.signatures.length,
  skippedTransactions: mintProbe.skipped,
  mints: mintProbe.mints,
  jupiterQuery: searchQuery || null,
};

if (!apiKey) {
  out.jupiter = {
    ok: false,
    error: "Set JUPITER_API_KEY in .env.local (not YOUR_API_KEY, not NEXT_PUBLIC_*)",
  };
  console.log(JSON.stringify(out, null, 2));
  process.exit(2);
}

if (!searchQuery) {
  out.jupiter = { ok: true, tokens: [], note: "No SPL mints in recent txs; pass a query (e.g. JUP)" };
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const search = await searchJupiterTokens(searchQuery, apiKey);
if (!search.ok) {
  out.jupiter = { ok: false, error: search.error, status: search.status ?? null };
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

out.jupiter = {
  ok: true,
  tokens: search.tokens.map((token) => ({
    id: token.id,
    symbol: token.symbol,
    name: token.name,
    isVerified: token.isVerified,
    organicScoreLabel: token.organicScoreLabel,
    mintAuthorityDisabled: token.mintAuthorityDisabled,
    freezeAuthorityDisabled: token.freezeAuthorityDisabled,
    isSus: token.isSus,
    route: nodeRouteDecision(token),
  })),
};

console.log(JSON.stringify(out, null, 2));
