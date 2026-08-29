import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeApiAddress } from "./kubo.mjs";

test("keeps Kubo API multiaddrs unchanged", () => {
  assert.equal(
    normalizeApiAddress("/ip4/127.0.0.1/tcp/5001"),
    "/ip4/127.0.0.1/tcp/5001",
  );
});

test("converts local HTTP API URLs to Kubo multiaddrs", () => {
  assert.equal(
    normalizeApiAddress("http://127.0.0.1:5001"),
    "/ip4/127.0.0.1/tcp/5001",
  );
  assert.equal(
    normalizeApiAddress("http://localhost:5001/"),
    "/dns/localhost/tcp/5001",
  );
});

test("converts HTTPS and IPv6 API URLs to Kubo multiaddrs", () => {
  assert.equal(
    normalizeApiAddress("https://node.example.com"),
    "/dns/node.example.com/tcp/443/https",
  );
  assert.equal(
    normalizeApiAddress("http://[::1]:5001"),
    "/ip6/::1/tcp/5001",
  );
});

test("rejects unsupported or ambiguous API URLs", () => {
  assert.throws(() => normalizeApiAddress("ftp://localhost:5001"), /http or https/);
  assert.throws(() => normalizeApiAddress("http://localhost:5001/api/v0"), /only a host/);
  assert.throws(() => normalizeApiAddress("localhost:5001"), /multiaddr/);
});
