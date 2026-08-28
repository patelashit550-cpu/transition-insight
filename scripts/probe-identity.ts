/**
 * Containment probe: committed public identity, live SNS records, optional balances.
 *
 *   npm run audit:identity
 *   npm run audit:identity -- --env-only
 *   npm run audit:identity -- --sns-only --json
 *
 * Exit 1 when any finding is fail. MCP/RPC outages are warn.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { loadEnvFiles } from "./lib/load-env.mjs";
import {
  CORPUS_SOLANA_ADDRESS,
  PUBLIC_IDENTITY_ENV,
  SNS_DOMAIN,
  assertPubkeyIsCorpusWallet,
  evaluateSnsContainment,
  ipfsCidFromEnv,
  publicIdentityDriftFromEnv,
  publicIdentityDriftFromEnvFile,
  snsIpfsPublishPlan,
  solanaWalletsToInventory,
  tokenPullInSteps,
  type SnsContainmentFinding,
} from "../src/lib/public-identity.ts";
import { SNS_SITE_DOMAIN, getSnsDomainRecords } from "../src/lib/sns-mcp.ts";
import { configuredSolanaRpcUrl, DEFAULT_SOLANA_RPC_URL } from "../src/lib/solana-rpc.ts";
import { createSolanaConnection, parseSolanaPublicKey } from "../src/lib/solana-tx.ts";
import { loadLocalSolanaWallet } from "../src/lib/solana-wallet.ts";

loadEnvFiles();

const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const envOnly = args.has("--env-only");
const snsOnly = args.has("--sns-only");
const noBalances = args.has("--no-balances");
const wantEnv = !snsOnly;
const wantSns = !envOnly;
const wantBalances = wantSns && !noBalances;

type ProbeFinding = {
  readonly level: "ok" | "warn" | "fail";
  readonly code: string;
  readonly message: string;
};

type WalletBalance = {
  readonly role: string;
  readonly address: string;
  readonly lamports: number | null;
  readonly tokens: readonly { mint: string; amount: string; decimals: number }[];
  readonly error: string | null;
};

function finding(level: ProbeFinding["level"], code: string, message: string): ProbeFinding {
  return { level, code, message };
}

function envFileFindings(): ProbeFinding[] {
  const out: ProbeFinding[] = [];
  for (const name of [".env.production", ".env.development"] as const) {
    const full = join(process.cwd(), name);
    if (!existsSync(full)) {
      out.push(finding("fail", "env-file-missing", `${name} is missing`));
      continue;
    }
    const drift = publicIdentityDriftFromEnvFile(readFileSync(full, "utf8"));
    if (drift.length === 0) {
      out.push(finding("ok", "env-file", `${name} matches canonical public identity`));
      continue;
    }
    for (const row of drift) {
      out.push(
        finding(
          "fail",
          "env-file-drift",
          `${name} ${row.key}=${row.actual} (expected ${row.expected})`,
        ),
      );
    }
  }
  return out;
}

function processEnvFindings(): ProbeFinding[] {
  const drift = publicIdentityDriftFromEnv(process.env);
  if (drift.length === 0) {
    return [finding("ok", "process-env", "loaded env public keys match canonical identity (unset keys skipped)")];
  }
  return drift.map((row) =>
    finding("fail", "process-env-drift", `${row.key}=${row.actual} (expected ${row.expected})`),
  );
}

function signerFindings(): ProbeFinding[] {
  try {
    const wallet = loadLocalSolanaWallet();
    const pubkey = wallet.publicKey.toBase58();
    try {
      assertPubkeyIsCorpusWallet(pubkey);
      return [finding("ok", "signing-key", `SOLANA_SIGNING_KEY / keypair is the corpus wallet ${pubkey}`)];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return [finding("fail", "signing-key-mismatch", message)];
    }
  } catch {
    return [
      finding(
        "warn",
        "signing-key-absent",
        "No SOLANA_SIGNING_KEY / SOLANA_KEYPAIR_PATH in .env.local — required to sign attestation and SNS record txs",
      ),
    ];
  }
}

async function snsFindings(): Promise<{
  findings: ProbeFinding[];
  registrant: string | null;
  records: Readonly<Record<string, string>>;
}> {
  try {
    const records = await getSnsDomainRecords(SNS_SITE_DOMAIN);
    const mapped: ProbeFinding[] = evaluateSnsContainment(records, {
      expectedIpfsCid: ipfsCidFromEnv(process.env),
    }).map((row: SnsContainmentFinding) => ({
      level: row.level,
      code: row.code,
      message: row.message,
    }));
    return { findings: mapped, registrant: records.key, records: records.records };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      findings: [
        finding("warn", "sns-mcp-outage", `SNS MCP unavailable (${message}) — containment not verified live`),
      ],
      registrant: null,
      records: {},
    };
  }
}

async function walletBalances(registrant: string | null): Promise<readonly WalletBalance[]> {
  const wallets = solanaWalletsToInventory(registrant);
  const rpcUrl = configuredSolanaRpcUrl() || DEFAULT_SOLANA_RPC_URL;
  let connection;
  try {
    connection = createSolanaConnection(rpcUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return wallets.map((wallet) => ({
      role: wallet.role,
      address: wallet.address,
      lamports: null,
      tokens: [],
      error: message,
    }));
  }

  const rows: WalletBalance[] = [];
  for (const wallet of wallets) {
    try {
      const pubkey = parseSolanaPublicKey(wallet.address);
      const lamports = await connection.getBalance(pubkey, "confirmed");
      const parsed = await connection.getParsedTokenAccountsByOwner(pubkey, { programId: TOKEN_PROGRAM });
      const tokens = parsed.value
        .map((entry) => {
          const info = entry.account.data.parsed?.info as
            | { mint?: string; tokenAmount?: { uiAmountString?: string; decimals?: number; amount?: string } }
            | undefined;
          const amount = info?.tokenAmount?.uiAmountString || info?.tokenAmount?.amount || "0";
          if (amount === "0") return null;
          return {
            mint: info?.mint || "",
            amount,
            decimals: info?.tokenAmount?.decimals ?? 0,
          };
        })
        .filter((row): row is { mint: string; amount: string; decimals: number } => Boolean(row?.mint));
      rows.push({ role: wallet.role, address: wallet.address, lamports, tokens, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rows.push({
        role: wallet.role,
        address: wallet.address,
        lamports: null,
        tokens: [],
        error: message,
      });
    }
  }
  return rows;
}

const TOKEN_PROGRAM = parseSolanaPublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const findings: ProbeFinding[] = [];
let registrant: string | null = null;
let records: Readonly<Record<string, string>> = {};
let balances: readonly WalletBalance[] = [];

if (wantEnv) {
  findings.push(...envFileFindings());
  findings.push(...processEnvFindings());
  findings.push(...signerFindings());
}

if (wantSns) {
  const sns = await snsFindings();
  findings.push(...sns.findings);
  registrant = sns.registrant;
  records = sns.records;
  if (wantBalances) {
    balances = await walletBalances(registrant);
  }
}

const cid = ipfsCidFromEnv(process.env);
const pullIn = tokenPullInSteps(registrant, cid);
const ipfsPlan = snsIpfsPublishPlan(cid);
const inventory = solanaWalletsToInventory(registrant);
const failed = findings.some((row) => row.level === "fail");

const report = {
  domain: SNS_DOMAIN,
  corpus: CORPUS_SOLANA_ADDRESS,
  publicIdentity: PUBLIC_IDENTITY_ENV,
  ipfsCid: cid,
  sns: { registrant, records },
  inventory,
  balances,
  ipfsPlan,
  pullIn,
  findings,
};

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Identity audit  domain=${SNS_DOMAIN}  corpus=${CORPUS_SOLANA_ADDRESS}`);
  console.log("");
  for (const row of findings) {
    console.log(`${row.level.toUpperCase().padEnd(4)}  [${row.code}] ${row.message}`);
  }
  if (inventory.length) {
    console.log("");
    console.log("wallets to inventory (sweep non-treasury into corpus):");
    for (const wallet of inventory) {
      const held = balances.find((row) => row.address === wallet.address);
      const sol =
        held && held.lamports !== null ? `  sol=${held.lamports / 1_000_000_000}` : "";
      const tokenNote = held?.tokens.length ? `  spl=${held.tokens.length}` : "";
      const err = held?.error ? `  (${held.error})` : "";
      console.log(`  - ${wallet.role}  ${wallet.address}${sol}${tokenNote}${err}`);
    }
  }
  console.log("");
  console.log("IPFS → transition-insight.sol.site:");
  for (const step of ipfsPlan) {
    console.log(`  • ${step}`);
  }
  if (failed) {
    console.log("");
    console.log("to pull tokens / name back into transition-insight.sol:");
    for (const step of pullIn) {
      console.log(`  • ${step}`);
    }
  }
}

if (failed) {
  process.exit(1);
}
