import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveContentRoute } from "./content-routes.ts";
import { resolveReadingEssay } from "./resolve-reading-essay.ts";

test("hub index metadata resolves the landed essay, not the lander slug", () => {
  const previous = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const resolved = resolveReadingEssay(["governance", "peridot"]);
    assert.ok(resolved, "peridot hub index must resolve an essay");
    assert.notEqual(resolved.essaySlug, "peridot");
    assert.equal(resolved.essay.frontmatter.title, "The Social Network");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});

test("hub essay leaf uses topic-scoped file, not root draft duplicate slug", () => {
  const previous = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const resolved = resolveReadingEssay(["governance", "peridot", "social-network"]);
    assert.ok(resolved);
    assert.equal(resolved.essaySlug, "social-network");
    assert.equal(resolved.essay.frontmatter.title, "The Social Network");
    assert.notEqual(resolved.essay.frontmatter.title, "Political Economy");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});

test("legacy /governance/carta prefers the governance topic file", () => {
  const previous = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "local";
  try {
    const route = resolveContentRoute(["governance", "carta"]);
    assert.ok(route && route.kind === "legacy");
    const resolved = resolveReadingEssay(["governance", "carta"]);
    assert.ok(resolved);
    assert.match(String(resolved.essay.frontmatter.title), /Introduction Regnum Dei/i);
    assert.notEqual(resolved.essay.frontmatter.title, "Carta");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});
