import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

test("same-folder draft slug collision does not soft-404 published hub leaf or index", () => {
  const previous = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  const draftPath = path.join(
    process.cwd(),
    "ontology",
    "governance",
    "illumination",
    "AAA-draft-collision.md",
  );
  const created = !fs.existsSync(draftPath);
  try {
    if (created) {
      fs.writeFileSync(
        draftPath,
        [
          "---",
          'title: "Draft Collision"',
          "stage: draft",
          "slug: social-network",
          "type: essay",
          "series: peridot",
          "---",
          "",
          "Draft that collides with published social-network.",
          "",
        ].join("\n"),
        "utf8",
      );
    }
    const leaf = resolveReadingEssay(["governance", "peridot", "social-network"]);
    assert.ok(leaf, "published leaf must resolve despite an earlier draft collision");
    assert.equal(leaf.essay.frontmatter.title, "The Social Network");
    assert.equal(leaf.essay.frontmatter.stage, "published");

    const index = resolveReadingEssay(["governance", "peridot"]);
    assert.ok(index, "hub index must resolve despite an earlier draft collision");
    assert.equal(index.essay.frontmatter.stage, "published");
  } finally {
    if (created && fs.existsSync(draftPath)) fs.unlinkSync(draftPath);
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});
