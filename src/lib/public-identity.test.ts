import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  CANONICAL_SITE_URL,
  CORPUS_BTC_ADDRESS,
  CORPUS_ETH_ADDRESS,
  CORPUS_SOLANA_ADDRESS,
  PAGES_MIRROR_URL,
  PUBLIC_IDENTITY_ENV,
  SNS_DOMAIN,
  assertPubkeyIsCorpusWallet,
  evaluateSnsContainment,
  expectedSnsRecords,
  ipfsCidFromEnv,
  normalizeIpfsCid,
  publicIdentityDriftFromEnv,
  publicIdentityDriftFromEnvFile,
  snsIpfsPublishPlan,
  solanaWalletsToInventory,
  tokenPullInSteps,
} from "./public-identity.ts";

const SNS_REGISTRANT_FIXTURE = "BGjFMBCESfDZSwfZSFRTqezVz7MtyTEdFRQ1zDYDuR8N";
const CID_FIXTURE = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

test("committed env files match the canonical public identity", () => {
  for (const file of [".env.production", ".env.development"]) {
    const text = readFileSync(file, "utf8");
    assert.deepEqual(publicIdentityDriftFromEnvFile(text), [], `${file} drifted from PUBLIC_IDENTITY_ENV`);
  }
});

test("canonical origin is sol.site, not the Pages mirror", () => {
  assert.equal(CANONICAL_SITE_URL, "https://transition-insight.sol.site");
  assert.equal(PUBLIC_IDENTITY_ENV.NEXT_PUBLIC_SITE_URL, CANONICAL_SITE_URL);
  assert.equal(PUBLIC_IDENTITY_ENV.NEXT_PUBLIC_SOL_SITE_URL, CANONICAL_SITE_URL);
  assert.notEqual(CANONICAL_SITE_URL, PAGES_MIRROR_URL);
});

test("publicIdentityDriftFromEnvFile reports missing and mismatched keys", () => {
  const missing = publicIdentityDriftFromEnvFile(`NEXT_PUBLIC_SITE_URL=${CANONICAL_SITE_URL}\n`);
  assert.ok(missing.some((row) => row.key === "NEXT_PUBLIC_SOLANA_WALLET_ADDRESS" && row.actual === "(missing)"));

  const drifted = publicIdentityDriftFromEnvFile(
    Object.entries(PUBLIC_IDENTITY_ENV)
      .map(([key, value]) => `${key}=${key === "NEXT_PUBLIC_SNS_DOMAIN" ? "other.sol" : value}`)
      .join("\n"),
  );
  assert.deepEqual(drifted, [
    { key: "NEXT_PUBLIC_SNS_DOMAIN", expected: SNS_DOMAIN, actual: "other.sol" },
  ]);
});

test("publicIdentityDriftFromEnv ignores unset keys and flags overrides", () => {
  assert.deepEqual(publicIdentityDriftFromEnv({}), []);
  assert.deepEqual(
    publicIdentityDriftFromEnv({ NEXT_PUBLIC_SOLANA_WALLET_ADDRESS: SNS_REGISTRANT_FIXTURE }),
    [
      {
        key: "NEXT_PUBLIC_SOLANA_WALLET_ADDRESS",
        expected: CORPUS_SOLANA_ADDRESS,
        actual: SNS_REGISTRANT_FIXTURE,
      },
    ],
  );
});

test("normalizeIpfsCid strips ipfs:// and /ipfs/ prefixes", () => {
  assert.equal(normalizeIpfsCid(`ipfs://${CID_FIXTURE}/index.html`), CID_FIXTURE);
  assert.equal(normalizeIpfsCid(`/ipfs/${CID_FIXTURE}`), CID_FIXTURE);
  assert.equal(ipfsCidFromEnv({ NEXT_PUBLIC_IPFS_CID: `/ipfs/${CID_FIXTURE}/` }), CID_FIXTURE);
});

test("evaluateSnsContainment fails the live split: other owner, empty records", () => {
  const findings = evaluateSnsContainment({ key: SNS_REGISTRANT_FIXTURE, records: {} });
  assert.equal(findings.find((row) => row.code === "sns-owner-mismatch")?.level, "fail");
  assert.equal(findings.find((row) => row.code === "sns-ipfs-missing")?.level, "fail");
  assert.equal(findings.find((row) => row.code === "sns-sol-missing")?.level, "fail");
  assert.equal(
    findings.find((row) => row.code === "sns-url-missing"),
    undefined,
  );
});

test("evaluateSnsContainment rejects a URL record aimed at the Pages 404", () => {
  const findings = evaluateSnsContainment({
    key: CORPUS_SOLANA_ADDRESS,
    records: {
      url: `${PAGES_MIRROR_URL}/`,
      IPFS: CID_FIXTURE,
      SOL: CORPUS_SOLANA_ADDRESS,
    },
  });
  assert.equal(findings.find((row) => row.code === "sns-url-pages-mirror")?.level, "fail");
});

test("evaluateSnsContainment accepts corpus owner plus IPFS and SOL", () => {
  const findings = evaluateSnsContainment(
    {
      key: CORPUS_SOLANA_ADDRESS,
      records: expectedSnsRecords(CID_FIXTURE),
    },
    { expectedIpfsCid: CID_FIXTURE },
  );
  assert.equal(findings.filter((row) => row.level === "fail").length, 0);
  assert.ok(findings.some((row) => row.code === "sns-ipfs" && row.level === "ok"));
  assert.ok(findings.some((row) => row.code === "sns-sol" && row.level === "ok"));
});

test("evaluateSnsContainment warns on related-chain record drift", () => {
  const findings = evaluateSnsContainment({
    key: CORPUS_SOLANA_ADDRESS,
    records: {
      IPFS: CID_FIXTURE,
      SOL: CORPUS_SOLANA_ADDRESS,
      ETH: "0x0000000000000000000000000000000000000001",
      BTC: "1DifferentBitcoinAddressxxxxxxxxxxxxxxxx",
    },
  });
  assert.equal(findings.find((row) => row.code === "sns-eth-mismatch")?.level, "warn");
  assert.equal(findings.find((row) => row.code === "sns-btc-mismatch")?.level, "warn");
  assert.ok(CORPUS_ETH_ADDRESS.startsWith("0x"));
  assert.ok(CORPUS_BTC_ADDRESS.length > 20);
});

test("assertPubkeyIsCorpusWallet rejects a generated or SNS-owner key", () => {
  assert.doesNotThrow(() => assertPubkeyIsCorpusWallet(` ${CORPUS_SOLANA_ADDRESS} `));
  assert.throws(() => assertPubkeyIsCorpusWallet(SNS_REGISTRANT_FIXTURE), /not the corpus wallet/);
});

test("solanaWalletsToInventory lists the SNS registrant when it is not the treasury", () => {
  const split = solanaWalletsToInventory(SNS_REGISTRANT_FIXTURE);
  assert.deepEqual(
    split.map((row) => row.role),
    ["corpus-treasury", "sns-registrant"],
  );
  assert.equal(split[1]?.address, SNS_REGISTRANT_FIXTURE);

  const unified = solanaWalletsToInventory(CORPUS_SOLANA_ADDRESS);
  assert.deepEqual(
    unified.map((row) => row.address),
    [CORPUS_SOLANA_ADDRESS],
  );
});

test("tokenPullInSteps and snsIpfsPublishPlan name IPFS, not Pages URL", () => {
  const steps = tokenPullInSteps(SNS_REGISTRANT_FIXTURE, CID_FIXTURE);
  assert.ok(steps.some((step) => step.includes(SNS_REGISTRANT_FIXTURE)));
  assert.ok(steps.some((step) => step.includes("cannot live inside a .sol name")));
  assert.ok(steps.some((step) => step.includes("IPFS=")));
  assert.ok(snsIpfsPublishPlan(CID_FIXTURE).some((step) => step.includes("_dnslink")));
  assert.ok(snsIpfsPublishPlan(CID_FIXTURE).every((step) => !step.includes(`url=${PAGES_MIRROR_URL}`)));
});
