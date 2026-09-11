/** Server-route helpers for the B3 Carta ask window. Do not import from client components. */
import { retrieveCorpus } from "@/lib/carta-ask-corpus";
import { completeCartaAsk } from "@/lib/carta-ask-llm";
import {
  extractiveAnswer,
  groundedFromHits,
  parseLlmJson,
  validateQuestion,
  type CartaAskResult,
} from "@/lib/carta-ask-shared";
import { enrichFromOpenWeb } from "@/lib/carta-ask-web";

export async function runCartaAsk(
  rawQuestion: unknown,
  env: NodeJS.Dict<string> = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; result: CartaAskResult } | { ok: false; error: string; status: number }> {
  const checked = validateQuestion(rawQuestion);
  if (!checked.ok) {
    return { ok: false, error: checked.error, status: 400 };
  }

  const hits = retrieveCorpus(checked.question);
  const web = await enrichFromOpenWeb(checked.question, env, fetchImpl);
  const completion = await completeCartaAsk({
    question: checked.question,
    hits,
    web,
    env,
    fetchImpl,
  });

  if (!completion.ok) {
    const extracted = extractiveAnswer(checked.question, hits);
    return {
      ok: true,
      result: {
        answer: extracted.answer,
        stance: extracted.stance,
        groundedIn: groundedFromHits(hits),
        notes: `${extracted.notes} Model unused: ${completion.error}`,
        web,
        model: { status: "unavailable", reason: completion.error },
      },
    };
  }

  const parsed = parseLlmJson(completion.text);
  if (!parsed) {
    const extracted = extractiveAnswer(checked.question, hits);
    return {
      ok: true,
      result: {
        answer: completion.text.trim() || extracted.answer,
        stance: extracted.stance,
        groundedIn: groundedFromHits(hits),
        notes: "The model did not return structured JSON; excerpts remain the ground.",
        web,
        model: { status: "used", id: completion.model },
      },
    };
  }

  return {
    ok: true,
    result: {
      answer: parsed.answer,
      stance: parsed.stance,
      groundedIn: groundedFromHits(hits, parsed.groundedIn),
      notes: parsed.notes,
      web,
      model: { status: "used", id: completion.model },
    },
  };
}
