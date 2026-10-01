import assert from "node:assert/strict";
import test from "node:test";

import { effectOf, parsePorcelainZ, shippablePaths, statusOf } from "./md-delta.mjs";

test("parsePorcelainZ keeps spaces in paths and skips rename sources", () => {
  const out = " M ontology/a b.md\0R  ontology/new.md\0ontology/old.md\0?? docs/x.md\0";
  assert.deepEqual(parsePorcelainZ(out), [
    { code: " M", path: "ontology/a b.md" },
    { code: "R ", path: "ontology/new.md" },
    { code: "??", path: "docs/x.md" },
  ]);
});

test("statusOf maps porcelain codes", () => {
  assert.equal(statusOf("??"), "new");
  assert.equal(statusOf(" D"), "deleted");
  assert.equal(statusOf("R "), "renamed");
  assert.equal(statusOf("MM"), "modified");
});

test("effectOf tracks publish transitions", () => {
  const c = { kind: "content", status: "modified" };
  assert.equal(effectOf({ ...c, live: true, wasLive: false }), "publish");
  assert.equal(effectOf({ ...c, live: false, wasLive: true }), "unpublish");
  assert.equal(effectOf({ ...c, live: true, wasLive: true }), "live update");
  assert.equal(effectOf({ ...c, live: false, wasLive: false }), "draft");
  assert.equal(effectOf({ ...c, status: "deleted", wasLive: true }), "removed (was live)");
  assert.equal(effectOf({ ...c, error: "bad yaml" }), "frontmatter error");
  assert.equal(effectOf({ kind: "docs", status: "modified" }), "docs");
});

test("shippablePaths drops excluded entries", () => {
  assert.deepEqual(
    shippablePaths([
      { path: "ontology/a.md", kind: "content" },
      { path: "ontology/governance/Canonical-Review.md", kind: "excluded" },
      { path: "SECURITY.md", kind: "docs" },
    ]),
    ["ontology/a.md", "SECURITY.md"],
  );
});
