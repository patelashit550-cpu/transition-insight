import {
  buildArgonautSystemPrompt,
  openaiConfigFromEnv,
  type CorpusHit,
  type WebEnrichment,
} from "@/lib/argonaut-shared";

const LLM_TIMEOUT_MS = 45_000;

export type LlmCompletion =
  | { readonly ok: true; readonly text: string; readonly model: string }
  | { readonly ok: false; readonly error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function completeArgonautAsk(params: {
  question: string;
  hits: readonly CorpusHit[];
  web: WebEnrichment;
  env?: NodeJS.Dict<string>;
  fetchImpl?: typeof fetch;
}): Promise<LlmCompletion> {
  const config = openaiConfigFromEnv(params.env ?? process.env);
  if (!config) {
    return {
      ok: false,
      error:
        "No model configured. Set OPENAI_API_KEY in .env.local (never NEXT_PUBLIC_*). Optional: OPENAI_BASE_URL, OPENAI_MODEL. Local Ollama: OPENAI_BASE_URL=http://127.0.0.1:11434/v1 and OPENAI_API_KEY=ollama.",
    };
  }

  const body = {
    model: config.model,
    temperature: 0.2,
    messages: [
      { role: "system", content: buildArgonautSystemPrompt(params.hits, params.web) },
      { role: "user", content: params.question },
    ],
  };

  try {
    const response = await (params.fetchImpl ?? fetch)(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const errMsg =
        isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string"
          ? payload.error.message
          : `Model HTTP ${response.status}`;
      return { ok: false, error: errMsg };
    }
    if (!isRecord(payload) || !Array.isArray(payload.choices)) {
      return { ok: false, error: "Model returned an unexpected payload." };
    }
    const first = payload.choices[0];
    const text =
      isRecord(first) && isRecord(first.message) && typeof first.message.content === "string"
        ? first.message.content
        : "";
    if (!text.trim()) {
      return { ok: false, error: "Model returned an empty completion." };
    }
    return { ok: true, text, model: config.model };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    return { ok: false, error: `Model unreachable (${message}).` };
  }
}
