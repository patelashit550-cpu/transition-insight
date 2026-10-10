import assert from "node:assert/strict";
import { test } from "node:test";
import { PublicKey } from "@solana/web3.js";

import {
  cidFromRecordContent,
  extractRootAssets,
  ipfsRecordContent,
  parseRecordV2Account,
  selectPinsToRemove,
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
