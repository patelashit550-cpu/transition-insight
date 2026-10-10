import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_MIRROR_CNAME, DEFAULT_MIRROR_REPO, githubSlug, validateMirrorTarget } from "./mirror.mjs";

const ORIGIN = "https://github.com/patelashit550-cpu/transition-insight.git";

test("parses GitHub remotes", () => {
  assert.equal(githubSlug(DEFAULT_MIRROR_REPO), "patelashit550-cpu/transition-insight-sol");
  assert.equal(githubSlug("git@github.com:Owner/Repo.git"), "owner/repo");
  assert.equal(githubSlug("https://example.com/x/y"), null);
});

test("the default mirror target is valid and distinct from origin", () => {
  const result = validateMirrorTarget({ remote: DEFAULT_MIRROR_REPO, originUrl: ORIGIN, cname: DEFAULT_MIRROR_CNAME });
  assert.deepEqual(result, { ok: true, target: "patelashit550-cpu/transition-insight-sol", problems: [] });
});

test("refuses to force-push the source repo or a bad CNAME", () => {
  assert.equal(validateMirrorTarget({ remote: ORIGIN, originUrl: ORIGIN, cname: DEFAULT_MIRROR_CNAME }).ok, false);
  assert.equal(validateMirrorTarget({ remote: "git@github.com:patelashit550-cpu/transition-insight.git", originUrl: ORIGIN, cname: DEFAULT_MIRROR_CNAME }).ok, false);
  assert.equal(validateMirrorTarget({ remote: DEFAULT_MIRROR_REPO, originUrl: ORIGIN, cname: "not a domain" }).ok, false);
});
