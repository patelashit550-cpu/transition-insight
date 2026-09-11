import assert from "node:assert/strict";
import { test } from "node:test";

import { parseBraveWebResults } from "./carta-ask-web.ts";
import { enrichFromOpenWeb } from "./carta-ask-web.ts";

test("parseBraveWebResults reads title url description", () => {
  const sources = parseBraveWebResults({
    web: {
      results: [
        { title: "Vitruvius", url: "https://example.com/firmitas", description: "firmness" },
        { title: "", url: "https://example.com/skip" },
      ],
    },
  });
  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.title, "Vitruvius");
});

test("enrichFromOpenWeb stays gated without the flag", async () => {
  const web = await enrichFromOpenWeb("soundness", {}, async () => {
    throw new Error("fetch should not run");
  });
  assert.equal(web.status, "unavailable");
  assert.match(web.reason, /CARTA_ASK_WEB_SEARCH/);
});

test("enrichFromOpenWeb reports a missing Brave key instead of fetching", async () => {
  const web = await enrichFromOpenWeb("soundness", { CARTA_ASK_WEB_SEARCH: "1" }, async () => {
    throw new Error("fetch should not run");
  });
  assert.equal(web.status, "unavailable");
  assert.match(web.reason, /BRAVE_SEARCH_API_KEY/);
});
