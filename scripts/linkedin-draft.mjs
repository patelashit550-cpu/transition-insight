#!/usr/bin/env node
/**
 * Draft a LinkedIn post that points at a published essay. Local only: nothing is posted.
 *
 *   node scripts/linkedin-draft.mjs ontology/…/essay.md [more.md …]
 *   node scripts/linkedin-draft.mjs --auto     (essays newly published, or publishedAt changed, vs HEAD)
 *   --force    overwrite an existing draft
 *
 * Uses Mistral (MISTRAL_API_KEY from .env.local). Output: linkedin/drafts/<slug>.md (gitignored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import matter from "gray-matter";
import { loadEnvFiles } from "./lib/load-env.mjs";
import { listMarkdownDelta } from "./lib/md-delta.mjs";
import { runSync } from "./lib/run-cmd.mjs";

const SITE = "https://transition-insight.sol.site";
const OUT_DIR = "linkedin/drafts";
// Tried in order; the free tier often rate-limits one model while others still answer.
const MODELS = [process.env.MISTRAL_MODEL || "mistral-small-latest", "open-mistral-nemo", "ministral-8b-latest"];
let usedModel = MODELS[0];

export const BANNED = [
  "excited to share", "thrilled", "delighted to", "proud to announce", "game-changer", "game changer",
  "unlock", "unleash", "leverage", "synergy", "revolutionize", "revolutionise", "cutting-edge",
  "paradigm shift", "deep dive", "dive into", "let's dive", "in today's", "fast-paced", "landscape",
  "navigate the", "journey", "empower", "harness", "elevate", "seamless", "transformative",
  "thought leader", "must-read", "what do you think", "agree?", "thoughts?", "let me know in the comments",
  "drop a comment", "share your", "i'd love to hear", "hot take", "here's the thing", "buckle up",
  "spoiler", "a thread", "🧵", "👇", "delve", "tapestry", "testament to",
];

/** Return the list of guard violations for a candidate post. */
export function violations(text, url) {
  const out = [];
  const lower = text.toLowerCase();
  for (const p of BANNED) if (lower.includes(p)) out.push(`banned phrase "${p}"`);
  if (/\p{Extended_Pictographic}/u.test(text)) out.push("emoji");
  const tags = text.match(/(^|\s)#\w+/g) || [];
  if (tags.length > 2) out.push(`${tags.length} hashtags`);
  const words = text.replace(url, "").split(/\s+/).filter(Boolean).length;
  if (words < 80 || words > 180) out.push(`${words} words`);
  if (!text.trim().endsWith(url)) out.push("does not end with canonical link");
  return out;
}

function routeFor(slug) {
  for (const f of ["out/sitemap.xml", "public/sitemap.xml"]) {
    if (!existsSync(f)) continue;
    const locs = [...readFileSync(f, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const hit = locs.find((l) => new URL(l).pathname.replace(/\/$/, "").split("/").pop() === slug);
    if (hit) return new URL(hit).pathname.replace(/\/?$/, "/");
  }
  return null;
}

function publishedAtAtHead(path) {
  const r = runSync("git", ["show", `HEAD:${path}`], { stdio: "pipe", encoding: "utf8" });
  if (r.status !== 0) return null;
  try {
    return String(matter(r.stdout).data.publishedAt ?? "") || null;
  } catch {
    return null;
  }
}

/** Essays in the working-tree delta that are newly live or whose publishedAt changed. */
export function detectNewlyPublished(entries = listMarkdownDelta()) {
  return entries
    .filter((e) => e.kind === "content" && e.live && e.status !== "deleted")
    .filter((e) => {
      if (!e.wasLive) return true;
      const now = String(matter(readFileSync(e.path, "utf8")).data.publishedAt ?? "") || null;
      return now !== null && now !== publishedAtAtHead(e.path);
    })
    .map((e) => e.path);
}

const SYSTEM = `You write LinkedIn posts for Ashit Milne that point readers to his long-form essays. Rules:
- 80 to 180 words, Canadian English spelling (colour, centre, -ize is fine), plain prose, short paragraphs.
- Open with a concrete line or idea from the essay: quote his own words exactly (in quotation marks) or paraphrase closely. No preamble.
- Then one or two sentences stating the essay's actual argument, in his register: precise, a little dry, no hype.
- No emojis. At most two hashtags, and only if genuinely useful (zero is fine).
- Never use: "excited to share", buzzwords (leverage, unlock, journey, landscape, game-changer, deep dive, transformative, empower), engagement-bait questions ("What do you think?", "Agree?"), or calls to comment.
- Do not invent facts or claims not in the essay. Do not describe the essay as a "must-read".
- The final line must be exactly the URL given, on its own line, with nothing after it.
Return only the post text.`;

async function mistral(messages) {
  const key = process.env.MISTRAL_API_KEY;
  if (!key) throw new Error("MISTRAL_API_KEY not set in .env.local");
  let res;
  let last = "";
  for (const model of MODELS) {
    // Free tier rate-limits hard (429): brief backoff, then fall through to the next model.
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, temperature: 0.6, messages }),
      });
      if (res.status !== 429) break;
      await new Promise((r) => setTimeout(r, 4000 * 2 ** attempt));
    }
    if (res.ok) {
      usedModel = model;
      break;
    }
    last = `Mistral HTTP ${res.status} (${model}): ${(await res.text()).slice(0, 200)}`;
    if (res.status !== 429 && res.status !== 403) break;
  }
  if (!res.ok) throw new Error(last);
  const json = await res.json();
  return String(json.choices?.[0]?.message?.content ?? "").trim();
}

function finalize(text, url) {
  // LinkedIn renders no markdown: drop bold/italic markers; unwrap only a fully quoted reply.
  let t = text.replace(/\*\*|__/g, "").trim();
  if (/^".*"$/s.test(t) && t.slice(1, -1).indexOf('"') === -1) t = t.slice(1, -1).trim();
  if (!t.endsWith(url)) t = `${t.replace(new RegExp(url.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "g"), "").trim()}\n\n${url}`;
  return t;
}

export async function draftEssay(path, { force = false } = {}) {
  const { data, content } = matter(readFileSync(path, "utf8"));
  const slug = String(data.slug || basename(path, ".md"));
  const outFile = join(OUT_DIR, `${slug}.md`);
  if (existsSync(outFile) && !force) {
    console.log(`linkedin: draft exists, skipping (use --force) — ${outFile}`);
    return outFile;
  }
  const route = routeFor(slug);
  if (!route) throw new Error(`no route for slug "${slug}" in sitemap — build first`);
  const url = `${SITE}${route}`;
  const body = content.replace(/<[^>]+>/g, "").slice(0, 24000);
  const user = `Essay title: ${data.title}\nDescription: ${data.description ?? ""}\nURL: ${url}\n\nEssay text:\n${body}`;
  const messages = [{ role: "system", content: SYSTEM }, { role: "user", content: user }];

  let post = finalize(await mistral(messages), url);
  let issues = violations(post, url);
  if (issues.length) {
    console.warn(`linkedin: retrying ${slug} — ${issues.join("; ")}`);
    messages.push({ role: "assistant", content: post });
    messages.push({ role: "user", content: `Rewrite it. Fix these problems: ${issues.join("; ")}. Same rules.` });
    post = finalize(await mistral(messages), url);
    issues = violations(post, url);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const fm = [
    "---",
    `essay: ${path}`,
    `title: ${JSON.stringify(String(data.title ?? slug))}`,
    `url: ${url}`,
    `generated: ${new Date().toISOString()}`,
    `model: ${usedModel}`,
    issues.length ? `warnings: ${JSON.stringify(issues)}` : "warnings: []",
    "---",
    "",
  ].join("\n");
  writeFileSync(outFile, `${fm}${post}\n`);
  console.log(`linkedin: draft → ${outFile}${issues.length ? ` (check: ${issues.join("; ")})` : ""}`);
  return outFile;
}

async function main() {
  loadEnvFiles();
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const paths = args.includes("--auto") ? detectNewlyPublished() : args.filter((a) => !a.startsWith("--"));
  if (!paths.length) {
    console.log("linkedin: no newly published essays");
    return;
  }
  let failed = 0;
  for (const p of paths) {
    try {
      await draftEssay(p, { force });
    } catch (e) {
      failed++;
      console.error(`linkedin: ${p} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) await main();
