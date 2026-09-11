import assert from "node:assert/strict";
import { test } from "node:test";

import { retrieveCorpus } from "./argonaut-corpus.ts";
import { buildArgonautSystemPrompt } from "./argonaut-shared.ts";

test("retrieveCorpus ranks published Carta for a soundness question", () => {
  const hits = retrieveCorpus("what is soundness in Carta");
  assert.ok(hits.length > 0, "expected published corpus hits");
  const titles = hits.map((h) => h.title.toLowerCase());
  assert.ok(
    titles.some((t) => t.includes("carta") || t.includes("soundness") || t.includes("veritas")),
    `expected Carta / axiom grounding, got ${hits.map((h) => h.title).join(", ")}`,
  );
  const prompt = buildArgonautSystemPrompt(hits, {
    status: "unavailable",
    reason: "test: web gated",
  });
  assert.match(prompt, /Published corpus excerpts/);
  assert.ok(hits.some((h) => prompt.includes(h.title)));
});
