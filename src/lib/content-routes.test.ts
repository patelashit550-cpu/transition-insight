import assert from "node:assert/strict";
import { test } from "node:test";

import { listContentHubStaticParams } from "./content-routes.ts";
import type { EssayStub } from "./markdown.ts";

test("listContentHubStaticParams omits hub indexes with zero tier-eligible essays", () => {
  const empty: EssayStub[] = [];
  const peridot: EssayStub[] = [
    { slug: "social-network", title: "The Social Network", order: 2 },
  ];

  const params = listContentHubStaticParams(
    (topicPath) => {
      if (topicPath.join("/") === "governance/illumination") return peridot;
      return empty;
    },
    () => empty
  );

  const keys = params.map((p) => p.slug.join("/"));
  assert.ok(keys.includes("governance/peridot"));
  assert.ok(keys.includes("governance/peridot/social-network"));
  assert.ok(!keys.includes("governance/identity"));
  assert.ok(!keys.includes("governance/capital"));
  assert.ok(!keys.includes("governance/intelligence"));
  assert.ok(!keys.includes("chronicle/jack-london"));
  assert.ok(!keys.includes("chronicle/polite_bureau"));
});
