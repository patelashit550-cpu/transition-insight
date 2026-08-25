import assert from "node:assert/strict";
import { test } from "node:test";

import { getProfileData } from "./markdown.ts";

/**
 * Regression: root draft `Political Economy.md` and published
 * `governance/illumination/social-network.md` both set `slug: social-network`.
 * First-match lookup used to return the draft and poison OG metadata / legacy routes.
 */
test("getProfileData prefers published social-network over draft Political Economy", () => {
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";

  const essay = getProfileData(["social-network"]);

  assert.ok(essay, "expected social-network essay");
  assert.equal(essay.frontmatter.stage, "published");
  assert.equal(essay.frontmatter.title, "The Social Network");
  assert.notEqual(essay.frontmatter.title, "Political Economy");
});

test("getProfileData still resolves unique published slugs", () => {
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";

  const essay = getProfileData(["arete"]);

  assert.ok(essay);
  assert.equal(essay.frontmatter.stage, "published");
  assert.equal(essay.frontmatter.title, "Areté");
});
