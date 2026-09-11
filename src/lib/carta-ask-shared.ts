/**
 * Carta ask — pure helpers (ranking, prompt assembly, env parsing).
 * No filesystem, no network. Safe for unit tests and the API route.
 */

export const CARTA_ASK_MAX_QUESTION = 800;
export const CARTA_ASK_MIN_QUESTION = 3;
export const CARTA_ASK_HIT_LIMIT = 6;
export const CARTA_ASK_SNIPPET_CHARS = 720;

export const OPENAI_API_KEY_ENV = "OPENAI_API_KEY";
export const OPENAI_BASE_URL_ENV = "OPENAI_BASE_URL";
export const OPENAI_MODEL_ENV = "OPENAI_MODEL";
export const BRAVE_SEARCH_API_KEY_ENV = "BRAVE_SEARCH_API_KEY";
export const CARTA_ASK_WEB_SEARCH_ENV = "CARTA_ASK_WEB_SEARCH";

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

const PLACEHOLDER_KEYS = new Set([
  "",
  "YOUR_API_KEY",
  "your_api_key",
  "your-api-key",
  "sk-...",
  "ollama",
]);

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "to",
  "in",
  "on",
  "for",
  "is",
  "it",
  "as",
  "at",
  "by",
  "be",
  "we",
  "i",
  "you",
  "your",
  "our",
  "this",
  "that",
  "with",
  "from",
  "what",
  "which",
  "how",
  "why",
  "when",
  "who",
  "does",
  "do",
  "did",
  "are",
  "was",
  "were",
  "can",
  "could",
  "should",
  "would",
  "about",
  "into",
  "than",
  "then",
  "its",
  "if",
  "not",
  "but",
  "so",
]);

export type CartaAskStance = "admit" | "defer" | "refuse";

export type CorpusDocument = {
  readonly id: string;
  readonly title: string;
  readonly kind: "essay" | "term";
  readonly tags: readonly string[];
  readonly text: string;
  readonly path?: string;
};

export type CorpusHit = {
  readonly id: string;
  readonly title: string;
  readonly kind: "essay" | "term";
  readonly score: number;
  readonly snippet: string;
  readonly path?: string;
};

export type WebSource = {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
};

export type WebEnrichment =
  | { readonly status: "used"; readonly sources: readonly WebSource[] }
  | { readonly status: "unavailable"; readonly reason: string }
  | { readonly status: "empty"; readonly reason: string };

export type ModelStatus =
  | { readonly status: "used"; readonly id: string }
  | { readonly status: "unavailable"; readonly reason: string };

export type CartaAskResult = {
  readonly answer: string;
  readonly stance: CartaAskStance;
  readonly groundedIn: readonly { readonly title: string; readonly path?: string }[];
  readonly notes: string;
  readonly web: WebEnrichment;
  readonly model: ModelStatus;
};

export function envSecretFrom(
  env: NodeJS.Dict<string>,
  key: string,
  extraPlaceholders: readonly string[] = [],
): string | null {
  const raw = env[key];
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (PLACEHOLDER_KEYS.has(value)) return null;
  if (extraPlaceholders.some((p) => p.toLowerCase() === value.toLowerCase())) return null;
  return value;
}

/**
 * OpenAI-compatible key. `ollama` is allowed when the base URL is local —
 * call {@link openaiConfigFromEnv} instead of this for that case.
 */
export function openaiApiKeyFromEnv(env: NodeJS.Dict<string> = process.env): string | null {
  return envSecretFrom(env, OPENAI_API_KEY_ENV);
}

export function openaiConfigFromEnv(env: NodeJS.Dict<string> = process.env): {
  readonly key: string;
  readonly baseUrl: string;
  readonly model: string;
} | null {
  const baseRaw = env[OPENAI_BASE_URL_ENV];
  const baseUrl =
    typeof baseRaw === "string" && baseRaw.trim()
      ? baseRaw.trim().replace(/\/+$/, "")
      : DEFAULT_OPENAI_BASE_URL;
  const modelRaw = env[OPENAI_MODEL_ENV];
  const model =
    typeof modelRaw === "string" && modelRaw.trim() ? modelRaw.trim() : DEFAULT_OPENAI_MODEL;

  const strict = envSecretFrom(env, OPENAI_API_KEY_ENV);
  if (strict) return { key: strict, baseUrl, model };

  const raw = typeof env[OPENAI_API_KEY_ENV] === "string" ? env[OPENAI_API_KEY_ENV].trim() : "";
  const local =
    /^https?:\/\/(127\.0\.0\.1|localhost|host\.docker\.internal)(:\d+)?(\/|$)/i.test(baseUrl);
  if (local && raw && raw.toLowerCase() === "ollama") {
    return { key: "ollama", baseUrl, model };
  }
  return null;
}

export function braveSearchApiKeyFromEnv(env: NodeJS.Dict<string> = process.env): string | null {
  return envSecretFrom(env, BRAVE_SEARCH_API_KEY_ENV);
}

export function cartaAskWebSearchEnabled(env: NodeJS.Dict<string> = process.env): boolean {
  const raw = env[CARTA_ASK_WEB_SEARCH_ENV];
  if (typeof raw !== "string") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function validateQuestion(
  raw: unknown,
): { ok: true; question: string } | { ok: false; error: string } {
  if (typeof raw !== "string") {
    return { ok: false, error: "Ask a question in plain language." };
  }
  const question = raw.replace(/\s+/g, " ").trim();
  if (question.length < CARTA_ASK_MIN_QUESTION) {
    return { ok: false, error: "A little more of the question, please." };
  }
  if (question.length > CARTA_ASK_MAX_QUESTION) {
    return { ok: false, error: `Keep the question under ${CARTA_ASK_MAX_QUESTION} characters.` };
  }
  return { ok: true, question };
}

export function tokenize(text: string): string[] {
  const tokens = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
  return tokens;
}

function tokenSet(tokens: readonly string[]): Set<string> {
  return new Set(tokens);
}

export function snippetAroundTokens(
  text: string,
  tokens: readonly string[],
  maxChars = CARTA_ASK_SNIPPET_CHARS,
): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) return "";
  if (compact.length <= maxChars) return compact;

  const lower = compact.toLowerCase();
  let best = 0;
  for (const token of tokens) {
    const idx = lower.indexOf(token);
    if (idx >= 0) {
      best = idx;
      break;
    }
  }
  const half = Math.floor(maxChars / 2);
  const start = Math.max(0, best - half);
  const end = Math.min(compact.length, start + maxChars);
  const slice = compact.slice(start, end).trim();
  const prefix = start > 0 ? "…" : "";
  const suffix = end < compact.length ? "…" : "";
  return `${prefix}${slice}${suffix}`;
}

export function scoreDocument(queryTokens: readonly string[], doc: CorpusDocument): number {
  if (queryTokens.length === 0) return 0;
  const q = tokenSet(queryTokens);
  const titleTokens = tokenize(doc.title);
  const tagTokens = tokenize(doc.tags.join(" "));
  const bodyTokens = tokenize(doc.text.slice(0, 12_000));
  const idTokens = tokenize(doc.id.replace(/[:/._-]+/g, " "));

  let score = 0;
  const titleLower = doc.title.toLowerCase();
  const joinedQuery = queryTokens.join(" ");
  if (joinedQuery && titleLower.includes(joinedQuery)) score += 10;

  for (const token of q) {
    if (titleTokens.includes(token)) score += 4;
    if (idTokens.includes(token)) score += 2;
    if (tagTokens.includes(token)) score += 2;
  }

  let bodyHits = 0;
  for (const token of bodyTokens) {
    if (q.has(token)) bodyHits += 1;
    if (bodyHits >= 16) break;
  }
  score += Math.min(12, bodyHits);

  return score;
}

export function rankCorpus(
  question: string,
  documents: readonly CorpusDocument[],
  limit = CARTA_ASK_HIT_LIMIT,
): CorpusHit[] {
  const queryTokens = tokenize(question);
  const scored = documents
    .map((doc) => {
      const score = scoreDocument(queryTokens, doc);
      return {
        id: doc.id,
        title: doc.title,
        kind: doc.kind,
        score,
        snippet: snippetAroundTokens(doc.text, queryTokens),
        ...(doc.path ? { path: doc.path } : {}),
      } satisfies CorpusHit;
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored.slice(0, limit);
}

export function buildCartaSystemPrompt(hits: readonly CorpusHit[], web: WebEnrichment): string {
  const excerpts = hits
    .map((hit, i) => {
      const where = hit.path ? ` (${hit.path})` : "";
      return `[${i + 1}] ${hit.title}${where} — ${hit.kind}\n${hit.snippet}`;
    })
    .join("\n\n");

  const webBlock =
    web.status === "used"
      ? web.sources
          .map((s) => `- ${s.title} <${s.url}>\n  ${s.snippet}`)
          .join("\n")
      : web.status === "unavailable"
        ? `(Open web not consulted: ${web.reason})`
        : `(Open web returned nothing useful: ${web.reason})`;

  return [
    "You are the Carta lens for Transition Insight (ashitmilne.xyz / ashitmilne).",
    "You are not a general coding agent and not a chatbot for hire.",
    "The ontology is an interpretive FILTER. Rank and shape material through it; do not invent doctrine.",
    "",
    "Axioms to keep in view:",
    "- Veritas (truth as foundation), Utilitas (utility as generative process), Firmitas (structural integrity).",
    "- Soundness: equilibrium of speed and stillness, minimal noise, natural weathering rather than extrinsic invasion.",
    "- Semper Idem: bounded, authentic identity across physical and digital realms.",
    "- Alpha (chosen trajectory), Beta (left-handed departure), Omega (holistic outcome).",
    "- Capital as E Pluribus Unum: inputs valued for utility or beauty in the Commons.",
    "- Admit what the corpus can ground. Defer when the published ontology is silent or incomplete (~10% by the author’s estimate). Refuse hype, tokenomics invention, and claims that would mint new doctrine.",
    "",
    "Voice: clear, deliberate, human. No Web3 jargon, no corporate cheer.",
    "If the corpus cannot ground a claim, say so in plain language. Prefer a flagged gap over a fluent falsehood.",
    "",
    "Published corpus excerpts (authoritative for this lens):",
    excerpts || "(no excerpts ranked — treat this as a gap)",
    "",
    "Open-web material (untrusted until filtered through the excerpts above):",
    webBlock,
    "",
    "Reply with compact JSON only, no markdown fences:",
    '{"answer":"prose","stance":"admit|defer|refuse","groundedIn":["Title", "..."],"notes":"one short honesty line"}',
    "stance=admit only when excerpts actually support the core claim.",
    "stance=defer when the corpus is thin or silent — still answer as far as honesty allows.",
    "stance=refuse for requests that would have you invent governance, wallets, or doctrine the site does not hold.",
  ].join("\n");
}

export function parseLlmJson(raw: string): {
  answer: string;
  stance: CartaAskStance;
  groundedIn: string[];
  notes: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.unshift(fenced[1].trim());
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object") continue;
      const rec = parsed as Record<string, unknown>;
      const answer = typeof rec.answer === "string" ? rec.answer.trim() : "";
      if (!answer) continue;
      const stanceRaw = typeof rec.stance === "string" ? rec.stance.trim().toLowerCase() : "defer";
      const stance: CartaAskStance =
        stanceRaw === "admit" || stanceRaw === "refuse" || stanceRaw === "defer"
          ? stanceRaw
          : "defer";
      const groundedIn = Array.isArray(rec.groundedIn)
        ? rec.groundedIn.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
        : [];
      const notes = typeof rec.notes === "string" ? rec.notes.trim() : "";
      return { answer, stance, groundedIn, notes };
    } catch {
      continue;
    }
  }
  return null;
}

export function extractiveAnswer(question: string, hits: readonly CorpusHit[]): {
  answer: string;
  stance: CartaAskStance;
  notes: string;
} {
  if (hits.length === 0) {
    return {
      stance: "defer",
      notes: "Gap: the published corpus does not yet ground this question.",
      answer:
        "The published ontology does not yet speak to this with enough density to ground an answer. Carta is incomplete by design — a gap here is a flag, not a licence to invent doctrine. Ask again from Veritas, Utilitas, or Firmitas, or name a term from Canonical / Peridot.",
    };
  }

  const titles = [...new Set(hits.map((h) => h.title))];
  const lead = hits[0];
  const covers = corpusCoversQuestion(question, hits);
  if (!covers) {
    return {
      stance: "defer",
      notes: `Gap: the distinctive terms in the question are not grounded in the published corpus. Adjacent titles (${titles.join(", ")}) are not doctrine.`,
      answer:
        `The published ontology does not yet ground this question. Nearby titles exist — ${titles.slice(0, 3).join(", ")} — but Carta will not stretch them into an answer. Name Soundness, Semper Idem, Veritas, Utilitas, or Firmitas, or treat this as an unfinished chapter rather than a hidden teaching.`,
    };
  }
  const stance: CartaAskStance = lead && lead.score >= 8 ? "admit" : "defer";
  const quoted = hits
    .slice(0, 2)
    .map((h) => `${h.title}: “${h.snippet}”`)
    .join("\n\n");
  const honesty =
    stance === "admit"
      ? `Grounded in ${titles.join(", ")}. Interpretation beyond these excerpts is withheld.`
      : `Thin grounding (${titles.join(", ")}). Treat this as a pointer, not a closed teaching.`;

  return {
    stance,
    notes: honesty,
    answer: [
      `Asked through Carta: ${question}`,
      "",
      quoted,
      "",
      "The lens will not mint further doctrine from this. A configured model can interpret the same excerpts; without one, this is the corpus speaking for itself.",
    ].join("\n"),
  };
}

export function groundedFromHits(
  hits: readonly CorpusHit[],
  names?: readonly string[],
): { title: string; path?: string }[] {
  const out: { title: string; path?: string }[] = [];
  const seen = new Set<string>();
  const push = (title: string, path?: string) => {
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(path ? { title, path } : { title });
  };

  if (names && names.length > 0) {
    const byTitle = new Map(hits.map((h) => [h.title.toLowerCase(), h]));
    for (const name of names) {
      const hit = byTitle.get(name.toLowerCase());
      push(hit?.title ?? name, hit?.path);
    }
    return out;
  }
  for (const hit of hits) {
    push(hit.title, hit.path);
  }
  return out;
}

const GENERIC_QUERY_TOKENS = new Set([
  "transition",
  "insight",
  "ashit",
  "milne",
  "please",
  "explain",
  "mean",
  "means",
  "define",
  "definition",
  "term",
  "terms",
]);

/**
 * Whether excerpt hits actually speak to the distinctive tokens in the question.
 * Site-name tokens alone are not enough to admit.
 */
export function corpusCoversQuestion(question: string, hits: readonly CorpusHit[]): boolean {
  if (hits.length === 0) return false;
  const distinctive = tokenize(question).filter((t) => !GENERIC_QUERY_TOKENS.has(t));
  const lead = hits[0];
  if (distinctive.length === 0) return (lead?.score ?? 0) >= 8;
  const blob = new Set(
    tokenize(hits.slice(0, 3).map((h) => `${h.title} ${h.snippet}`).join(" ")),
  );
  const matched = distinctive.filter((t) => blob.has(t)).length;
  if (matched === 0) return false;
  return matched >= Math.min(2, distinctive.length) || matched / distinctive.length >= 0.5;
}
