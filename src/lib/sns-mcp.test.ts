import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SNS_SITE_DOMAIN,
  parseSnsDomainChecks,
  parseSnsDomainRecords,
  snsDomainLabel,
} from "./sns-mcp.ts";

test("snsDomainLabel strips .sol and lowercases", () => {
  assert.equal(snsDomainLabel("Transition-Insight.sol"), "transition-insight");
  assert.equal(snsDomainLabel("  bonfida  "), "bonfida");
});

test("snsDomainLabel rejects empty or non-string values", () => {
  assert.throws(() => snsDomainLabel(""), /empty/);
  assert.throws(() => snsDomainLabel("   "), /empty/);
  assert.throws(() => snsDomainLabel(null as unknown as string), /must be a string/);
});

test("parseSnsDomainChecks reads status rows", () => {
  const checks = parseSnsDomainChecks({
    results: [
      { domain: "transition-insight", status: "unavailable" },
      { domain: " ", status: "available" },
      { status: "available" },
    ],
  });
  assert.deepEqual(checks, [{ domain: "transition-insight", status: "unavailable" }]);
});

test("parseSnsDomainChecks rejects junk", () => {
  assert.throws(() => parseSnsDomainChecks(null), /unexpected payload/);
  assert.throws(() => parseSnsDomainChecks({}), /unexpected payload/);
});

test("parseSnsDomainRecords reads key and string records", () => {
  const records = parseSnsDomainRecords({
    domain: SNS_SITE_DOMAIN.replace(/\.sol$/i, ""),
    key: "BGjFMBCESfDZSwfZSFRTqezVz7MtyTEdFRQ1zDYDuR8N",
    records: { url: "https://ashitmilne.xyz/", twitter: 1, empty: "  " },
  });
  assert.equal(records.domain, "transition-insight");
  assert.equal(records.key, "BGjFMBCESfDZSwfZSFRTqezVz7MtyTEdFRQ1zDYDuR8N");
  assert.deepEqual(records.records, { url: "https://ashitmilne.xyz/" });
});

test("parseSnsDomainRecords allows an empty records object", () => {
  const records = parseSnsDomainRecords({ domain: "transition-insight", records: {} });
  assert.equal(records.key, null);
  assert.deepEqual(records.records, {});
});
