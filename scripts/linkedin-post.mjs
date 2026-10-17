#!/usr/bin/env node
/**
 * Post a LinkedIn draft (linkedin/drafts/<slug>.md) to Ashit's profile via the Posts API.
 * Dry run by default; publishes only with --confirm.
 *
 *   node scripts/linkedin-post.mjs linkedin/drafts/bias.md            (dry run: prints the request)
 *   node scripts/linkedin-post.mjs linkedin/drafts/bias.md --confirm  (real post)
 *
 * Needs LINKEDIN_ACCESS_TOKEN (scope w_member_social) and LINKEDIN_PERSON_URN
 * (urn:li:person:<sub>) in .env.local. LINKEDIN_VERSION optional (YYYYMM).
 */
import { readFileSync } from "node:fs";
import matter from "gray-matter";
import { loadEnvFiles } from "./lib/load-env.mjs";

loadEnvFiles();
const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: node scripts/linkedin-post.mjs linkedin/drafts/<slug>.md [--confirm]");
  process.exit(1);
}

const { data, content } = matter(readFileSync(file, "utf8"));
const url = String(data.url || "");
const commentary = content.trim();
if (!url || !commentary) {
  console.error("linkedin-post: draft needs a url in frontmatter and post text");
  process.exit(1);
}

const author = process.env.LINKEDIN_PERSON_URN || "urn:li:person:<id>";
const version = process.env.LINKEDIN_VERSION || defaultVersion();
const payload = {
  author,
  commentary: escapeLittleText(commentary),
  visibility: "PUBLIC",
  distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
  content: { article: { source: url, title: String(data.title || "") } },
  lifecycleState: "PUBLISHED",
  isReshareDisabledByAuthor: false,
};

/** LinkedIn "little text": these characters must be backslash-escaped in commentary. */
function escapeLittleText(s) {
  return s.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
}

/** Previous month as YYYYMM (LinkedIn supports versions for about a year). */
function defaultVersion() {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

if (!confirm) {
  console.log(`linkedin-post: DRY RUN (Linkedin-Version ${version}) — add --confirm to publish`);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const token = process.env.LINKEDIN_ACCESS_TOKEN;
if (!token || !process.env.LINKEDIN_PERSON_URN) {
  console.error("linkedin-post: set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN in .env.local");
  process.exit(1);
}
const res = await fetch("https://api.linkedin.com/rest/posts", {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "LinkedIn-Version": version,
    "X-Restli-Protocol-Version": "2.0.0",
  },
  body: JSON.stringify(payload),
});
if (res.status !== 201) {
  console.error(`linkedin-post: HTTP ${res.status} — ${(await res.text()).slice(0, 500)}`);
  process.exit(1);
}
console.log(`linkedin-post: published — ${res.headers.get("x-restli-id") ?? "(no id returned)"}`);
