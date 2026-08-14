import assert from "node:assert/strict";
import { test } from "node:test";

import {
  OFT_ENDPOINTS,
  OFT_INSTALL,
  oftEndpoint,
  oftScaffoldCommand,
  preferredOftWorkspaceKind,
  shouldInstallOftInThisRepo,
} from "./oft.ts";

test("shouldInstallOftInThisRepo is always false", () => {
  assert.equal(shouldInstallOftInThisRepo(), false);
});

test("preferred workspace is Solana OFT (Upgrade Authority on this chain)", () => {
  assert.equal(preferredOftWorkspaceKind(), "solana-oft");
  assert.equal(oftScaffoldCommand("solana-oft"), OFT_INSTALL.solanaNewProject);
  assert.equal(oftScaffoldCommand("evm-oft"), OFT_INSTALL.evmNewProject);
});

test("oftScaffoldCommand rejects unknown kinds", () => {
  assert.throws(() => oftScaffoldCommand("oapp" as "evm-oft"), /evm-oft or solana-oft/);
});

test("oftEndpoint returns LayerZero V2 EIDs for named chains", () => {
  assert.equal(oftEndpoint("solana", "mainnet")?.eid, 30168);
  assert.equal(oftEndpoint("solana", "testnet")?.eid, 40168);
  assert.equal(oftEndpoint("ethereum", "mainnet")?.eid, 30101);
  assert.equal(oftEndpoint("ethereum", "testnet")?.eid, 40161);
  assert.equal(oftEndpoint("base", "mainnet")?.eid, 30184);
  assert.equal(oftEndpoint("polygon", "testnet")?.eid, 40267);
});

test("oftEndpoint is case-insensitive and returns null for unknown pairs", () => {
  assert.equal(oftEndpoint("Solana", "Mainnet")?.lzName, "SOLANA_V2_MAINNET");
  assert.equal(oftEndpoint("base", "testnet"), null);
  assert.equal(oftEndpoint("polygon", "mainnet"), null);
  assert.equal(oftEndpoint("cosmos", "mainnet"), null);
  assert.equal(oftEndpoint("", "mainnet"), null);
});

test("oftEndpoint rejects non-strings", () => {
  assert.throws(() => oftEndpoint(null as unknown as string, "mainnet"), /must be strings/);
});

test("catalog EIDs are unique and in the V2 30xxx/40xxx bands", () => {
  const eids = OFT_ENDPOINTS.map((row) => row.eid);
  assert.equal(new Set(eids).size, eids.length);
  for (const row of OFT_ENDPOINTS) {
    const band = row.network === "mainnet" ? 30_000 : 40_000;
    assert.ok(row.eid >= band && row.eid < band + 10_000, `${row.lzName} eid ${row.eid}`);
  }
});
