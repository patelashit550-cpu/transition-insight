import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { verifyCommittedAttestation } from "./verify-committed-attestation.mjs";

test("verifyCommittedAttestation fails when attestation is missing", async () => {
  const root = mkdtempSync(join(tmpdir(), "attest-verify-"));
  mkdirSync(join(root, "public"), { recursive: true });
  const result = await verifyCommittedAttestation({ root, requireSignature: true });
  assert.equal(result.ok, false);
  assert.match(result.errors[0] ?? "", /missing/);
});

test("verifyCommittedAttestation fails when signature is null", async () => {
  const root = mkdtempSync(join(tmpdir(), "attest-verify-"));
  mkdirSync(join(root, "public"), { recursive: true });
  writeFileSync(
    join(root, "public", "attestation.json"),
    `${JSON.stringify(
      {
        version: "1",
        generated: "2026-09-27T00:00:00.000Z",
        tier: "global",
        manifestDigest: "sha256:deadbeef",
        signature: null,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  // Ontology root is process.cwd()/ontology — digest check still runs against the
  // real repo corpus, so we only assert the unsigned error is present.
  const result = await verifyCommittedAttestation({
    root,
    requireSignature: true,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => /unsigned/i.test(e)));
});
