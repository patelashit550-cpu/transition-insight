#!/usr/bin/env node
/**
 * Generate Canonical.md from the published corpus (stage published | canonical).
 *
 *   npm run canon:generate              # candidates + stamp meta (does NOT overwrite Canonical.md)
 *   npm run canon:generate -- --write   # also overwrite ontology/governance/Canonical.md
 *   npm run canon:generate -- --dry     # print candidates only
 *   npm run canon:generate -- --ollama  # refine definitions via local Ollama
 *   npm run canon:generate -- --model llama3.2:3b
 *
 * Source of truth = essays. Curated glossary stays in Canonical.md until you pass --write.
 * Inferences in scripts/data/canonical-inferences.json are used only when their
 * listed sources intersect the published set (optional boost, not a dump).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";

import { isStageIncludedInBuild, normalizeStage } from "./lib/content-provenance.mjs";
import { walkFiles } from "./lib/walk-files.mjs";

const ROOT = process.cwd();
const ONTOLOGY = join(ROOT, "ontology");
const CANON_PATH = join(ONTOLOGY, "governance", "Canonical.md");
const CANDIDATES_PATH = join(ROOT, "semantic-graph", "Canonical Candidates.md");
const META_PATH = join(ROOT, "scripts", "data", "canon-generated.json");
const INFERENCES_PATH = join(ROOT, "scripts", "data", "canonical-inferences.json");

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const WRITE_DOC = args.includes("--write");
const USE_OLLAMA = args.includes("--ollama");
const modelIdx = args.indexOf("--model");
const OLLAMA_MODEL =
  modelIdx >= 0 && args[modelIdx + 1] ? args[modelIdx + 1] : "llama3.2:3b";

const EXCLUDE = new Set([
  "lexica.md",
  "canonical.md",
  "canon.md",
  "governance/canon.md",
  "governance/canonical.md",
  "governance/canon.legacy.md",
]);

/** Seed concepts that count when attested in published text (not dumped wholesale). */
const SEED_TERMS = [
  "Areté",
  "Arete",
  "Virtue",
  "Giants",
  "Namaste",
  "Dial Square",
  "Stone Rose",
  "Semper Idem",
  "Semantic Perimeter",
  "Calling",
  "Call to Adventure",
  "Commons",
  "Creation",
  "Praxis",
  "Anima",
  "Animus",
  "Maya",
  "Hormesis",
  "Yield",
  "Governance",
  "Identity",
  "Capital",
  "Intelligence",
  "Self-sovereign",
  "Self-sovereignty",
  "Anarchism",
  "Anarchy",
  "Ki",
  "Social Credit",
  "Social Network",
  "Body Politic",
  "Matthew Effect",
  "Reed's Law",
  "Metcalfe's Law",
  "Soft Power",
  "Hard Power",
  "Omega",
  "Alpha",
  "Orthodoxy",
  "Satyagraha",
  "Machina",
  "Machina Animus",
  "D.E.C.A.Y",
  "Leviathan",
  "Sovereign",
  "Perimeter",
  "Flow",
  "Autonomy",
  "Utility",
  "Truth",
  "Beauty",
  "Firmness",
  "Firmitas",
  "Tel",
  "Tev",
  "Ledger",
  "Tenable",
  "Peridot",
  "Yoga Element",
  "Transition Insight",
  "Moral Injury",
  "Political Economy",
  "Keiretsu",
  "Noblesse Oblige",
  "The Young Idea",
  "Project",
  "Product",
  "Protocol",
];

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function cleanWiki(value) {
  return value
    .replace(/^!?\[\[/, "")
    .replace(/\]\]$/, "")
    .split("|", 1)[0]
    .split("#", 1)[0]
    .trim();
}

function slugKey(term) {
  return term.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

function collectPublishedEssays() {
  return walkFiles(ONTOLOGY)
    .filter(({ relativePath }) => /\.(md|mdx)$/i.test(relativePath))
    .filter(({ relativePath }) => {
      const n = normalizePath(relativePath).toLowerCase();
      return (
        !EXCLUDE.has(n) &&
        !n.endsWith("/canon.md") &&
        !n.endsWith("/canonical.md") &&
        !n.endsWith("/canon.legacy.md")
      );
    })
    .map(({ relativePath, absolutePath }) => {
      const raw = readFileSync(absolutePath, "utf8");
      const parsed = matter(raw);
      const stage = normalizeStage(parsed.data.stage);
      if (!isStageIncludedInBuild(stage, "global")) return null;
      const title =
        typeof parsed.data.title === "string" && parsed.data.title.trim()
          ? parsed.data.title.trim()
          : basename(relativePath).replace(/\.(md|mdx)$/i, "");
      const lexica = Array.isArray(parsed.data.lexica)
        ? parsed.data.lexica.filter((v) => typeof v === "string").map(cleanWiki).filter(Boolean)
        : [];
      return {
        path: normalizePath(relativePath),
        title,
        stage,
        lexica,
        content: parsed.content,
        text: `${title}\n${parsed.content}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function splitSentences(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/^>\s?/, "").replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 40 && s.length <= 420 && !s.startsWith("---") && !s.startsWith("#"));
}

function mentionCount(text, term) {
  if (term.length < 2) return 0;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu");
  return [...text.matchAll(re)].length;
}

function gatherSnippets(essays, term, limit = 4) {
  const out = [];
  for (const essay of essays) {
    const sentences = splitSentences(essay.content);
    for (const sentence of sentences) {
      if (mentionCount(sentence, term) > 0) {
        out.push({ path: essay.path, sentence });
      }
    }
  }
  // Prefer definitional tone
  out.sort((a, b) => scoreSentence(b.sentence, term) - scoreSentence(a.sentence, term));
  return out.slice(0, limit);
}

function scoreSentence(sentence, term) {
  let score = 0;
  const lower = sentence.toLowerCase();
  const t = term.toLowerCase();
  if (lower.includes(`${t} is `) || lower.includes(`${t} are `)) score += 5;
  if (lower.includes("i call") || lower.includes("we call")) score += 4;
  if (lower.includes("means") || lower.includes("refers") || lower.includes("represents")) score += 3;
  if (sentence.includes("—") || sentence.includes(":") ) score += 1;
  if (/^\*\*/.test(sentence) || sentence.includes(`**${term}`)) score += 2;
  score += Math.min(sentence.length / 80, 3);
  return score;
}

function extractCandidates(essays) {
  const scores = new Map();

  const bump = (term, weight, path) => {
    const cleaned = term.replace(/\s+/g, " ").trim();
    if (cleaned.length < 3 || cleaned.length > 48) return;
    if (/^\d+$/.test(cleaned)) return;
    const key = slugKey(cleaned);
    // drop ultra-generic single words unless seeded
    const generic = new Set([
      "work", "life", "time", "world", "people", "thing", "things", "way", "ways",
      "power", "order", "form", "data", "site", "path", "paths", "act",
    ]);
    if (generic.has(key) && !SEED_TERMS.some((s) => slugKey(s) === key)) return;

    const existing = scores.get(key) || { term: cleaned, score: 0, paths: new Set() };
    // Prefer Title Case / seeded display form
    if (cleaned === cleaned.toUpperCase() && cleaned.length <= 3) {
      /* keep acronyms */
    } else if (/^[a-z]/.test(cleaned) && existing.term[0] === existing.term[0].toUpperCase()) {
      /* keep existing casing */
    } else if (SEED_TERMS.some((s) => slugKey(s) === key)) {
      existing.term = SEED_TERMS.find((s) => slugKey(s) === key);
    } else if (cleaned[0] === cleaned[0].toUpperCase()) {
      existing.term = cleaned;
    }
    existing.score += weight;
    existing.paths.add(path);
    scores.set(key, existing);
  };

  for (const essay of essays) {
    for (const term of essay.lexica) {
      // Skip obvious person names / thin generics from early lexica lists
      if (/^(ash |ashit |education|international|migration)$/i.test(term)) continue;
      bump(term, 8, essay.path);
    }

    for (const seed of SEED_TERMS) {
      const n = mentionCount(essay.text, seed);
      if (n > 0) bump(seed, 3 + Math.min(n, 5), essay.path);
    }

    // Explicit bold lead-ins: **Intelligence:** etc.
    for (const match of essay.content.matchAll(/\*\*([^*]{3,40})\*\*:/g)) {
      bump(match[1].trim(), 6, essay.path);
    }

    // "I call these X" / "known as X"
    for (const match of essay.content.matchAll(
      /(?:I call these|I call this|known as|referred to as|we call)\s+([A-Za-z][A-Za-z0-9'’\- ]{2,40}?)(?:\s+[—\-]|\s+\(|[,.]| emb)/gi
    )) {
      bump(match[1].trim(), 7, essay.path);
    }
  }

  // Optional: inferences whose sources intersect published paths
  if (existsSync(INFERENCES_PATH)) {
    const publishedPaths = new Set(essays.map((e) => e.path));
    try {
      const inferences = JSON.parse(readFileSync(INFERENCES_PATH, "utf8"));
      for (const row of inferences) {
        const sources = Array.isArray(row.sources) ? row.sources : [];
        const hit = sources.some((s) => publishedPaths.has(normalizePath(s)));
        if (!hit) continue;
        const n = essays.reduce((sum, e) => sum + mentionCount(e.text, row.term), 0);
        if (n === 0) continue;
        bump(row.term, 5 + Math.min(n, 4), sources.find((s) => publishedPaths.has(normalizePath(s))));
      }
    } catch {
      /* ignore */
    }
  }

  return [...scores.values()]
    .filter((row) => row.score >= 5 || row.paths.size >= 2)
    .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
    .slice(0, 48);
}

function extractiveDefinition(term, snippets) {
  if (!snippets.length) {
    return {
      definition: `_Attested in the published corpus; definition pending denser usage._`,
      method: "stub",
    };
  }
  const best = snippets[0].sentence.replace(/\s+/g, " ").trim();
  // Light cleanup: strip markdown emphasis
  const cleaned = best.replace(/\*\*/g, "").replace(/\*/g, "");
  // If it already defines, use it; else frame it
  const lower = cleaned.toLowerCase();
  const t = term.toLowerCase();
  if (lower.includes(`${t} is `) || lower.includes(`${t} are `) || lower.startsWith("i call")) {
    return { definition: cleaned, method: "extractive" };
  }
  const extras = snippets
    .slice(1, 3)
    .map((s) => s.sentence.replace(/\*\*/g, "").replace(/\*/g, "").trim());
  const body = [cleaned, ...extras].join(" ");
  // Compress to ~2 sentences max
  const sentences = splitSentences(body).slice(0, 2);
  const definition =
    sentences.join(" ") ||
    `In this corpus, ${term} marks a load-bearing concept grounded in the surrounding essays.`;
  return { definition, method: "extractive-synthesis" };
}

async function ollamaRefine(term, snippets, fallback) {
  const context = snippets.map((s) => `- (${s.path}) ${s.sentence}`).join("\n");
  const prompt = `You write glossary entries for Transition Insight / Regnum Dei.
Write ONE tight definition (1-2 sentences) for the term "${term}".
Use ONLY the source snippets. No bullet points. No preamble. Match a serious essay voice.
If snippets are thin, stay cautious and descriptive.

Snippets:
${context}

Definition:`;

  try {
    const res = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: { temperature: 0.2, num_predict: 160 },
      }),
    });
    if (!res.ok) return { definition: fallback, method: "extractive-fallback" };
    const data = await res.json();
    const text = String(data.response || "")
      .trim()
      .replace(/^["']|["']$/g, "");
    if (text.length < 40) return { definition: fallback, method: "extractive-fallback" };
    return { definition: text, method: `ollama:${OLLAMA_MODEL}` };
  } catch {
    return { definition: fallback, method: "extractive-fallback" };
  }
}

function renderCandidates(entries, essayPaths) {
  const blocks = entries.flatMap((entry) => {
    return [
      `## ${entry.term}`,
      "",
      entry.definition,
      "",
      `<!-- score: ${entry.score} · method: ${entry.method} · sources: ${entry.sources.join("; ")} -->`,
      "",
    ];
  });

  return [
    "---",
    "generated: true",
    "type: canonical-candidates",
    "---",
    "",
    "# Canonical Candidates",
    "",
    "> Scratch output from `npm run canon:generate`. Merge into `ontology/governance/Canonical.md` — do not publish this file.",
    "",
    `Published essays (${essayPaths.length}): ${essayPaths.map((p) => `\`${p}\``).join(", ")}`,
    "",
    ...blocks,
    "",
  ].join("\n");
}

function renderCanon(entries, essayPaths) {
  const blocks = entries.flatMap((entry) => {
    const sourceNote = entry.sources.length
      ? `\n\n<!-- sources: ${entry.sources.join("; ")} | method: ${entry.method} -->`
      : "";
    return [`## ${entry.term}`, "", entry.definition + sourceNote, ""];
  });

  return [
    "---",
    "title: Canonical",
    "label: Glossary",
    "stage: draft",
    "type: reference",
    "series: Regnum Dei",
    "theme: emerald",
    "showInNav: false",
    "slug: canonical",
    "jurisdiction: Ashit Milne",
    "tags:",
    "  - governance",
    "  - semantics",
    "  - ontology",
    "image: /assets/canon.jpg",
    'imageAlt: "Canonical: an emerald eye formed by an O and inward-facing brackets"',
    "imageRole: inset",
    "generated: true",
    `generatedAt: ${new Date().toISOString().slice(0, 10)}`,
    "---",
    "",
    "# Canonical",
    "",
    "> Generated from the **published** corpus. Essays are the source of truth; this lexicon is derived and will regenerate as the corpus unfolds.",
    "",
    `Source essays (${essayPaths.length}): ${essayPaths.map((p) => `\`${p}\``).join(", ")}`,
    "",
    ...blocks,
    "",
  ].join("\n");
}

async function main() {
  const essays = collectPublishedEssays();
  if (!essays.length) throw new Error("No published/canonical essays found.");

  const candidates = extractCandidates(essays);
  const entries = [];

  for (const candidate of candidates) {
    const snippets = gatherSnippets(essays, candidate.term);
    let { definition, method } = extractiveDefinition(candidate.term, snippets);
    if (USE_OLLAMA) {
      const refined = await ollamaRefine(candidate.term, snippets, definition);
      definition = refined.definition;
      method = refined.method;
    }
    entries.push({
      term: candidate.term,
      definition,
      method,
      score: candidate.score,
      sources: [...candidate.paths].sort(),
      snippetCount: snippets.length,
    });
  }

  entries.sort((a, b) => a.term.localeCompare(b.term));

  const essayPaths = essays.map((e) => e.path);
  const meta = {
    generatedAt: new Date().toISOString(),
    essayCount: essays.length,
    essays: essayPaths,
    termCount: entries.length,
    ollama: USE_OLLAMA ? OLLAMA_MODEL : null,
    wroteCanonicalDoc: WRITE_DOC,
    entries: entries.map(({ term, method, score, sources, snippetCount }) => ({
      term,
      method,
      score,
      sources,
      snippetCount,
    })),
  };

  if (DRY) {
    console.log(JSON.stringify(meta, null, 2));
    return;
  }

  mkdirSync(join(ROOT, "scripts", "data"), { recursive: true });
  mkdirSync(join(ROOT, "semantic-graph"), { recursive: true });
  writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  writeFileSync(CANDIDATES_PATH, renderCandidates(entries, essayPaths), "utf8");

  if (WRITE_DOC) {
    writeFileSync(CANON_PATH, renderCanon(entries, essayPaths), "utf8");
  }

  console.log(
    [
      "canon:generate",
      `${essays.length} published essays`,
      `${entries.length} terms`,
      USE_OLLAMA ? `ollama=${OLLAMA_MODEL}` : "extractive",
      WRITE_DOC ? "wrote Canonical.md" : "candidates only (pass --write to overwrite Canonical.md)",
      `meta: scripts/data/canon-generated.json`,
    ].join(" | ")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});