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
    assert.equal(resolved.essay.frontmatter.title, "Semper Idem");
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
    assert.equal(resolved.essay.frontmatter.title, "Carta");
    assert.equal(resolved.essay.frontmatter.series, "regnum-dei");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});

test("chronicle/3am-eternal hub lands on the radio lander with Spotify playlist id", () => {
  const previous = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const route = resolveContentRoute(["chronicle", "3am-eternal"]);
    assert.ok(route && route.kind === "content-hub");
    assert.equal(route.hubKey, "chronicle/3am-eternal");
    assert.equal(route.config.navKicker, "RADIO");
    assert.equal(route.config.mode, "series");
    assert.equal(route.config.showTopicNav, false);
    assert.equal(route.config.fitViewport, true);

    const resolved = resolveReadingEssay(["chronicle", "3am-eternal"]);
    assert.ok(resolved, "London Calling hub index must resolve the lander");
    assert.equal(resolved.essaySlug, "3am-eternal");
    assert.equal(resolved.essay.frontmatter.title, "London Calling");
    assert.equal(resolved.essay.frontmatter.subtitle, "Tannoy");
    assert.equal(resolved.essay.frontmatter.spotifyPlaylist, "3KCcNodoGPZckuspVql8vm");
    assert.equal(resolved.essay.content.trim(), "");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});

test("chronicle/skin-in-the-game hub lands on the Tannery placeholder", () => {
  const previous = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const route = resolveContentRoute(["chronicle", "skin-in-the-game"]);
    assert.ok(route && route.kind === "content-hub");
    assert.equal(route.hubKey, "chronicle/skin-in-the-game");
    assert.equal(route.config.navKicker, "TANNERY");
    assert.equal(route.config.mode, "series");
    assert.notEqual(route.config.fitViewport, true);
    assert.equal(
      "spotifyPlaylist" in (route.config as Record<string, unknown>),
      false,
      "Tannery must not borrow London Calling Spotify hub fields"
    );

    const resolved = resolveReadingEssay(["chronicle", "skin-in-the-game"]);
    assert.ok(resolved, "Skin in the Game hub index must resolve the lander");
    assert.equal(resolved.essaySlug, "skin-in-the-game");
    assert.equal(resolved.essay.frontmatter.title, "Skin in the Game");
    assert.equal(resolved.essay.frontmatter.subtitle, "Tannery");
    assert.equal(resolved.essay.frontmatter.spotifyPlaylist, undefined);
    assert.match(resolved.essay.content, /^## What/m);
    assert.match(resolved.essay.content, /verbiage forthcoming/i);
    assert.match(resolved.essay.content, /^## How/m);
    assert.match(resolved.essay.content, /github\.com\/patelashit550-cpu\/tannery/);
    assert.match(resolved.essay.content, /npm run dev/);
    assert.match(resolved.essay.content, /npm run build/);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});
