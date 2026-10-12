import assert from "node:assert/strict";
import { test } from "node:test";

import { BentoGroups, BentoRegistry } from "../config/site.ts";
import { getNavVisibilityPayload } from "./nav-visibility.ts";
import { resolveBentoKeyFromPathname } from "./nav-visibility-shared.ts";

test("B2 (Ontology) lists published Carta first in global tier", () => {
  const prevTier = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const visible = getNavVisibilityPayload();
    assert.ok(visible.B2.length > 0, "B2 should expose at least one row");
    assert.equal(visible.B2[0]!.name, "Carta");
    assert.equal(visible.B2[0]!.href, "/governance/carta");
  } finally {
    if (prevTier === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = prevTier;
  }
});

test("B3 lists London Calling in global tier", () => {
  const prevTier = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const visible = getNavVisibilityPayload();
    const radio = visible.B3.find((row) => row.href === "/chronicle/3am-eternal");
    assert.ok(radio, "B3 should expose London Calling");
    assert.equal(radio.name, "London Calling");
  } finally {
    if (prevTier === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = prevTier;
  }
});

test("B3 hides Skin in the Game in global tier while held unpublished", () => {
  const prevTier = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const visible = getNavVisibilityPayload();
    const tannery = visible.B3.find((row) => row.href === "/chronicle/skin-in-the-game");
    const radio = visible.B3.find((row) => row.href === "/chronicle/3am-eternal");
    assert.equal(tannery, undefined, "B3 must not expose draft Skin in the Game on global");
    assert.ok(radio, "B3 should still expose London Calling");
  } finally {
    if (prevTier === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = prevTier;
  }
});

test("/chronicle/3am-eternal resolves to B3 (Telamon / Firmitas)", () => {
  assert.equal(resolveBentoKeyFromPathname("/chronicle/3am-eternal"), "B3");
  assert.equal(resolveBentoKeyFromPathname("/chronicle/3am-eternal/"), "B3");
});

test("/chronicle/skin-in-the-game resolves to B3 (Telamon / Firmitas)", () => {
  assert.equal(resolveBentoKeyFromPathname("/chronicle/skin-in-the-game"), "B3");
  assert.equal(resolveBentoKeyFromPathname("/chronicle/skin-in-the-game/"), "B3");
});

test("B3 registry order keeps Tannery above London Calling", () => {
  assert.deepEqual(
    BentoRegistry.B3.series.map((row) => row.name),
    ["The Times", "Polite Bureau", "Skin in the Game", "London Calling"]
  );
  assert.equal(BentoRegistry.B3.series[2]!.href, "/chronicle/skin-in-the-game");
  assert.equal(BentoRegistry.B3.series[2]!.desc, "Tannery");
  assert.equal(BentoRegistry.B3.series[3]!.href, "/chronicle/3am-eternal");
});

test("Bento 3 is titled Lens and keeps London Calling", () => {
  assert.equal(BentoRegistry.B3.title, "Lens & Narrative");
  assert.ok(BentoRegistry.B3.series.some((row) => row.name === "London Calling"));
});

test("B2 (Telamon) shows published Argonaut Agentic (V≡RT) in global tier", () => {
  const prevTier = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const visible = getNavVisibilityPayload();
    const agentic = visible.B2.find((row) => row.href === "/chronicle/argonaut-agentic");
    assert.ok(agentic, "B2 must expose published Argonaut Agentic on global");
    assert.equal(
      visible.B3.find((row) => row.href === "/chronicle/argonaut-agentic"),
      undefined,
      "Argonaut Agentic is no longer listed under Lens"
    );
    const entry = BentoRegistry.B2.series.find((row) => row.dataPoint === "0xCF6");
    assert.ok(entry, "V≡RT lives in Bento 2");
    assert.equal(entry.desc, "V≡RT");
    assert.equal(entry.href, "/chronicle/argonaut-agentic");
    assert.equal(entry.variant, "utility");
  } finally {
    if (prevTier === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = prevTier;
  }
});

test("/chronicle/argonaut-agentic resolves to B2 (Telamon) while keeping its URL", () => {
  assert.equal(resolveBentoKeyFromPathname("/chronicle/argonaut-agentic"), "B2");
  assert.equal(resolveBentoKeyFromPathname("/chronicle/argonaut-agentic/"), "B2");
  assert.equal(resolveBentoKeyFromPathname("/chronicle/argonaut-agentic-other"), "B3");
});

test("B2 Regnum Dei holds only Sine Qua Non, as a plain link (two levels on the homepage)", () => {
  const rows = BentoRegistry.B2.series.filter((row) => row.group === "regnum-dei");
  assert.deepEqual(rows.map((row) => row.name), ["Sine Qua Non"]);
  assert.ok(rows.every((row) => !row.collapsible));
});

test("B2 order: Carta, Regnum Dei, Lingam, then V≡RT", () => {
  const series = BentoRegistry.B2.series;
  const topLevel: string[] = [];
  for (const row of series) {
    const label = row.group ? BentoGroups[row.group].name : row.name;
    if (topLevel.at(-1) !== label) topLevel.push(label);
  }
  assert.deepEqual(topLevel, ["Carta", "Regnum Dei", "Lingam", "Argonaut Agentic"]);
  assert.deepEqual(
    series.filter((row) => row.group === "lingam").map((row) => [row.name, row.collapsible === true]),
    [
      ["Peridot", false],
      ["Canonical", false],
      ["Canonical Review", false],
    ]
  );
  assert.equal(BentoGroups.lingam.name, "Lingam");
});

test("Lingam exposes only published children in global tier", () => {
  const prevTier = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const visible = getNavVisibilityPayload();
    const lingamHrefs = new Set(
      BentoRegistry.B2.series.filter((row) => row.group === "lingam").map((row) => row.href)
    );
    const shown = visible.B2.filter((row) => lingamHrefs.has(row.href));
    assert.deepEqual(shown.map((row) => row.name), ["Peridot", "Canonical"]);
    assert.equal(shown[0]!.articles, undefined, "Peridot is a single link on the homepage");
    assert.equal(shown[1]!.articles, undefined, "Canonical stays a single link");
  } finally {
    if (prevTier === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = prevTier;
  }
});

test("B2 puts Regnum Dei (Sine Qua Non) right after Carta", () => {
  const series = BentoRegistry.B2.series;
  assert.equal(series[0]!.name, "Carta");
  assert.deepEqual([series[1]!.name, series[1]!.desc, series[1]!.group], ["Sine Qua Non", "Intelligence", "regnum-dei"]);
  assert.equal(series[1]!.href, "/governance/intelligence");
  assert.deepEqual(BentoGroups["regnum-dei"], { name: "Regnum Dei", desc: "Divine Governance" });
});

test("Homepage B2 lists no essays under Sine Qua Non, Peridot or Canonical in global tier", () => {
  const prevTier = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const visible = getNavVisibilityPayload();
    for (const href of ["/governance/intelligence", "/governance/peridot", "/governance/canonical"]) {
      const row = visible.B2.find((r) => r.href === href);
      assert.ok(row, `B2 should expose ${href}`);
      assert.equal(row.articles, undefined, `${href} is a plain link`);
    }
  } finally {
    if (prevTier === undefined) delete process.env.NEXT_PUBLIC_CONTENT_TIER;
    else process.env.NEXT_PUBLIC_CONTENT_TIER = prevTier;
  }
});
