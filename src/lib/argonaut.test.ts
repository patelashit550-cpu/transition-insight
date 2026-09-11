import assert from "node:assert/strict";
import { test } from "node:test";

import { runArgonautAsk } from "./argonaut.ts";

test("runArgonautAsk ranks corpus and does not invent a model when keys are absent", async () => {
  const outcome = await runArgonautAsk("what is soundness", {}, async () => {
    throw new Error("network should not be used without keys");
  });
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.result.model.status, "unavailable");
  assert.equal(outcome.result.web.status, "unavailable");
  assert.ok(outcome.result.groundedIn.length > 0);
  const blob = `${outcome.result.answer} ${outcome.result.groundedIn.map((g) => g.title).join(" ")}`;
  assert.match(blob, /Carta|soundness|Veritas|Firmitas|ontology/i);
});

test("runArgonautAsk defers ticker invention instead of stretching nearby essays", async () => {
  const outcome = await runArgonautAsk(
    "What is the token ticker and airdrop schedule for Transition Insight?",
    {},
    async () => {
      throw new Error("network should not be used without keys");
    },
  );
  assert.equal(outcome.ok, true);
  if (!outcome.ok) return;
  assert.equal(outcome.result.stance, "defer");
  assert.match(outcome.result.answer, /does not yet (ground|speak)/i);
});
