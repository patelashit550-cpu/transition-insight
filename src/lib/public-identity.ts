/**
 * Canonical **public** identity for Transition Insight.
 *
 * Public values may ship in the static build (`NEXT_PUBLIC_*`). They are not
 * secrets. The matching Solana private key (`SOLANA_SIGNING_KEY`) stays on the
 * laptop and is the signing identity for the whole application (attestation,
 * SNS record updates, SPL transfers into the corpus treasury).
 *
 * Local (`next dev`) and global (IPFS / optional Pages mirror) share this
 * public set. Content tier only changes which essays ship — not which keys.
 *
 * Public origin is IPFS, reached at `transition-insight.sol.site`. GitHub Pages
 * (`ashitmilne.xyz`) is an optional mirror and is not canonical.
 */

/** Bonfida / IPFS gateway — the live public origin. */
export const CANONICAL_SITE_URL = "https://transition-insight.sol.site";

export const SNS_DOMAIN = "transition-insight.sol";
export const SOL_SITE_URL = CANONICAL_SITE_URL;

/** Optional GitHub Pages hostname. Down does not take the corpus offline. */
export const PAGES_MIRROR_URL = "https://ashitmilne.xyz";

/** Corpus Solana treasury / DID / Cord owner — must match SNS SOL record. */
export const CORPUS_SOLANA_ADDRESS = "6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT";

/** Related-person ETH account (ENS). Not the Solana treasury. */
export const CORPUS_ETH_ADDRESS = "0x07C51282DFf9193584e9936316f88D0709D55490";

export const CORPUS_ENS_DOMAIN = "ashitpatel.eth";

/** Related-person BTC address. Cannot hold SPL; optional SNS BTC record. */
export const CORPUS_BTC_ADDRESS = "3P2eUwTBnmoDGq22QYFB2cX6TsVV38rJwh";

export const CORPUS_DID = `did:pkh:solana:${CORPUS_SOLANA_ADDRESS}`;

/** Gateway hostname for sol.site CNAME when serving via DNSLink. */
export const SOL_SITE_IPFS_CNAME_TARGET = "cloudflare-ipfs.com";

export const PUBLIC_IDENTITY_ENV = {
  NEXT_PUBLIC_SITE_URL: CANONICAL_SITE_URL,
  NEXT_PUBLIC_SNS_DOMAIN: SNS_DOMAIN,
  NEXT_PUBLIC_SOL_SITE_URL: SOL_SITE_URL,
  NEXT_PUBLIC_SOLANA_WALLET_ADDRESS: CORPUS_SOLANA_ADDRESS,
  NEXT_PUBLIC_ETH_WALLET_ADDRESS: CORPUS_ETH_ADDRESS,
  NEXT_PUBLIC_ENS_DOMAIN: CORPUS_ENS_DOMAIN,
  NEXT_PUBLIC_BTC_WALLET_ADDRESS: CORPUS_BTC_ADDRESS,
} as const;

export type PublicIdentityEnvKey = keyof typeof PUBLIC_IDENTITY_ENV;

export type EnvLike = Record<string, string | undefined>;

export type IdentityDrift = {
  readonly key: PublicIdentityEnvKey;
  readonly expected: string;
  readonly actual: string;
};

/**
 * Strip `ipfs://`, `/ipfs/`, trailing slashes. Bonfida stores CID only.
 */
export function normalizeIpfsCid(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  if (!value) return null;
  value = value.replace(/^ipfs:\/\//i, "");
  value = value.replace(/^\/ipfs\//i, "");
  const cut = value.search(/[/?#]/);
  if (cut !== -1) value = value.slice(0, cut);
  value = value.replace(/\/$/, "");
  return value || null;
}

export function ipfsCidFromEnv(env: EnvLike = {}): string | null {
  return normalizeIpfsCid(env.NEXT_PUBLIC_IPFS_CID) || normalizeIpfsCid(env.IPFS_CID);
}

/**
 * SNS records that make `transition-insight.sol` resolve to this corpus.
 * Bonfida prefers URL over IPFS — do not set URL to the Pages mirror.
 */
export function expectedSnsRecords(ipfsCid?: string | null): Readonly<Record<string, string>> {
  const records: Record<string, string> = {
    SOL: CORPUS_SOLANA_ADDRESS,
    ETH: CORPUS_ETH_ADDRESS,
    BTC: CORPUS_BTC_ADDRESS,
  };
  const cid = normalizeIpfsCid(ipfsCid ?? null);
  if (cid) records.IPFS = cid;
  return records;
}

export function readEnvAssignment(text: string, key: string): string | null {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() !== key) continue;
    return trimmed.slice(eq + 1).trim();
  }
  return null;
}

export function publicIdentityDriftFromEnvFile(text: string): IdentityDrift[] {
  const drift: IdentityDrift[] = [];
  for (const key of Object.keys(PUBLIC_IDENTITY_ENV) as PublicIdentityEnvKey[]) {
    const actual = readEnvAssignment(text, key);
    const expected = PUBLIC_IDENTITY_ENV[key];
    if (actual === null) {
      drift.push({ key, expected, actual: "(missing)" });
      continue;
    }
    if (actual !== expected) {
      drift.push({ key, expected, actual });
    }
  }
  return drift;
}

export function publicIdentityDriftFromEnv(env: EnvLike): IdentityDrift[] {
  const drift: IdentityDrift[] = [];
  for (const key of Object.keys(PUBLIC_IDENTITY_ENV) as PublicIdentityEnvKey[]) {
    const raw = env[key];
    const actual = typeof raw === "string" ? raw.trim() : "";
    const expected = PUBLIC_IDENTITY_ENV[key];
    if (!actual) continue;
    if (actual !== expected) {
      drift.push({ key, expected, actual });
    }
  }
  return drift;
}

function recordMapLower(records: Readonly<Record<string, string>>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(records)) {
    const normalized = key.trim().toLowerCase();
    const trimmed = value.trim();
    if (!normalized || !trimmed) continue;
    map.set(normalized, trimmed);
  }
  return map;
}

export type SnsContainmentFinding = {
  readonly level: "ok" | "warn" | "fail";
  readonly code: string;
  readonly message: string;
};

export type SnsContainmentOptions = {
  readonly expectedIpfsCid?: string | null;
};

/**
 * Compare live SNS registrant + records to the canonical public identity.
 * `key` is the domain owner pubkey from `get_domain_records`.
 */
export function evaluateSnsContainment(
  input: {
    readonly key: string | null;
    readonly records: Readonly<Record<string, string>>;
  },
  options: SnsContainmentOptions = {},
): readonly SnsContainmentFinding[] {
  const findings: SnsContainmentFinding[] = [];
  const owner = input.key?.trim() || null;
  const records = recordMapLower(input.records);
  const expectedCid = normalizeIpfsCid(options.expectedIpfsCid ?? null);

  if (!owner) {
    findings.push({
      level: "warn",
      code: "sns-owner-unknown",
      message: "SNS did not return a registrant pubkey",
    });
  } else if (owner !== CORPUS_SOLANA_ADDRESS) {
    findings.push({
      level: "fail",
      code: "sns-owner-mismatch",
      message: `SNS registrant ${owner} is not the corpus wallet ${CORPUS_SOLANA_ADDRESS}. Tokens paid to the advertised DID do not land in the name owner, and only the registrant can set IPFS/SOL records.`,
    });
  } else {
    findings.push({
      level: "ok",
      code: "sns-owner",
      message: `SNS registrant is the corpus wallet ${CORPUS_SOLANA_ADDRESS}`,
    });
  }

  const url = records.get("url") || null;
  if (url) {
    const bare = url.replace(/\/$/, "");
    if (/ashitmilne\.xyz/i.test(url)) {
      findings.push({
        level: "fail",
        code: "sns-url-pages-mirror",
        message: `SNS URL record is ${url}. Bonfida prefers URL over IPFS, and ${PAGES_MIRROR_URL} is a 404 Pages mirror — this blocks ${CANONICAL_SITE_URL}. Clear the URL record and set IPFS.`,
      });
    } else if (bare === CANONICAL_SITE_URL) {
      findings.push({
        level: "warn",
        code: "sns-url-circular",
        message: "SNS URL record points at sol.site (circular). Prefer on-chain IPFS plus Configure Sol.site CNAME + _dnslink.",
      });
    }
  }

  const ipfs = normalizeIpfsCid(records.get("ipfs") || records.get("ipfs\0"));
  if (!ipfs) {
    findings.push({
      level: "fail",
      code: "sns-ipfs-missing",
      message: `SNS IPFS record is empty — ${CANONICAL_SITE_URL} stays a Bonfida profile. Pin the global export and set IPFS to the CID (CID only).`,
    });
  } else if (expectedCid && ipfs !== expectedCid) {
    findings.push({
      level: "fail",
      code: "sns-ipfs-mismatch",
      message: `SNS IPFS record is ${ipfs} — expected ${expectedCid} (NEXT_PUBLIC_IPFS_CID).`,
    });
  } else {
    findings.push({
      level: "ok",
      code: "sns-ipfs",
      message: `SNS IPFS record is ${ipfs}`,
    });
  }

  const sol = records.get("sol") || null;
  if (!sol) {
    findings.push({
      level: "fail",
      code: "sns-sol-missing",
      message: `SNS SOL record is empty — pay-to-name will not hit ${CORPUS_SOLANA_ADDRESS}. Set SOL to that pubkey.`,
    });
  } else if (sol !== CORPUS_SOLANA_ADDRESS) {
    findings.push({
      level: "fail",
      code: "sns-sol-mismatch",
      message: `SNS SOL record is ${sol} — expected ${CORPUS_SOLANA_ADDRESS}`,
    });
  } else {
    findings.push({
      level: "ok",
      code: "sns-sol",
      message: "SNS SOL record matches the corpus wallet",
    });
  }

  const eth = records.get("eth") || null;
  if (eth && eth.toLowerCase() !== CORPUS_ETH_ADDRESS.toLowerCase()) {
    findings.push({
      level: "warn",
      code: "sns-eth-mismatch",
      message: `SNS ETH record is ${eth} — related identity is ${CORPUS_ETH_ADDRESS}`,
    });
  }

  const btc = records.get("btc") || null;
  if (btc && btc !== CORPUS_BTC_ADDRESS) {
    findings.push({
      level: "warn",
      code: "sns-btc-mismatch",
      message: `SNS BTC record is ${btc} — related identity is ${CORPUS_BTC_ADDRESS}`,
    });
  }

  return findings;
}

export function assertPubkeyIsCorpusWallet(publicKey: string): void {
  const trimmed = publicKey.trim();
  if (trimmed !== CORPUS_SOLANA_ADDRESS) {
    throw new Error(
      `Signing key ${trimmed} is not the corpus wallet ${CORPUS_SOLANA_ADDRESS}. Use the private key for that public address as SOLANA_SIGNING_KEY.`,
    );
  }
}

export type InventoryWallet = {
  readonly role: "corpus-treasury" | "sns-registrant";
  readonly address: string;
  readonly note: string;
};

/**
 * Addresses that may still hold corpus-related SOL/SPL. Sweep into the treasury.
 */
export function solanaWalletsToInventory(snsRegistrant: string | null): readonly InventoryWallet[] {
  const wallets: InventoryWallet[] = [
    {
      role: "corpus-treasury",
      address: CORPUS_SOLANA_ADDRESS,
      note: "Advertised DID / Cord owner. Corpus SOL and SPL belong here.",
    },
  ];
  const owner = snsRegistrant?.trim() || "";
  if (owner && owner !== CORPUS_SOLANA_ADDRESS) {
    wallets.push({
      role: "sns-registrant",
      address: owner,
      note: "On-chain owner of transition-insight.sol. Only this key can set IPFS/SOL records. Sweep balances into the corpus treasury, then transfer the domain or keep this key solely for name operations.",
    });
  }
  return wallets;
}

/**
 * Laptop / sns.id steps that make sol.site serve the CID.
 * Public Pinata gateway blocks HTML — dedicated gateway or Cloudflare DNSLink.
 */
export function snsIpfsPublishPlan(ipfsCid: string | null): readonly string[] {
  const cid = normalizeIpfsCid(ipfsCid);
  const cidDisplay = cid || "<CID from npm run ship -- --ipfs>";
  return [
    `Pin the global export on the laptop: npm run ship -- --ipfs (PINATA_JWT in .env.local). Public gateway.pinata.cloud refuses HTML — use a dedicated Pinata gateway or Cloudflare DNSLink.`,
    `On-chain records at sns.id (sign with the SNS registrant key, never GitHub Actions): IPFS=${cidDisplay} (CID only) SOL=${CORPUS_SOLANA_ADDRESS}. Do not set URL to ${PAGES_MIRROR_URL} — URL wins over IPFS and that host is a Pages 404.`,
    `Configure Sol.site on sns.id: CNAME → ${SOL_SITE_IPFS_CNAME_TARGET} and TXT _dnslink → dnslink=/ipfs/${cidDisplay}. After DNS propagates, ${CANONICAL_SITE_URL} should serve the CID instead of the Bonfida profile.`,
    `Bake NEXT_PUBLIC_IPFS_CID=${cidDisplay} into .env.local, rebuild once so provenance.json cites the live CID, then pin again if the CID changed.`,
  ];
}

/**
 * On-chain / registrar steps git cannot perform. SNS is a name, not a vault.
 */
export function tokenPullInSteps(
  snsRegistrant: string | null,
  ipfsCid: string | null = null,
): readonly string[] {
  const owner = snsRegistrant?.trim() || null;
  const steps: string[] = [];

  if (owner && owner !== CORPUS_SOLANA_ADDRESS) {
    steps.push(
      `Unify keys: SNS registrant is ${owner} but the site advertises ${CORPUS_SOLANA_ADDRESS}. Tokens paid to the DID do not land with the name owner. Either transfer the domain to the corpus wallet, or advertise the registrant as NEXT_PUBLIC_SOLANA_WALLET_ADDRESS and use that private key as SOLANA_SIGNING_KEY.`,
    );
  } else if (!owner) {
    steps.push(
      "Look up the SNS registrant (`npm run sns:mcp`), then unify that pubkey with the corpus wallet before setting records.",
    );
  }

  steps.push(...snsIpfsPublishPlan(ipfsCid));
  steps.push(
    `Sweep SOL and SPL from related wallets into ${CORPUS_SOLANA_ADDRESS} (` +
      "`npm run solana:tx`" +
      " assembles; send from Phantom or the laptop signer). Pay-to-name only works after the SOL record is set.",
  );
  steps.push(
    `ETH (${CORPUS_ETH_ADDRESS} / ${CORPUS_ENS_DOMAIN}) and BTC (${CORPUS_BTC_ADDRESS}) cannot live inside a .sol name. Set SNS ETH/BTC records for resolution, or keep them as related-person identity.`,
  );
  steps.push(
    "Sign `public/attestation.json` with the corpus key (`npm run content:sign`) so provenance matches the same pubkey.",
  );

  return steps;
}
