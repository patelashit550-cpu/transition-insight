#!/usr/bin/env node
/**
 * auto-tag-essays — propose (and optionally write) consistent frontmatter `tags`
 * for the ontology corpus, using a controlled vocabulary + TF-IDF salience.
 *
 * Cost: zero. Fully local and deterministic — no API, no network, reproducible.
 *
 * Matching is strict WORD-BOUNDARY (a keyword must be a whole word or a real
 * prefix of one), so short terms like "ai" or "sin" can't match inside
 * "again" / "since". Tags must clear a salience threshold to be proposed.
 *
 * Usage:
 *   node scripts/auto-tag-essays.mjs                 # dry-run: print proposals + corpus report
 *   node scripts/auto-tag-essays.mjs --write         # insert tags into essays that have NONE
 *   node scripts/auto-tag-essays.mjs --write --augment  # also top-up essays that already have tags
 *   node scripts/auto-tag-essays.mjs --only tenable  # limit to files whose path matches a substring
 *   node scripts/auto-tag-essays.mjs --max 5         # cap tags per essay (default 6)
 *   node scripts/auto-tag-essays.mjs --min 3         # min salience score to propose a tag (default 3)
 *
 * Safety: writing is textual (only the `tags:` block is inserted/replaced); the rest
 * of your frontmatter is never re-serialized. Human tags are always preserved.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import matter from "gray-matter";

import { walkFiles } from "./lib/walk-files.mjs";

const ONTOLOGY_DIR = join(process.cwd(), "ontology");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const WRITE = flag("write");
const AUGMENT = flag("augment");
const ONLY = opt("only", null);
const MAX_TAGS = Number(opt("max", "6"));
const MIN_SCORE = Number(opt("min", "3"));

// ─────────────────────────────────────────────────────────────────────────────
// Controlled vocabulary: canonical tag -> matching keywords/phrases (lowercase).
// Keep keywords SPECIFIC — generic words ("work", "cost", "model", "control")
// cause sprawl. Multi-word phrases are strong signals (weight 3).
// ─────────────────────────────────────────────────────────────────────────────
const TAG_KEYWORDS = {
  governance: ["governance", "govern", "statecraft", "constitution", "polity", "rule of law"],
  "political-economy": ["political economy", "working class", "means of production", "bourgeois", "proletariat", "class struggle"],
  "monetary-policy": ["monetary", "fiat", "central bank", "inflation", "interest rate", "quantitative easing", "deflation"],
  money: ["money", "currency", "wage", "wages", "debt"],
  capital: ["capitalism", "capitalist", "capital"],
  economy: ["economy", "economic", "economics"],
  sovereignty: ["sovereign", "self-determination", "self determination"],
  "self-sovereignty": ["self-sovereign", "self sovereign", "self-custody", "self custody", "self-governance", "self governance"],
  anarchism: ["anarchism", "anarchist", "anarchy", "stateless", "mutual aid"],
  "cultural-critique": ["cultural", "culture", "consumerism", "spectacle", "zeitgeist", "mass media"],
  technology: ["technology", "technological", "software", "hardware", "algorithm", "protocol"],
  intelligence: ["intelligence", "cognition", "sentience"],
  ai: ["artificial intelligence", "machine learning", "neural network", "large language model", "llm", "machina", "superintelligence"],
  ethics: ["ethics", "ethical", "morality", "moral", "virtue"],
  ecology: ["ecology", "ecological", "ecosystem", "biosphere", "regenerative"],
  environment: ["environment", "environmental", "climate", "planet", "sustainability", "sustainable"],
  identity: ["identity", "selfhood", "persona"],
  philosophy: ["philosophy", "philosophical", "metaphysics", "epistemology", "existential", "ontology", "dialectic"],
  theology: ["theology", "theological", "scripture", "gospel", "salvation", "divine", "divinity", "providence", "god", "faith", "prayer", "worship"],
  "sacred-feminine": ["sacred feminine", "anima", "goddess", "shakti"],
  mythology: ["mythology", "myth", "archetype", "parable", "legend"],
  community: ["community", "solidarity", "kinship", "belonging"],
  commons: ["commons", "public good", "common good"],
  civilization: ["civilization", "civilisation"],
  decentralization: ["decentralization", "decentralisation", "decentralized", "blockchain", "cryptography", "cryptographic", "bitcoin", "web3", "proof of stake", "peer to peer"],
  labour: ["labour", "labor", "working class", "proletariat"],
  freedom: ["freedom", "liberty", "liberation", "emancipation"],
  power: ["domination", "coercion", "hierarchy", "oppression", "authoritarian", "tyranny"],
  art: ["art", "aesthetic", "poetry", "painting", "sculpture", "music", "cinema"],
};

// ─────────────────────────────────────────────────────────────────────────────
const STOPWORDS = new Set(
  ("a an the and or but if then else for to of in on at by with without from into over under again further once here there all any both each few more most other some such no nor not only own same so than too very can will just should now this that these those i you he she it we they them his her its our their what which who whom whose been being have has had do does did doing would could may might must shall about above after before between during through against because while as is are was were be am also upon within across per via one even how where when why don your").split(
    /\s+/,
  ),
);

/** Escape + build a strict word-boundary matcher for a keyword. */
function kwRegex(kw) {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (kw.includes(" ") || kw.includes("-")) return new RegExp(`\\b${esc}\\b`, "g");
  if (kw.length >= 5) return new RegExp(`\\b${esc}[a-z]*\\b`, "g"); // stem: govern → governance
  return new RegExp(`\\b${esc}s?\\b`, "g"); // short: exact word (+ optional plural)
}

const TAG_MATCHERS = Object.fromEntries(
  Object.entries(TAG_KEYWORDS).map(([tag, kws]) => [
    tag,
    kws.map((kw) => ({ re: kwRegex(kw), weight: kw.includes(" ") ? 3 : 1 })),
  ]),
);

/** Strip markdown/frontmatter noise; return lowercased plain text (hyphens → spaces). */
function plainText(body) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[\[[^\]]*\]\]/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#>*_~|-]/g, " ")
    .toLowerCase();
}

/** Tokenize to content words (letters only, length >= 3, non-stopword). */
function tokenize(text) {
  return text.split(/[^a-z]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function normalizeTags(raw) {
  const arr = Array.isArray(raw) ? raw : typeof raw === "string" && raw.trim() ? [raw] : [];
  return arr
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => v.trim().toLowerCase().replace(/\s+/g, "-"));
}

// ── Load corpus ──────────────────────────────────────────────────────────────
const files = walkFiles(ONTOLOGY_DIR)
  .filter(({ relativePath }) => /\.(md|mdx)$/i.test(relativePath))
  .filter(({ relativePath }) => (ONLY ? relativePath.toLowerCase().includes(ONLY.toLowerCase()) : true));

const docs = [];
for (const file of files) {
  const raw = readFileSync(file.absolutePath, "utf8");
  let parsed;
  try {
    parsed = matter(raw);
  } catch {
    continue;
  }
  const data = parsed.data ?? {};
  const title = typeof data.title === "string" ? data.title : "";
  const text = plainText(`${title}\n${title}\n${parsed.content}`); // title weighted 2x
  const tokens = tokenize(text);
  const counts = new Map();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  docs.push({ ...file, data, text, counts, title, existing: normalizeTags(data.tags) });
}

// ── IDF (for novel-term surfacing only) ──────────────────────────────────────
const N = docs.length || 1;
const df = new Map();
for (const d of docs) for (const t of d.counts.keys()) df.set(t, (df.get(t) ?? 0) + 1);
const idf = (token) => Math.log(N / ((df.get(token) ?? 0) + 1)) + 1;

// ── Scoring ──────────────────────────────────────────────────────────────────
function scoreTag(doc, tag) {
  let score = 0;
  for (const { re, weight } of TAG_MATCHERS[tag]) {
    const m = doc.text.match(re);
    if (m) score += m.length * weight;
  }
  return score;
}

function proposeTags(doc) {
  const scored = [];
  for (const tag of Object.keys(TAG_KEYWORDS)) {
    const score = scoreTag(doc, tag);
    if (score >= MIN_SCORE) scored.push({ tag, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const existing = new Set(doc.existing);
  return scored.map((s) => s.tag).filter((t) => !existing.has(t));
}

/** Top salient corpus terms not covered by the vocabulary — surfaced for review. */
function novelTerms(doc, limit = 5) {
  const mappedStems = new Set(
    Object.values(TAG_KEYWORDS)
      .flat()
      .filter((k) => !k.includes(" ") && !k.includes("-")),
  );
  const scored = [];
  for (const [tok, c] of doc.counts) {
    if (c < 2) continue;
    if ([...mappedStems].some((stem) => tok.startsWith(stem))) continue;
    scored.push({ tok, s: c * idf(tok) });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.tok);
}

// ── Frontmatter block upsert (textual, non-destructive) ──────────────────────
function splitFrontmatter(raw) {
  const m = /^\uFEFF?(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)/.exec(raw);
  if (!m) return null;
  return { fmText: m[2], body: raw.slice(m[0].length), eol: raw.includes("\r\n") ? "\r\n" : "\n" };
}

function upsertTagsBlock(fmText, tags, eol) {
  const block = ["tags:", ...tags.map((t) => `  - ${t}`)].join(eol);
  const tagsBlockRe = /(^|\r?\n)tags:[ \t]*(?:\r?\n[ \t]+-[ \t].*)*/;
  if (/(^|\r?\n)tags:/.test(fmText)) return fmText.replace(tagsBlockRe, (full, lead) => `${lead}${block}`);
  return `${fmText.replace(/\s*$/, "")}${eol}${block}`;
}

function writeTags(doc, finalTags) {
  const raw = readFileSync(doc.absolutePath, "utf8");
  const split = splitFrontmatter(raw);
  if (!split) return false;
  const newFm = upsertTagsBlock(split.fmText, finalTags, split.eol);
  writeFileSync(doc.absolutePath, `---${split.eol}${newFm}${split.eol}---${split.eol}${split.body}`, "utf8");
  return true;
}

// ── Run ──────────────────────────────────────────────────────────────────────
const tagFreq = new Map();
const missing = [];
let writes = 0;

console.log(`\nauto-tag-essays — ${docs.length} essays scanned${WRITE ? " (WRITE mode)" : " (dry-run)"} · min-score ${MIN_SCORE} · max ${MAX_TAGS}\n`);

for (const doc of docs.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
  for (const t of doc.existing) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);

  const proposed = proposeTags(doc).slice(0, Math.max(0, MAX_TAGS - doc.existing.length));
  const hasNone = doc.existing.length === 0;
  if (hasNone) missing.push(doc.relativePath);

  const shouldWrite = WRITE && proposed.length > 0 && (hasNone || AUGMENT);
  if (proposed.length === 0 && !hasNone) continue;

  console.log(`• ${doc.relativePath}`);
  if (doc.existing.length) console.log(`    have:     ${doc.existing.join(", ")}`);
  console.log(`    propose:  ${proposed.length ? proposed.join(", ") : "(none — below threshold)"}`);
  const novel = novelTerms(doc);
  if (novel.length) console.log(`    consider: ${novel.join(", ")}  (novel terms, not written)`);

  if (shouldWrite) {
    const finalTags = [...new Set([...doc.existing, ...proposed])];
    if (writeTags(doc, finalTags)) {
      writes++;
      for (const t of proposed) tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1);
      console.log(`    wrote:    ${finalTags.join(", ")}`);
    }
  }
  console.log("");
}

console.log("── corpus tag frequency ─────────────────────────────");
[...tagFreq.entries()]
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .forEach(([tag, n]) => console.log(`  ${String(n).padStart(3)}  ${tag}`));

console.log(`\n${missing.length} essay(s) still have no tags.`);
if (WRITE) console.log(`Wrote tags to ${writes} file(s).`);
else console.log(`Dry-run only. Re-run with --write to apply (untagged essays), or --write --augment to top-up tagged ones.`);
console.log("");
