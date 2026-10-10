import assert from "node:assert/strict";
import { test } from "node:test";
import { PublicKey } from "@solana/web3.js";

import {
  checkPlanFileLimit,
  cidFromRecordContent,
  extractRootAssets,
  ipfsRecordContent,
  isServiceWorkerOnlyResponse,
  parseRecordV2Account,
  selectPinsToRemove,
  waitForSignature,
} from "./publish-sol.mjs";

const CID = "bafybeigt2duezr5tqi6ncf6pnaohborjyi6nz2vo2kvrrsj53c3clawk24";

test("IPFS record uses the ipfs:// form Brave resolves", () => {
  assert.equal(ipfsRecordContent(CID), `ipfs://${CID}`);
  assert.throws(() => ipfsRecordContent("QmZk9uh2mqmXJFKu2Hq7kFRh93pA8GDpSZ6ReNqubfRKKQ"));
  assert.equal(cidFromRecordContent(`ipfs://${CID}`), CID);
  assert.equal(cidFromRecordContent(CID), CID);
  assert.equal(cidFromRecordContent("http://ashitmilne.xyz/"), null);
});

test("parses a records V2 account (staleness signed by owner)", () => {
  const owner = new PublicKey("6qr7vtip1h2wD7ktLZQYa7XvnJtjnLLeGFF8a6EPtLKT");
  const content = Buffer.from(`ipfs://${CID}`, "utf8");
  const header = Buffer.alloc(8);
  header.writeUInt16LE(1, 0);
  header.writeUInt16LE(0, 2);
  header.writeUInt32LE(content.length, 4);
  const data = Buffer.concat([Buffer.alloc(96), header, owner.toBuffer(), content]);
  const parsed = parseRecordV2Account(data);
  assert.equal(parsed.content, `ipfs://${CID}`);
  assert.equal(parsed.stalenessSigner, owner.toBase58());
});

test("default keeps only the live pin (keep=0 + protect)", () => {
  const pins = [
    { cid: "old", datePinned: "2026-10-01", keyvalues: { project: "transition-insight" } },
    { cid: "live", datePinned: "2026-10-10", keyvalues: { project: "transition-insight" } },
    { cid: "legacy", datePinned: "2026-09-22", name: "out", keyvalues: {} },
    { cid: "other", datePinned: "2026-09-01", keyvalues: { project: "something-else" } },
  ];
  const removed = selectPinsToRemove(pins, { keep: 0, protect: ["live"] }).map((pin) => pin.cid);
  assert.deepEqual(removed, ["old", "legacy"]);
});

test("plan file limit: live + new must fit (500 on the free plan)", () => {
  assert.deepEqual(checkPlanFileLimit({ pins: [{ files: 250 }], newFiles: 250, limit: 500 }), { ok: true, pinnedFiles: 250, newFiles: 250, total: 500, limit: 500 });
  assert.equal(checkPlanFileLimit({ pins: [{ files: 256 }, { files: 250 }], newFiles: 250, limit: 500 }).ok, false);
  assert.equal(checkPlanFileLimit({ pins: [], newFiles: 501, limit: 500 }).ok, false);
});

test("keeps the newest two project pins and anything live on-chain", () => {
  const pins = [
    { cid: "a", datePinned: "2026-10-01", keyvalues: { project: "transition-insight" } },
    { cid: "b", datePinned: "2026-10-03", keyvalues: { project: "transition-insight" } },
    { cid: "c", datePinned: "2026-10-02", name: "out", keyvalues: {} },
    { cid: "d", datePinned: "2026-09-01", keyvalues: { project: "something-else" } },
    { cid: "e", datePinned: "2026-08-01", keyvalues: { project: "transition-insight" } },
  ];
  const removed = selectPinsToRemove(pins, { keep: 2, protect: ["e"] }).map((pin) => pin.cid);
  assert.deepEqual(removed, ["a"]);
});

test("extracts root-absolute assets from exported HTML", () => {
  const html = '<script src="/_next/static/chunks/a.js"></script><link href="/_next/static/chunks/b.css"><img src="/visuals/icon.png"><a href="/me/sku/">x</a>';
  assert.deepEqual(extractRootAssets(html), ["/_next/static/chunks/a.js", "/_next/static/chunks/b.css", "/visuals/icon.png"]);
});

test("waitForSignature polls signature status until confirmed (no block-height check)", async () => {
  const statuses = [null, { confirmationStatus: "processed", err: null }, { confirmationStatus: "confirmed", err: null }];
  let calls = 0;
  const connection = { getSignatureStatuses: async () => ({ value: [statuses[Math.min(calls++, statuses.length - 1)]] }) };
  const { status } = await waitForSignature(connection, "sig", { sleep: async () => {} });
  assert.equal(status.confirmationStatus, "confirmed");
  assert.equal(calls, 3);
});

test("waitForSignature throws on a failed tx and on timeout", async () => {
  const failed = { getSignatureStatuses: async () => ({ value: [{ confirmationStatus: "confirmed", err: { InstructionError: [1, "Custom"] } }] }) };
  await assert.rejects(waitForSignature(failed, "sig", { sleep: async () => {} }), /failed/);
  const missing = { getSignatureStatuses: async () => ({ value: [null] }) };
  await assert.rejects(waitForSignature(missing, "sig", { timeoutMs: 0, sleep: async () => {} }), /not confirmed/);
});

test("service-worker-only gateway responses are recognised", () => {
  assert.equal(isServiceWorkerOnlyResponse(429, "This IPFS gateway is switching to a service worker gateway only."), true);
  assert.equal(isServiceWorkerOnlyResponse(429, "Too Many Requests"), false);
  assert.equal(isServiceWorkerOnlyResponse(404, ""), false);
});
