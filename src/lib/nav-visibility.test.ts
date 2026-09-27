import assert from "node:assert/strict";
import { test } from "node:test";

import { BentoRegistry } from "../config/site.ts";
import { getNavVisibilityPayload } from "./nav-visibility.ts";
import { resolveBentoKeyFromPathname } from "./nav-visibility-shared.ts";

test("B2 (Regnum Dei) lists published Carta first in global tier", () => {
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

test("B3 lists Skin in the Game above London Calling in global tier", () => {
  const prevTier = process.env.NEXT_PUBLIC_CONTENT_TIER;
  process.env.NEXT_PUBLIC_CONTENT_TIER = "global";
  try {
    const visible = getNavVisibilityPayload();
    const tannery = visible.B3.find((row) => row.href === "/chronicle/skin-in-the-game");
    const radio = visible.B3.find((row) => row.href === "/chronicle/3am-eternal");
    assert.ok(tannery, "B3 should expose Skin in the Game");
    assert.equal(tannery.name, "Skin in the Game");
    assert.ok(radio, "B3 should still expose London Calling");
    assert.ok(
      visible.B3.indexOf(tannery) < visible.B3.indexOf(radio),
      "Skin in the Game should sit above London Calling"
    );
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
    ["The Times", "Polite Bureau", "Skin in the Game", "London Calling", "Chord"]
  );
  assert.equal(BentoRegistry.B3.series[2]!.href, "/chronicle/skin-in-the-game");
  assert.equal(BentoRegistry.B3.series[2]!.desc, "Tannery");
  assert.equal(BentoRegistry.B3.series[3]!.href, "/chronicle/3am-eternal");
});
