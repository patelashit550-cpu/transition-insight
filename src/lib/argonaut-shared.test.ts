import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildArgonautSystemPrompt,
  braveSearchApiKeyFromEnv,
  argonautWebSearchEnabled,
  extractiveAnswer,
  groundedFromHits,
  openaiConfigFromEnv,
  parseLlmJson,
  rankCorpus,
  scoreDocument,
  tokenize,
  validateQuestion,
  corpusCoversQuestion,
  type CorpusDocument,
  type CorpusHit,
} from "./argonaut-shared.ts";

const carta: CorpusDocument = {
  id: "essay:governance/carta.md",
  title: "Carta",
  kind: "essay",
  tags: ["governance", "ontology", "soundness", "truth"],
  text: "Truth (veritas) serves as the basis for a process through which we generate solutions or utilities (utilitas) and structural integrity (firmitas). Another way to conceptualise soundness is that it is possessed of a kind of solidity.",
  path: "governance/Carta.md",
};

const arete: CorpusDocument = {
  id: "term:Arete",
  title: "Areté",
  kind: "term",
  tags: ["peridot", "virtue"],
  text: "Virtue as the practice of turning the competitive impulse upon oneself.",
};

test("tokenize drops stopwords and keeps ontology terms", () => {
  assert.deepEqual(tokenize("What is soundness in Carta?"), ["soundness", "carta"]);
});

test("validateQuestion rejects empty and oversized asks", () => {
  assert.equal(validateQuestion("  ").ok, false);
  assert.equal(validateQuestion("ab").ok, false);
  assert.equal(validateQuestion("What is soundness?").ok, true);
  assert.equal(validateQuestion("x".repeat(900)).ok, false);
});

test("rankCorpus prefers Carta for a soundness question", () => {
  const hits = rankCorpus("what is soundness", [arete, carta], 4);
  assert.ok(hits.length >= 1);
  assert.equal(hits[0]?.title, "Carta");
  assert.match(hits[0]?.snippet ?? "", /soundness/i);
  assert.ok((hits[0]?.score ?? 0) > scoreDocument(tokenize("soundness"), arete));
});

test("openaiConfigFromEnv rejects placeholders and allows local ollama", () => {
  assert.equal(openaiConfigFromEnv({}), null);
  assert.equal(openaiConfigFromEnv({ OPENAI_API_KEY: "YOUR_API_KEY" }), null);
  assert.equal(openaiConfigFromEnv({ OPENAI_API_KEY: "sk-live" })?.key, "sk-live");
  assert.equal(
    openaiConfigFromEnv({
      OPENAI_API_KEY: "ollama",
      OPENAI_BASE_URL: "http://127.0.0.1:11434/v1",
      OPENAI_MODEL: "llama3.2:3b",
    })?.model,
    "llama3.2:3b",
  );
  assert.equal(
    openaiConfigFromEnv({
      OPENAI_API_KEY: "ollama",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
    }),
    null,
  );
});

test("web search is gated and Brave placeholders are rejected", () => {
  assert.equal(argonautWebSearchEnabled({}), false);
  assert.equal(argonautWebSearchEnabled({ ARGONAUT_WEB_SEARCH: "1" }), true);
  assert.equal(argonautWebSearchEnabled({ CARTA_ASK_WEB_SEARCH: "1" }), true);
  assert.equal(braveSearchApiKeyFromEnv({ BRAVE_SEARCH_API_KEY: "YOUR_API_KEY" }), null);
  assert.equal(braveSearchApiKeyFromEnv({ BRAVE_SEARCH_API_KEY: "BSA..." }), "BSA...");
});

test("buildArgonautSystemPrompt includes excerpts and honesty rules", () => {
  const hits: CorpusHit[] = [
    {
      id: carta.id,
      title: carta.title,
      kind: "essay",
      score: 12,
      snippet: carta.text,
      path: carta.path,
    },
  ];
  const prompt = buildArgonautSystemPrompt(hits, {
    status: "unavailable",
    reason: "ARGONAUT_WEB_SEARCH is off",
  });
  assert.match(prompt, /Argonaut/);
  assert.match(prompt, /JSON Intelligence/);
  assert.match(prompt, /Regnum Dei/);
  assert.doesNotMatch(prompt, /Odyssey/);
  assert.doesNotMatch(prompt, /AI search through Regnum Dei/);
  assert.match(prompt, /Veritas/);
  assert.match(prompt, /Firmitas/);
  assert.match(prompt, /admit/);
  assert.match(prompt, /defer/);
  assert.match(prompt, /Carta/);
  assert.match(prompt, /soundness/);
  assert.match(prompt, /ARGONAUT_WEB_SEARCH is off/);
  assert.match(prompt, /not a general coding agent/);
});

test("parseLlmJson reads stance and groundedIn", () => {
  const parsed = parseLlmJson(
    '```json\n{"answer":"Soundness is integrity.","stance":"admit","groundedIn":["Carta"],"notes":"Grounded."}\n```',
  );
  assert.ok(parsed);
  assert.equal(parsed?.stance, "admit");
  assert.deepEqual(parsed?.groundedIn, ["Carta"]);
});

test("extractiveAnswer defers on an empty corpus", () => {
  const empty = extractiveAnswer("quantum tokenomics", []);
  assert.equal(empty.stance, "defer");
  assert.match(empty.answer, /does not yet speak/);
});

test("groundedFromHits preserves paths", () => {
  const hits = rankCorpus("soundness", [carta]);
  const grounded = groundedFromHits(hits, ["Carta"]);
  assert.equal(grounded[0]?.title, "Carta");
  assert.equal(grounded[0]?.path, "governance/Carta.md");
});

test("corpusCoversQuestion admits soundness and defers ticker invention", () => {
  const soundHits = rankCorpus("what is soundness", [carta, arete]);
  assert.equal(corpusCoversQuestion("what is soundness in Carta", soundHits), true);
  const thinHits = rankCorpus("token ticker airdrop schedule", [carta, arete]);
  assert.equal(
    corpusCoversQuestion("What is the token ticker and airdrop schedule for Transition Insight?", thinHits),
    false,
  );
  const extracted = extractiveAnswer(
    "What is the token ticker and airdrop schedule for Transition Insight?",
    thinHits.length ? thinHits : rankCorpus("transition", [carta]),
  );
  assert.equal(extracted.stance, "defer");
  assert.match(extracted.answer, /does not yet (ground|speak)/i);
});
