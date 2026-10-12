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
    assert.equal(resolved.essay.frontmatter.image, undefined);
    assert.equal(resolved.essay.frontmatter.imageRole, undefined);
    assert.equal(resolved.essay.frontmatter.spotifyPlaylist, "3KCcNodoGPZckuspVql8vm");
    assert.equal(resolved.essay.content.trim(), "");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});

test("chronicle/skin-in-the-game hub config stays wired; global tier omits draft lander", () => {
  const previous = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const route = resolveContentRoute(["chronicle", "skin-in-the-game"]);
    assert.ok(route && route.kind === "content-hub");
    assert.equal(route.hubKey, "chronicle/skin-in-the-game");
    assert.equal(route.config.navKicker, "TANNERY");
    assert.equal(route.config.mode, "series");
    assert.equal(route.config.showTopicNav, false);
    assert.notEqual(route.config.fitViewport, true);
    assert.equal(
      "spotifyPlaylist" in (route.config as Record<string, unknown>),
      false,
      "Tannery must not borrow London Calling Spotify hub fields"
    );

    const resolved = resolveReadingEssay(["chronicle", "skin-in-the-game"]);
    assert.equal(
      resolved,
      null,
      "draft Skin in the Game must not resolve on global publish tier"
    );
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});

test("chronicle/skin-in-the-game still lands locally while held as draft", () => {
  const previous = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "local";
  try {
    const resolved = resolveReadingEssay(["chronicle", "skin-in-the-game"]);
    assert.ok(resolved, "Skin in the Game hub index must resolve the lander in local");
    assert.equal(resolved.essaySlug, "skin-in-the-game");
    assert.equal(resolved.essay.frontmatter.title, "Skin in the Game");
    assert.equal(resolved.essay.frontmatter.subtitle, "Tannery");
    assert.equal(resolved.essay.frontmatter.stage, "draft");
    assert.equal(resolved.essay.frontmatter.spotifyPlaylist, undefined);
    assert.equal(resolved.essay.frontmatter.image, "/assets/skin.png");
    assert.equal(resolved.essay.frontmatter.imageRole, "inset");
    assert.match(resolved.essay.content, /^### What Floats Your Boat\?/m);
    assert.match(resolved.essay.content, /^## How/m);
    assert.match(resolved.essay.content, /github\.com\/patelashit550-cpu\/tannery/);
    assert.match(resolved.essay.content, /npm run dev/);
    assert.match(resolved.essay.content, /npm run build/);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});

test("published essay body headings sit one level below H1 titles", () => {
  const previous = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const canonical = resolveReadingEssay(["governance", "canonical"]);
    assert.ok(canonical);
    assert.match(canonical.essay.content, /^### Ab$/m);
    assert.match(canonical.essay.content, /^### Areté$/m);
    assert.equal(
      [...canonical.essay.content.matchAll(/^##\s+/gm)].length,
      0,
      "Canonical terms must be ### so they sit under the page title"
    );

    const carta = resolveReadingEssay(["governance", "carta"]);
    assert.ok(carta);
    assert.match(carta.essay.content, /^### Soundness$/m);

    const sku = resolveReadingEssay(["me", "sku"]);
    assert.ok(sku);
    assert.match(sku.essay.content, /^# Transition Insight$/m);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
  }
});

for (const tier of ["global", "local"] as const) {
  test(`chronicle/argonaut-agentic hub resolves the published lander (${tier} tier)`, () => {
    const previous = process.env.NEXT_PUBLIC_CONTENT_TIER;
    process.env.NEXT_PUBLIC_CONTENT_TIER = tier;
    try {
      const route = resolveContentRoute(["chronicle", "argonaut-agentic"]);
      assert.ok(route && route.kind === "content-hub");
      assert.equal(route.hubKey, "chronicle/argonaut-agentic");
      assert.equal(route.config.mode, "series");
      assert.equal(route.config.showTopicNav, false);
      const resolved = resolveReadingEssay(["chronicle", "argonaut-agentic"]);
      assert.ok(resolved, "Argonaut Agentic must resolve");
      assert.equal(resolved.essaySlug, "argonaut-agentic");
      assert.equal(resolved.essay.frontmatter.title, "Argonaut Agentic");
      assert.equal(resolved.essay.frontmatter.subtitle, "V≡RT");
      assert.equal(resolved.essay.frontmatter.titleDisplay, "hidden");
      assert.equal(resolved.essay.frontmatter.stage, "published");
      assert.equal(resolved.essay.frontmatter.image, "/assets/argonaut-agentic-banner.png");
      assert.match(resolved.essay.content, /^### Agentic Payments/m);
      assert.match(resolved.essay.content, /^### V≡RT$/m);
      assert.doesNotMatch(resolved.essay.content, /The V≡RT explainer/, "explainer lives in the lead column, not the body");
      const fm = resolved.essay.frontmatter as Record<string, unknown>;
      assert.equal(fm.leadThumbsHref, "/assets/vert-explainer/vert-explainer.pdf");
      const thumbs = fm.leadThumbs as { src: string; href?: string }[];
      assert.equal(thumbs.length, 1, "one explainer thumbnail, not three pages");
      assert.equal(thumbs[0]!.href, "/assets/vert-explainer/vert-explainer.pdf");
      assert.equal(fm.leadThumbsLabel, undefined, "no explainer label in the lead column");
      assert.equal(fm.leadThumbsLinkText, undefined, "no PDF download link in the lead column");
      assert.doesNotMatch(resolved.essay.content, /ISO 200022/);
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
      else process.env.NEXT_PUBLIC_CONTENT_TIER = previous;
    }
  });
}
