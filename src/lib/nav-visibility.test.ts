import assert from "node:assert/strict";
import { test } from "node:test";

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

test("/chronicle/3am-eternal resolves to B3 (Telamon / Firmitas)", () => {
  assert.equal(resolveBentoKeyFromPathname("/chronicle/3am-eternal"), "B3");
  assert.equal(resolveBentoKeyFromPathname("/chronicle/3am-eternal/"), "B3");
});
