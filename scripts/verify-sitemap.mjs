/**
 * Verify sitemap.xml + robots.txt in out/ (and optional live URL).
 * Exits non-zero on protocol or reference failures.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "out");
const ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://ashitmilne.xyz"
).replace(/\/$/, "");

function fail(message) {
  console.error(`verify-sitemap: ${message}`);
  process.exit(1);
}

const sitemapPath = path.join(OUT, "sitemap.xml");
const robotsPath = path.join(OUT, "robots.txt");
const apiCatalogPath = path.join(OUT, ".well-known", "api-catalog");
const authMdPath = path.join(OUT, "auth.md");
const agentSkillsPath = path.join(OUT, ".well-known", "agent-skills", "index.json");

if (!fs.existsSync(sitemapPath)) fail("out/sitemap.xml missing — run npm run build");
if (!fs.existsSync(robotsPath)) fail("out/robots.txt missing — run npm run build");
if (!fs.existsSync(apiCatalogPath)) fail("out/.well-known/api-catalog missing — run npm run build");
if (!fs.existsSync(authMdPath)) fail("out/auth.md missing — run npm run build");
if (!fs.existsSync(agentSkillsPath)) fail("out/.well-known/agent-skills/index.json missing — run npm run build");

const sitemap = fs.readFileSync(sitemapPath, "utf8");
const robots = fs.readFileSync(robotsPath, "utf8");

if (!sitemap.startsWith("<?xml")) fail("sitemap.xml must start with XML declaration");
if (!sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
  fail("sitemap.xml missing sitemaps.org namespace");
}

const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (locs.length === 0) fail("sitemap.xml has no <loc> entries");

for (const loc of locs) {
  if (!loc.startsWith(`${ORIGIN}/`) && loc !== `${ORIGIN}/`) {
    fail(`non-canonical loc (expected ${ORIGIN}): ${loc}`);
  }
}

const sitemapRef = `${ORIGIN}/sitemap.xml`;
if (!robots.includes(`Sitemap: ${sitemapRef}`)) {
  fail(`robots.txt must include: Sitemap: ${sitemapRef}`);
}

const apiCatalog = JSON.parse(fs.readFileSync(apiCatalogPath, "utf8"));
if (!Array.isArray(apiCatalog.linkset) || apiCatalog.linkset.length === 0) {
  fail("api-catalog missing linkset array");
}

const authMd = fs.readFileSync(authMdPath, "utf8");
if (!/auth\.md/i.test(authMd)) fail("auth.md must mention auth.md in heading");

console.log(`verify-sitemap: OK — ${locs.length} URL(s), robots, api-catalog, auth.md, agent-skills`);

const liveUrl = process.argv.find((a) => a.startsWith("--live="))?.slice("--live=".length);
if (liveUrl) {
  const res = await fetch(`${liveUrl.replace(/\/$/, "")}/sitemap.xml`, { method: "HEAD" });
  if (!res.ok) fail(`live ${liveUrl}/sitemap.xml returned ${res.status}`);
  console.log(`verify-sitemap: live HEAD ${liveUrl}/sitemap.xml → ${res.status}`);
}
