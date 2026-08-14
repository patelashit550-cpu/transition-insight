/**
 * LayerZero V2 Omnichain Fungible Token (OFT) — catalog only.
 *
 * This Next.js site is a static reader. OFT contracts, Hardhat/Foundry, and
 * Anchor programs belong in a sibling workspace, not in `package.json` here.
 * See `skills/layerzero-oft.md` and `ontology/governance/capital/OFT.md`.
 */

export const OFT_DOCS = {
  evmQuickstart: "https://docs.layerzero.network/v2/developers/evm/oft/quickstart",
  solanaOverview: "https://docs.layerzero.network/v2/developers/solana/oft/overview",
  solanaExample:
    "https://github.com/LayerZero-Labs/devtools/tree/main/examples/oft-solana",
  npmOftEvm: "https://www.npmjs.com/package/@layerzerolabs/oft-evm",
} as const;

export const OFT_INSTALL = {
  evmNewProject: "npx create-lz-oapp@latest --example oft",
  evmExisting: "npm install @layerzerolabs/oft-evm",
  solanaNewProject: "LZ_ENABLE_SOLANA_OFT_EXAMPLE=1 npx create-lz-oapp@latest",
} as const;

export type OftNetwork = "mainnet" | "testnet";

export type OftChain = "solana" | "ethereum" | "base" | "polygon";

export type OftEndpoint = {
  readonly chain: OftChain;
  readonly network: OftNetwork;
  readonly eid: number;
  readonly lzName: string;
};

/**
 * LayerZero V2 endpoint IDs for chains this corpus already names
 * (Solana + Ethereum holdings; Polygon Amoy in Why PoS; Base as the
 * common EVM OFT quickstart).
 *
 * Source: https://docs.layerzero.network/v2/developers/evm/oft/quickstart
 * and the Solana OFT example (mainnet 30168 / testnet 40168).
 */
export const OFT_ENDPOINTS: readonly OftEndpoint[] = [
  { chain: "solana", network: "mainnet", eid: 30168, lzName: "SOLANA_V2_MAINNET" },
  { chain: "solana", network: "testnet", eid: 40168, lzName: "SOLANA_V2_TESTNET" },
  { chain: "ethereum", network: "mainnet", eid: 30101, lzName: "ETHEREUM_V2_MAINNET" },
  { chain: "ethereum", network: "testnet", eid: 40161, lzName: "SEPOLIA_V2_TESTNET" },
  { chain: "base", network: "mainnet", eid: 30184, lzName: "BASE_V2_MAINNET" },
  { chain: "polygon", network: "testnet", eid: 40267, lzName: "AMOY_V2_TESTNET" },
];

const CHAINS: ReadonlySet<string> = new Set(["solana", "ethereum", "base", "polygon"]);
const NETWORKS: ReadonlySet<string> = new Set(["mainnet", "testnet"]);

function isOftChain(value: string): value is OftChain {
  return CHAINS.has(value);
}

function isOftNetwork(value: string): value is OftNetwork {
  return NETWORKS.has(value);
}

/**
 * Look up a LayerZero V2 endpoint ID for a chain this catalog knows.
 *
 * Returns `null` when the pair is absent (expected: Base has no testnet
 * row here; Polygon has no mainnet row here).
 */
export function oftEndpoint(chain: string, network: string): OftEndpoint | null {
  if (typeof chain !== "string" || typeof network !== "string") {
    throw new Error("chain and network must be strings");
  }
  const chainKey = chain.trim().toLowerCase();
  const networkKey = network.trim().toLowerCase();
  if (!isOftChain(chainKey) || !isOftNetwork(networkKey)) {
    return null;
  }
  return OFT_ENDPOINTS.find((row) => row.chain === chainKey && row.network === networkKey) ?? null;
}

export type OftWorkspaceKind = "evm-oft" | "solana-oft";

/**
 * Scaffold command for a **sibling** OFT workspace. Never run these in
 * this Next.js package — they create Hardhat/Anchor trees.
 */
export function oftScaffoldCommand(kind: OftWorkspaceKind): string {
  if (kind !== "evm-oft" && kind !== "solana-oft") {
    throw new Error("kind must be evm-oft or solana-oft");
  }
  return kind === "solana-oft" ? OFT_INSTALL.solanaNewProject : OFT_INSTALL.evmNewProject;
}

/**
 * This repo is the reading site, not an OFT contract workspace.
 * Installing `@layerzerolabs/oft-evm` here is always the wrong move.
 */
export function shouldInstallOftInThisRepo(): false {
  return false;
}

/**
 * Solana-first: Connexion already probes Solana RPC, and a Solana OFT
 * must deploy its own OFT Program so this jurisdiction keeps Upgrade Authority.
 */
export function preferredOftWorkspaceKind(): OftWorkspaceKind {
  return "solana-oft";
}
